import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, FindOptionsWhere } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';
import { aplicarNoSaldo } from './saldo';
import { sincronizarStatusDoParcelamento } from '../installments/status-parcelamento';
import { CardInvoice } from '../card-invoices/entities/card-invoice.entity';
import {
  cartaoParaCompra,
  cicloDaCompra,
  faturaAberta,
  recalcularFatura,
} from '../card-invoices/fatura';

// Mudar qualquer um deles numa parcela avulsa quebraria a soma das parcelas
// = valor total, ou mudaria a compra de conta ou de mês.
const CAMPOS_FIXOS_DA_PARCELA = [
  'valor', 'tipo', 'data', 'dataCompetencia', 'accountId', 'cardId', 'contaDestinoId',
] as const;

// Numa compra no cartão, mudar qualquer um deles mudaria a fatura em que ela
// cai; é mais honesto excluir e lançar de novo.
const CAMPOS_FIXOS_DA_COMPRA_NO_CARTAO = [
  'tipo', 'data', 'dataCompetencia', 'accountId', 'cardId', 'contaDestinoId',
] as const;

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
    if (dto.cardId) return this.criarCompraNoCartao(userId, dto);
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
      await aplicarNoSaldo(manager, saved, 1);
      return saved;
    });
  }

  /**
   * `data` do payload é o dia da compra. Gravada, a transação fica com `data`
   * = vencimento da fatura (quando o dinheiro sai) e `dataCompetencia` = dia
   * da compra, prevista até a fatura ser paga.
   */
  private async criarCompraNoCartao(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    if (dto.tipo !== 'despesa') {
      throw new BadRequestException('No cartão de crédito só se lança despesa');
    }
    if (dto.confirmada === true) {
      throw new BadRequestException('Compra no cartão é confirmada pelo pagamento da fatura');
    }
    const dataCompra = dto.data.slice(0, 10);

    const id = await this.dataSource.transaction(async (manager) => {
      const card = await cartaoParaCompra(manager, userId, dto.cardId!);
      const fatura = await faturaAberta(manager, card, cicloDaCompra(card, dataCompra));
      const saved = await manager.save(
        manager.create(Transaction, {
          ...dto,
          userId,
          accountId: card.accountId,
          cardInvoiceId: fatura.id,
          contaDestinoId: null,
          confirmada: false,
          data: fatura.dataVencimento as any,
          dataCompetencia: dataCompra as any,
          recurso: dto.recurso ?? 'manual',
          tags: dto.tags ?? [],
        }),
      );
      await recalcularFatura(manager, fatura.id);
      return saved.id;
    });
    return this.findOne(id, userId);
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto): Promise<Transaction> {
    // Carregada sem relações: com `account` preenchido, o TypeORM ignoraria
    // uma troca de accountId feita pelo DTO.
    const transaction = await this.transactionsRepository.findOne({ where: { id, userId } });
    if (!transaction) throw new NotFoundException('Transação não encontrada');

    await this.recusarSePagamentoDeFatura(id);

    if (transaction.cardId) {
      if (dto.confirmada !== undefined && dto.confirmada !== transaction.confirmada) {
        throw new ConflictException('Compra no cartão é confirmada pelo pagamento da fatura');
      }
      const proibidos = CAMPOS_FIXOS_DA_COMPRA_NO_CARTAO.filter((c) => dto[c] !== undefined);
      if (proibidos.length > 0) {
        throw new BadRequestException(
          `Compra no cartão não pode ter ${proibidos.join(', ')} alterado: exclua e lance de novo`,
        );
      }
      if (dto.valor !== undefined) await this.recusarSeFaturaPaga(transaction.cardInvoiceId);
    } else if (dto.cardId) {
      throw new BadRequestException('Para passar para o cartão, exclua e lance de novo');
    }

    if (transaction.installmentPurchaseId) {
      const proibidos = CAMPOS_FIXOS_DA_PARCELA.filter((c) => dto[c] !== undefined);
      if (proibidos.length > 0) {
        throw new BadRequestException(
          `Parcela não pode ter ${proibidos.join(', ')} alterado sozinha: cancele e recadastre o parcelamento`,
        );
      }
    }

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
      await aplicarNoSaldo(manager, antes, -1);
      await manager.save(Transaction, transaction);
      await aplicarNoSaldo(manager, transaction, 1);
      if (transaction.installmentPurchaseId && antes.confirmada !== transaction.confirmada) {
        await sincronizarStatusDoParcelamento(manager, transaction.installmentPurchaseId);
      }
      if (transaction.cardInvoiceId) await recalcularFatura(manager, transaction.cardInvoiceId);
    });

    return this.findOne(id, userId);
  }

  /** Prevista → realizada: o valor passa a contar no saldo. */
  async confirmar(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.findOne(id, userId);
    if (transaction.cardId) {
      throw new ConflictException('Compra no cartão é confirmada pelo pagamento da fatura');
    }
    if (transaction.confirmada) throw new ConflictException('Transação já confirmada');
    return this.update(id, userId, { confirmada: true });
  }

  /** Realizada → prevista: o valor sai do saldo e volta a ser só agendado. */
  async desconfirmar(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id, userId },
      relations: ['installmentPurchase'],
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada');
    if (transaction.cardId) {
      throw new ConflictException('Compra no cartão volta a prevista desfazendo o pagamento da fatura');
    }
    if (!transaction.confirmada) throw new ConflictException('Transação já está prevista');
    // Cancelar apagou as previstas; uma parcela paga que voltasse a prevista
    // ficaria pendurada num parcelamento que não existe mais.
    if (transaction.installmentPurchase?.status === 'cancelada') {
      throw new ConflictException('Parcela de parcelamento cancelado não pode voltar a prevista');
    }
    return this.update(id, userId, { confirmada: false });
  }

  async remove(id: string, userId: string): Promise<void> {
    const transaction = await this.findOne(id, userId);
    if (transaction.installmentPurchaseId) {
      throw new ConflictException('Parcela não pode ser excluída sozinha: cancele o parcelamento');
    }
    await this.recusarSePagamentoDeFatura(id);
    if (transaction.cardId) await this.recusarSeFaturaPaga(transaction.cardInvoiceId);

    await this.dataSource.transaction(async (manager) => {
      await aplicarNoSaldo(manager, transaction, -1);
      await manager.remove(Transaction, transaction);
      if (transaction.cardInvoiceId) await recalcularFatura(manager, transaction.cardInvoiceId);
    });
  }

  /** O pagamento de fatura só se desfaz pela fatura, que também desconfirma as compras. */
  private async recusarSePagamentoDeFatura(transactionId: string): Promise<void> {
    const fatura = await this.dataSource
      .getRepository(CardInvoice)
      .findOne({ where: { pagamentoTransactionId: transactionId } });
    if (fatura) {
      throw new ConflictException('Pagamento de fatura: desfaça pelo cartão, na fatura');
    }
  }

  private async recusarSeFaturaPaga(cardInvoiceId?: string | null): Promise<void> {
    if (!cardInvoiceId) return;
    const fatura = await this.dataSource.getRepository(CardInvoice).findOne({ where: { id: cardInvoiceId } });
    if (fatura?.status === 'paga') {
      throw new ConflictException('A fatura desta compra já foi paga; desfaça o pagamento antes');
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
}
