import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CardInvoice } from './entities/card-invoice.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { PagarFaturaDto } from './dto/pagar-fatura.dto';
import { FilterFaturaDto } from './dto/filter-fatura.dto';
import { aplicarNoSaldo } from '../transactions/saldo';
import { sincronizarStatusDoParcelamento } from '../installments/status-parcelamento';
import { hojeNoFuso } from '../../common/datas';

export type StatusFatura = 'aberta' | 'fechada' | 'paga';
export type FaturaComStatus = Omit<CardInvoice, 'status'> & { status: StatusFatura };

@Injectable()
export class CardInvoicesService {
  constructor(
    @InjectRepository(CardInvoice)
    private invoicesRepository: Repository<CardInvoice>,
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
    private dataSource: DataSource,
  ) {}

  async findAll(userId: string, filters: FilterFaturaDto, fuso?: string): Promise<{ data: FaturaComStatus[] }> {
    const faturas = await this.invoicesRepository.find({
      where: { userId, ...(filters.cardId ? { cardId: filters.cardId } : {}) },
      relations: ['card'],
      order: { ano: 'DESC', mes: 'DESC' },
    });
    const hoje = hojeNoFuso(fuso);
    return { data: faturas.map((f) => comStatus(f, hoje)) };
  }

  async findOne(id: string, userId: string, fuso?: string): Promise<FaturaComStatus> {
    const fatura = await this.invoicesRepository.findOne({
      where: { id, userId },
      relations: ['card', 'transacoes', 'transacoes.category'],
    });
    if (!fatura) throw new NotFoundException('Fatura não encontrada');
    fatura.transacoes?.sort((a, b) =>
      String(a.dataCompetencia ?? a.data).localeCompare(String(b.dataCompetencia ?? b.data)),
    );
    return comStatus(fatura, hojeNoFuso(fuso));
  }

  /**
   * Paga o total da fatura: uma saída na conta escolhida — transferência sem
   * destino, que mexe no saldo e fica fora dos totais, porque as compras já
   * contam como despesa — e confirma todas as compras de uma vez.
   */
  async pagar(id: string, userId: string, dto: PagarFaturaDto, fuso?: string): Promise<FaturaComStatus> {
    const fatura = await this.invoicesRepository.findOne({ where: { id, userId }, relations: ['card'] });
    if (!fatura) throw new NotFoundException('Fatura não encontrada');
    if (fatura.status === 'paga') throw new ConflictException('Fatura já paga');
    if (Number(fatura.valorTotal) <= 0) throw new BadRequestException('Fatura sem compras');
    const conta = await this.accountsRepository.findOne({ where: { id: dto.accountId, userId } });
    if (!conta) throw new BadRequestException('Conta não encontrada');

    await this.dataSource.transaction(async (manager) => {
      const pagamento = await manager.save(
        manager.create(Transaction, {
          userId,
          accountId: conta.id,
          tipo: 'transferência',
          contaDestinoId: null,
          cardId: null,
          categoryId: undefined,
          descricao: `Fatura ${fatura.card.nome} ${String(fatura.mes).padStart(2, '0')}/${fatura.ano}`,
          valor: Number(fatura.valorTotal),
          data: (dto.data?.slice(0, 10) ?? hojeNoFuso(fuso)) as any,
          confirmada: true,
          recurso: 'manual',
          tags: [],
        }),
      );
      await aplicarNoSaldo(manager, pagamento, 1);
      await manager.update(CardInvoice, id, { status: 'paga', pagamentoTransactionId: pagamento.id });
      await this.confirmarCompras(manager, id, true);
    });

    return this.findOne(id, userId, fuso);
  }

  /** Volta a fatura para aberta: a saída some da conta e as compras voltam a previstas. */
  async desfazerPagamento(id: string, userId: string, fuso?: string): Promise<FaturaComStatus> {
    const fatura = await this.invoicesRepository.findOne({ where: { id, userId } });
    if (!fatura) throw new NotFoundException('Fatura não encontrada');
    if (fatura.status !== 'paga') throw new ConflictException('Fatura não está paga');

    await this.dataSource.transaction(async (manager) => {
      const pagamento = fatura.pagamentoTransactionId
        ? await manager.findOne(Transaction, { where: { id: fatura.pagamentoTransactionId } })
        : null;
      await manager.update(CardInvoice, id, { status: 'aberta', pagamentoTransactionId: null });
      if (pagamento) {
        await aplicarNoSaldo(manager, pagamento, -1);
        await manager.remove(Transaction, pagamento);
      }
      await this.confirmarCompras(manager, id, false);
    });

    return this.findOne(id, userId, fuso);
  }

  private async confirmarCompras(manager: EntityManager, cardInvoiceId: string, confirmada: boolean) {
    // Compra no cartão não mexe no saldo, então é só a flag.
    await manager.update(Transaction, { cardInvoiceId }, { confirmada });
    const parcelas = await manager
      .createQueryBuilder(Transaction, 't')
      .select('DISTINCT t.installmentPurchaseId', 'id')
      .where('t.cardInvoiceId = :cardInvoiceId', { cardInvoiceId })
      .andWhere('t.installmentPurchaseId IS NOT NULL')
      .getRawMany<{ id: string }>();
    for (const { id } of parcelas) await sincronizarStatusDoParcelamento(manager, id);
  }
}

function comStatus(fatura: CardInvoice, hoje: string): FaturaComStatus {
  const status: StatusFatura =
    fatura.status === 'paga' ? 'paga' : hoje > String(fatura.dataFechamento) ? 'fechada' : 'aberta';
  return { ...fatura, status };
}
