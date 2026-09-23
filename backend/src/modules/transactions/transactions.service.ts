import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, EntityManager, FindOptionsWhere } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';
import { limitesDoMes } from '../../common/datas';

type EfeitoInput = Pick<Transaction, 'tipo' | 'valor' | 'accountId' | 'contaDestinoId' | 'confirmada'>;

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
    private dataSource: DataSource,
  ) {}

  async findAll(
    userId: string,
    filters: FilterTransactionDto,
  ): Promise<{ data: Transaction[]; total: number; page: number; limit: number }> {
    const { accountId, categoryId, cardId, dataInicio, dataFim, tipo, confirmada, page = 1, limit = 20 } = filters;

    const where: FindOptionsWhere<Transaction> = { userId };

    if (categoryId) where.categoryId = categoryId;
    if (cardId) where.cardId = cardId;
    if (tipo) where.tipo = tipo;
    if (confirmada !== undefined) where.confirmada = confirmada;
    if (dataInicio && dataFim) {
      where.data = Between(dataInicio, dataFim) as any;
    }

    // Filtrar por conta inclui as transferências que chegam nela.
    const whereFinal = accountId
      ? [{ ...where, accountId }, { ...where, contaDestinoId: accountId }]
      : where;

    const [data, total] = await this.transactionsRepository.findAndCount({
      where: whereFinal,
      order: { data: 'DESC', dataCriacao: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['category', 'account', 'contaDestino', 'card'],
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id, userId },
      relations: ['category', 'account', 'contaDestino', 'card'],
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada');
    return transaction;
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    await this.validarContas(userId, dto, true);

    return this.dataSource.transaction(async (manager) => {
      const transaction = manager.create(Transaction, {
        ...dto,
        userId,
        contaDestinoId: dto.tipo === 'transferência' ? dto.contaDestinoId : null,
        confirmada: dto.confirmada ?? true,
        data: dto.data as any,
        dataCompetencia: dto.dataCompetencia as any,
        recurso: dto.recurso ?? 'manual',
        tags: dto.tags ?? [],
      });

      const saved = await manager.save(Transaction, transaction);
      await this.aplicarNoSaldo(manager, saved, 1);
      return saved;
    });
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto): Promise<Transaction> {
    // Carregada sem relações: com `account` preenchido, o TypeORM ignoraria
    // uma troca de accountId feita pelo DTO.
    const transaction = await this.transactionsRepository.findOne({ where: { id, userId } });
    if (!transaction) throw new NotFoundException('Transação não encontrada');

    const antes = { ...transaction };
    Object.assign(transaction, dto);
    if (dto.data) transaction.data = dto.data as any;
    if (dto.dataCompetencia) transaction.dataCompetencia = dto.dataCompetencia as any;
    // Deixar de ser transferência apaga o destino, em vez de exigir que o
    // cliente mande contaDestinoId: null junto.
    if (transaction.tipo !== 'transferência' && dto.contaDestinoId === undefined) {
      transaction.contaDestinoId = null;
    }

    // Transferência antiga, sem destino, continua editável; só passa a exigir
    // destino quando a edição mexe no tipo ou no próprio destino.
    const exigirDestino = dto.tipo !== undefined || dto.contaDestinoId !== undefined;
    await this.validarContas(userId, transaction, exigirDestino);

    await this.dataSource.transaction(async (manager) => {
      await this.aplicarNoSaldo(manager, antes, -1);
      await manager.save(Transaction, transaction);
      await this.aplicarNoSaldo(manager, transaction, 1);
    });

    return this.findOne(id, userId);
  }

  /** Prevista → realizada: o valor passa a contar no saldo. */
  async confirmar(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.findOne(id, userId);
    if (transaction.confirmada) throw new ConflictException('Transação já confirmada');
    return this.update(id, userId, { confirmada: true });
  }

  /** Realizada → prevista: o valor sai do saldo e volta a ser só agendado. */
  async desconfirmar(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.findOne(id, userId);
    if (!transaction.confirmada) throw new ConflictException('Transação já está prevista');
    return this.update(id, userId, { confirmada: false });
  }

  async remove(id: string, userId: string): Promise<void> {
    const transaction = await this.findOne(id, userId);

    await this.dataSource.transaction(async (manager) => {
      await this.aplicarNoSaldo(manager, transaction, -1);
      await manager.remove(Transaction, transaction);
    });
  }

  // ─── Saldo ──────────────────────────────────────────────────────────────────

  /**
   * Quanto o saldo de cada conta muda por causa desta transação. Prevista
   * (`confirmada = false`) não muda nada: como create, update e remove sempre
   * desfazem o efeito antigo e aplicam o novo, confirmar e desconfirmar são só
   * uma edição de `confirmada`. Transferência tira da origem e põe no destino,
   * e por isso não entra em nenhum total de receita ou despesa. As antigas, sem
   * destino, só tiram da origem — que é exatamente o que fizeram ao ser criadas.
   */
  private efeitoNoSaldo(t: EfeitoInput): Array<[string, number]> {
    if (!t.confirmada) return [];
    const valor = Number(t.valor);
    if (t.tipo === 'receita') return [[t.accountId, valor]];
    if (t.tipo === 'transferência' && t.contaDestinoId) {
      return [[t.accountId, -valor], [t.contaDestinoId, valor]];
    }
    return [[t.accountId, -valor]];
  }

  /** `sinal = -1` desfaz o efeito. Incremento no banco, sem ler o saldo antes. */
  private async aplicarNoSaldo(
    manager: EntityManager,
    t: EfeitoInput,
    sinal: 1 | -1,
  ): Promise<void> {
    for (const [accountId, delta] of this.efeitoNoSaldo(t)) {
      await manager.increment(Account, { id: accountId }, 'saldoAtual', sinal * delta);
    }
  }

  private async validarContas(
    userId: string,
    t: { tipo: string; accountId: string; contaDestinoId?: string | null; cardId?: string | null },
    exigirDestino: boolean,
  ): Promise<void> {
    const origem = await this.accountsRepository.findOne({ where: { id: t.accountId, userId } });
    if (!origem) throw new BadRequestException('Conta não encontrada');

    if (t.tipo !== 'transferência') {
      if (t.contaDestinoId) {
        throw new BadRequestException('Só transferência tem conta de destino');
      }
      return;
    }

    if (t.cardId) {
      throw new BadRequestException('Transferência não pode ser lançada em cartão');
    }
    if (!t.contaDestinoId) {
      if (exigirDestino) {
        throw new BadRequestException('Transferência precisa de conta de destino');
      }
      return;
    }
    if (t.contaDestinoId === t.accountId) {
      throw new BadRequestException('A conta de destino precisa ser diferente da de origem');
    }
    const destino = await this.accountsRepository.findOne({
      where: { id: t.contaDestinoId, userId },
    });
    if (!destino) throw new BadRequestException('Conta de destino não encontrada');
  }

  // ─── Utilitários para outros módulos ────────────────────────────────────────

  async sumByCategory(
    userId: string,
    categoryId: string,
    mes: number,
    ano: number,
  ): Promise<number> {
    // Por competência: a compra de março conta no orçamento de março, mesmo
    // paga em abril. Linhas sem dataCompetencia caem em `data`, como sempre.
    const { inicio, fim } = limitesDoMes(ano, mes);

    const result = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.valor), 0)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.categoryId = :categoryId', { categoryId })
      .andWhere('t.tipo = :tipo', { tipo: 'despesa' })
      .andWhere('t.confirmada = true')
      .andWhere('COALESCE(t.dataCompetencia, t.data) BETWEEN :inicio AND :fim', { inicio, fim })
      .getRawOne<{ total: string }>();

    return parseFloat(result?.total ?? '0');
  }
}
