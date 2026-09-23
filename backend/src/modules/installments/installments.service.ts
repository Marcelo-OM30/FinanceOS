import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { InstallmentPurchase } from './entities/installment-purchase.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { CreateInstallmentDto } from './dto/create-installment.dto';
import { UpdateInstallmentDto } from './dto/update-installment.dto';
import { FilterInstallmentDto } from './dto/filter-installment.dto';
import { aplicarNoSaldo } from '../transactions/saldo';
import { hojeNoFuso, somarMeses } from '../../common/datas';

export interface ResumoParcelamento {
  parcelasPagas: number;
  parcelasRestantes: number;
  valorPago: number;
  saldoDevedor: number;
  proximoVencimento: string | null;
}

export type InstallmentWithStats = InstallmentPurchase & ResumoParcelamento;

/**
 * Divide o total em centavos inteiros. A soma das parcelas é sempre
 * exatamente o total: o resíduo vai inteiro na primeira parcela, como fazem
 * as operadoras (R$ 100 em 3x = 33,34 + 33,33 + 33,33).
 */
export function dividirEmParcelas(valorTotal: number, n: number): number[] {
  const totalCentavos = Math.round(valorTotal * 100);
  const base = Math.floor(totalCentavos / n);
  const residuo = totalCentavos - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + residuo : base) / 100);
}

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(InstallmentPurchase)
    private installmentsRepository: Repository<InstallmentPurchase>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
    private dataSource: DataSource,
  ) {}

  async findAll(userId: string, filters: FilterInstallmentDto): Promise<{ data: InstallmentWithStats[] }> {
    const compras = await this.installmentsRepository.find({
      where: { userId, ...(filters.status ? { status: filters.status } : {}) },
      relations: ['account', 'category'],
      order: { dataCompra: 'DESC', dataCriacao: 'DESC' },
    });
    const resumos = await this.resumir(compras.map((c) => c.id));
    return { data: compras.map((c) => ({ ...c, ...resumos.get(c.id)! })) };
  }

  async findOne(id: string, userId: string): Promise<InstallmentWithStats> {
    const compra = await this.installmentsRepository.findOne({
      where: { id, userId },
      relations: ['account', 'category', 'parcelas'],
    });
    if (!compra) throw new NotFoundException('Parcelamento não encontrado');
    compra.parcelas?.sort((a, b) => (a.numeroParcela ?? 0) - (b.numeroParcela ?? 0));
    const resumos = await this.resumir([id]);
    return { ...compra, ...resumos.get(id)! };
  }

  async create(userId: string, dto: CreateInstallmentDto, fuso?: string): Promise<InstallmentWithStats> {
    const conta = await this.accountsRepository.findOne({ where: { id: dto.accountId, userId } });
    if (!conta) throw new BadRequestException('Conta não encontrada');
    if (dto.primeiroVencimento.slice(0, 10) < dto.dataCompra.slice(0, 10)) {
      throw new BadRequestException('O primeiro vencimento não pode ser antes da compra');
    }
    if (Math.round(dto.valorTotal * 100) < dto.numeroParcelas) {
      throw new BadRequestException('Valor total pequeno demais para esse número de parcelas');
    }

    const valores = dividirEmParcelas(dto.valorTotal, dto.numeroParcelas);
    const dataCompra = dto.dataCompra.slice(0, 10);
    const primeiroVencimento = dto.primeiroVencimento.slice(0, 10);
    const hoje = hojeNoFuso(fuso);

    const id = await this.dataSource.transaction(async (manager) => {
      const compra = await manager.save(
        manager.create(InstallmentPurchase, {
          userId,
          accountId: dto.accountId,
          categoryId: dto.categoryId ?? null,
          cardId: null,
          descricao: dto.descricao,
          valorTotal: dto.valorTotal,
          numeroParcelas: dto.numeroParcelas,
          valorParcela: valores[valores.length - 1],
          dataCompra,
          primeiroVencimento,
          status: 'ativa',
        }),
      );

      const parcelas = valores.map((valor, i) => {
        const data = somarMeses(primeiroVencimento, i);
        return manager.create(Transaction, {
          userId,
          accountId: dto.accountId,
          categoryId: dto.categoryId,
          tipo: 'despesa',
          descricao: `${dto.descricao} (${i + 1}/${dto.numeroParcelas})`,
          valor,
          data: data as any,
          dataCompetencia: dataCompra as any,
          // Cadastrar uma compra já em andamento: o que venceu, foi pago.
          confirmada: data <= hoje,
          recurso: 'manual',
          tags: [],
          installmentPurchaseId: compra.id,
          numeroParcela: i + 1,
        });
      });
      await manager.save(Transaction, parcelas);
      for (const p of parcelas) await aplicarNoSaldo(manager, p, 1);

      if (parcelas.every((p) => p.confirmada)) {
        await manager.update(InstallmentPurchase, compra.id, { status: 'quitada' });
      }
      return compra.id;
    });

    return this.findOne(id, userId);
  }

  async update(id: string, userId: string, dto: UpdateInstallmentDto): Promise<InstallmentWithStats> {
    const compra = await this.installmentsRepository.findOne({ where: { id, userId } });
    if (!compra) throw new NotFoundException('Parcelamento não encontrado');

    await this.dataSource.transaction(async (manager) => {
      const parcelas = await manager.find(Transaction, { where: { installmentPurchaseId: id } });
      if (dto.descricao !== undefined) {
        compra.descricao = dto.descricao;
        for (const p of parcelas) {
          p.descricao = `${dto.descricao} (${p.numeroParcela}/${compra.numeroParcelas})`;
        }
      }
      if (dto.categoryId !== undefined) {
        compra.categoryId = dto.categoryId;
        for (const p of parcelas) p.categoryId = dto.categoryId ?? undefined;
      }
      await manager.save(InstallmentPurchase, compra);
      await manager.save(Transaction, parcelas);
    });

    return this.findOne(id, userId);
  }

  /**
   * Cancelar não apaga histórico: as parcelas pagas ficam (o dinheiro saiu de
   * verdade), as previstas somem.
   */
  async cancel(id: string, userId: string): Promise<void> {
    const compra = await this.installmentsRepository.findOne({ where: { id, userId } });
    if (!compra) throw new NotFoundException('Parcelamento não encontrado');

    await this.dataSource.transaction(async (manager) => {
      const previstas = await manager.find(Transaction, {
        where: { installmentPurchaseId: id, confirmada: false },
      });
      for (const p of previstas) await aplicarNoSaldo(manager, p, -1);
      await manager.remove(Transaction, previstas);
      await manager.update(InstallmentPurchase, id, { status: 'cancelada' });
    });
  }

  private async resumir(ids: string[]): Promise<Map<string, ResumoParcelamento>> {
    const resumos = new Map<string, ResumoParcelamento>(
      ids.map((id) => [
        id,
        { parcelasPagas: 0, parcelasRestantes: 0, valorPago: 0, saldoDevedor: 0, proximoVencimento: null },
      ]),
    );
    if (ids.length === 0) return resumos;

    const linhas = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('t.installmentPurchaseId', 'id')
      .addSelect('COUNT(*) FILTER (WHERE t.confirmada)', 'pagas')
      .addSelect('COUNT(*) FILTER (WHERE NOT t.confirmada)', 'restantes')
      .addSelect('COALESCE(SUM(t.valor) FILTER (WHERE t.confirmada), 0)', 'pago')
      .addSelect('COALESCE(SUM(t.valor) FILTER (WHERE NOT t.confirmada), 0)', 'devedor')
      .addSelect(`TO_CHAR(MIN(t.data) FILTER (WHERE NOT t.confirmada), 'YYYY-MM-DD')`, 'proximo')
      .where({ installmentPurchaseId: In(ids) })
      .groupBy('t.installmentPurchaseId')
      .getRawMany<{ id: string; pagas: string; restantes: string; pago: string; devedor: string; proximo: string | null }>();

    for (const l of linhas) {
      resumos.set(l.id, {
        parcelasPagas: Number(l.pagas),
        parcelasRestantes: Number(l.restantes),
        valorPago: Number(l.pago),
        saldoDevedor: Number(l.devedor),
        proximoVencimento: l.proximo,
      });
    }
    return resumos;
  }
}
