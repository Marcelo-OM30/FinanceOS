import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, FindOptionsWhere } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';

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
    const { accountId, categoryId, cardId, dataInicio, dataFim, tipo, page = 1, limit = 20 } = filters;

    const where: FindOptionsWhere<Transaction> = { userId };

    if (accountId) where.accountId = accountId;
    if (categoryId) where.categoryId = categoryId;
    if (cardId) where.cardId = cardId;
    if (tipo) where.tipo = tipo;
    if (dataInicio && dataFim) {
      where.data = Between(dataInicio, dataFim) as any;
    }

    const [data, total] = await this.transactionsRepository.findAndCount({
      where,
      order: { data: 'DESC', dataCriacao: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['category', 'account', 'card'],
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id, userId },
      relations: ['category', 'account', 'card'],
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada');
    return transaction;
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const account = await this.accountsRepository.findOne({
      where: { id: dto.accountId, userId },
    });
    if (!account) throw new BadRequestException('Conta não encontrada');

    return this.dataSource.transaction(async (manager) => {
      const transaction = manager.create(Transaction, {
        ...dto,
        userId,
        data: dto.data as any,
        dataCompetencia: dto.dataCompetencia as any,
        recurso: dto.recurso ?? 'manual',
        tags: dto.tags ?? [],
      });

      const saved = await manager.save(Transaction, transaction);

      // Atualiza saldo da conta
      const delta = dto.tipo === 'receita' ? Number(dto.valor) : -Number(dto.valor);
      await manager.update(Account, account.id, {
        saldoAtual: Number(account.saldoAtual) + delta,
      });

      return saved;
    });
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto): Promise<Transaction> {
    const transaction = await this.findOne(id, userId);

    // Reverte o efeito da transação original no saldo
    const account = await this.accountsRepository.findOne({
      where: { id: transaction.accountId },
    });
    if (!account) throw new BadRequestException('Conta não encontrada');

    return this.dataSource.transaction(async (manager) => {
      const oldDelta = transaction.tipo === 'receita'
        ? -Number(transaction.valor)
        : Number(transaction.valor);

      Object.assign(transaction, dto);
      if (dto.data) transaction.data = dto.data as any;
      if (dto.dataCompetencia) transaction.dataCompetencia = dto.dataCompetencia as any;

      const saved = await manager.save(Transaction, transaction);

      const newDelta = transaction.tipo === 'receita'
        ? Number(transaction.valor)
        : -Number(transaction.valor);

      await manager.update(Account, account.id, {
        saldoAtual: Number(account.saldoAtual) + oldDelta + newDelta,
      });

      return saved;
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const transaction = await this.findOne(id, userId);

    const account = await this.accountsRepository.findOne({
      where: { id: transaction.accountId },
    });
    if (!account) throw new BadRequestException('Conta não encontrada');

    await this.dataSource.transaction(async (manager) => {
      // Reverte o saldo
      const delta = transaction.tipo === 'receita'
        ? -Number(transaction.valor)
        : Number(transaction.valor);

      await manager.update(Account, account.id, {
        saldoAtual: Number(account.saldoAtual) + delta,
      });

      await manager.remove(Transaction, transaction);
    });
  }

  // ─── Utilitários para outros módulos ────────────────────────────────────────

  async sumByCategory(
    userId: string,
    categoryId: string,
    mes: number,
    ano: number,
  ): Promise<number> {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0);

    const result = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.valor), 0)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.categoryId = :categoryId', { categoryId })
      .andWhere('t.tipo = :tipo', { tipo: 'despesa' })
      .andWhere('t.data BETWEEN :inicio AND :fim', {
        inicio: dataInicio.toISOString().split('T')[0],
        fim: dataFim.toISOString().split('T')[0],
      })
      .getRawOne<{ total: string }>();

    return parseFloat(result?.total ?? '0');
  }
}
