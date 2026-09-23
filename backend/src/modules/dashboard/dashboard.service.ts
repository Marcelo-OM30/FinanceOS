import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { AlertsService } from './alerts.service';
import { deslocarMes, diasNoMes, hojeNoFuso, limitesDoMes, partesDaData } from '../../common/datas';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
    private alertsService: AlertsService,
  ) {}

  async getSummary(userId: string, fuso?: string) {
    const { ano, mes } = partesDaData(hojeNoFuso(fuso));
    const { inicio: inicioMes, fim: fimMes } = limitesDoMes(ano, mes);

    const [accounts, entradas, saidas, alertasNaoLidos] = await Promise.all([
      this.accountsRepository.find({ where: { userId, ativo: true } }),
      this.sumTransactions(userId, 'receita', inicioMes, fimMes),
      this.sumTransactions(userId, 'despesa', inicioMes, fimMes),
      this.alertsService.countUnread(userId),
    ]);

    const saldoConsolidado = accounts.reduce(
      (acc, a) => acc + Number(a.saldoAtual),
      0,
    );

    return {
      saldoConsolidado,
      totalEntradasMes: entradas,
      totalSaidasMes: saidas,
      resultadoMes: entradas - saidas,
      alertasNaoLidos,
    };
  }

  async getChartCategories(userId: string, fuso?: string) {
    const { ano, mes } = partesDaData(hojeNoFuso(fuso));
    const { inicio: inicioMes, fim: fimMes } = limitesDoMes(ano, mes);

    const rows = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('c.nome', 'categoria')
      .addSelect('c.cor', 'cor')
      .addSelect('SUM(t.valor)', 'valor')
      .leftJoin('t.category', 'c')
      .where('t.userId = :userId', { userId })
      .andWhere('t.tipo = :tipo', { tipo: 'despesa' })
      .andWhere('t.confirmada = true')
      // Por competência, como o orçamento: o gasto conta no mês em que aconteceu.
      .andWhere('COALESCE(t.dataCompetencia, t.data) BETWEEN :inicio AND :fim', {
        inicio: inicioMes,
        fim: fimMes,
      })
      .groupBy('c.id')
      .addGroupBy('c.nome')
      .addGroupBy('c.cor')
      .orderBy('SUM(t.valor)', 'DESC')
      .getRawMany<{ categoria: string; cor: string; valor: string }>();

    const total = rows.reduce((acc, r) => acc + parseFloat(r.valor ?? '0'), 0);

    const data = rows.map((r) => ({
      categoria: r.categoria ?? 'Sem categoria',
      cor: r.cor ?? null,
      valor: parseFloat(r.valor ?? '0'),
      percentual: total > 0 ? Math.round((parseFloat(r.valor ?? '0') / total) * 100) : 0,
    }));

    return { data, total };
  }

  async getChartEvolution(userId: string, meses: number = 6, fuso?: string) {
    const resultado: {
      mes: string;
      mesNumero: number;
      ano: number;
      receitas: number;
      despesas: number;
      saldo: number;
    }[] = [];

    const atual = partesDaData(hojeNoFuso(fuso));

    for (let i = meses - 1; i >= 0; i--) {
      const { ano, mes } = deslocarMes(atual.ano, atual.mes, -i);
      const { inicio, fim } = limitesDoMes(ano, mes);

      const [receitas, despesas] = await Promise.all([
        this.sumTransactions(userId, 'receita', inicio, fim),
        this.sumTransactions(userId, 'despesa', inicio, fim),
      ]);

      resultado.push({
        mes: new Date(Date.UTC(ano, mes - 1, 1)).toLocaleString('pt-BR', {
          month: 'long',
          timeZone: 'UTC',
        }),
        mesNumero: mes,
        ano,
        receitas,
        despesas,
        saldo: receitas - despesas,
      });
    }

    return { data: resultado };
  }

  async getProjection(userId: string, fuso?: string) {
    const hojeStr = hojeNoFuso(fuso);
    const { ano, mes, dia: diaAtual } = partesDaData(hojeStr);
    const { inicio: inicioMes, fim: fimMes } = limitesDoMes(ano, mes);
    const diasRestantes = diasNoMes(ano, mes) - diaAtual;

    const [accounts, saidasAteHoje, previstoEntradas, previstoSaidas] = await Promise.all([
      this.accountsRepository.find({ where: { userId, ativo: true } }),
      this.sumTransactions(userId, 'despesa', inicioMes, hojeStr),
      this.sumPrevistas(userId, 'receita', fimMes),
      this.sumPrevistas(userId, 'despesa', fimMes),
    ]);

    const saldoAtual = accounts.reduce((acc, a) => acc + Number(a.saldoAtual), 0);

    // Gasto do dia a dia: taxa diária do que já saiu × dias restantes. O que
    // está agendado entra pelo valor exato, somado à parte.
    const taxaDiaria = diaAtual > 0 ? saidasAteHoje / diaAtual : 0;
    const projecaoDespesasRestantes = taxaDiaria * diasRestantes;
    const saldoProjetadoFimMes =
      saldoAtual + previstoEntradas - previstoSaidas - projecaoDespesasRestantes;

    const centavos = (v: number) => Math.round(v * 100) / 100;
    return {
      saldoAtual,
      saldoProjetadoFimMes: centavos(saldoProjetadoFimMes),
      diferenca: centavos(saldoProjetadoFimMes - saldoAtual),
      diasRestantes,
      taxaDiariaGasto: centavos(taxaDiaria),
      previstoEntradas: centavos(previstoEntradas),
      previstoSaidas: centavos(previstoSaidas),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async sumTransactions(
    userId: string,
    tipo: string,
    inicio: string,
    fim: string,
  ): Promise<number> {
    const result = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.valor), 0)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.tipo = :tipo', { tipo })
      .andWhere('t.confirmada = true')
      .andWhere('t.data BETWEEN :inicio AND :fim', { inicio, fim })
      .getRawOne<{ total: string }>();

    return parseFloat(result?.total ?? '0');
  }

  /**
   * Previstas até `ate`, inclusive as atrasadas (data já passou e ninguém
   * confirmou): ainda não saíram do saldo, então ainda vão sair.
   */
  private async sumPrevistas(userId: string, tipo: string, ate: string): Promise<number> {
    const result = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.valor), 0)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.tipo = :tipo', { tipo })
      .andWhere('t.confirmada = false')
      .andWhere('t.data <= :ate', { ate })
      .getRawOne<{ total: string }>();

    return parseFloat(result?.total ?? '0');
  }
}
