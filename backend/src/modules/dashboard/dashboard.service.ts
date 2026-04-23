import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { AlertsService } from './alerts.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
    private alertsService: AlertsService,
  ) {}

  async getSummary(userId: string) {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

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

  async getChartCategories(userId: string) {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    const rows = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('c.nome', 'categoria')
      .addSelect('c.cor', 'cor')
      .addSelect('SUM(t.valor)', 'valor')
      .leftJoin('t.category', 'c')
      .where('t.userId = :userId', { userId })
      .andWhere('t.tipo = :tipo', { tipo: 'despesa' })
      .andWhere('t.data BETWEEN :inicio AND :fim', { inicio: inicioMes, fim: fimMes })
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

  async getChartEvolution(userId: string, meses: number = 6) {
    const resultado: {
      mes: string;
      mesNumero: number;
      ano: number;
      receitas: number;
      despesas: number;
      saldo: number;
    }[] = [];

    const hoje = new Date();

    for (let i = meses - 1; i >= 0; i--) {
      const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const ano = ref.getFullYear();
      const mes = ref.getMonth() + 1;
      const inicio = new Date(ano, mes - 1, 1).toISOString().split('T')[0];
      const fim = new Date(ano, mes, 0).toISOString().split('T')[0];

      const [receitas, despesas] = await Promise.all([
        this.sumTransactions(userId, 'receita', inicio, fim),
        this.sumTransactions(userId, 'despesa', inicio, fim),
      ]);

      resultado.push({
        mes: ref.toLocaleString('pt-BR', { month: 'long' }),
        mesNumero: mes,
        ano,
        receitas,
        despesas,
        saldo: receitas - despesas,
      });
    }

    return { data: resultado };
  }

  async getProjection(userId: string) {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const hojeStr = hoje.toISOString().split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const diasTotais = ultimoDia.getDate();
    const diaAtual = hoje.getDate();
    const diasRestantes = diasTotais - diaAtual;

    const [accounts, saidasAteHoje] = await Promise.all([
      this.accountsRepository.find({ where: { userId, ativo: true } }),
      this.sumTransactions(userId, 'despesa', inicioMes, hojeStr),
    ]);

    const saldoAtual = accounts.reduce((acc, a) => acc + Number(a.saldoAtual), 0);

    // Projeção linear: taxa de gasto diária × dias restantes
    const taxaDiaria = diaAtual > 0 ? saidasAteHoje / diaAtual : 0;
    const projecaoDespesasRestantes = taxaDiaria * diasRestantes;
    const saldoProjetadoFimMes = saldoAtual - projecaoDespesasRestantes;

    return {
      saldoAtual,
      saldoProjetadoFimMes: Math.round(saldoProjetadoFimMes * 100) / 100,
      diferenca: Math.round((saldoProjetadoFimMes - saldoAtual) * 100) / 100,
      diasRestantes,
      taxaDiariaGasto: Math.round(taxaDiaria * 100) / 100,
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
      .andWhere('t.data BETWEEN :inicio AND :fim', { inicio, fim })
      .getRawOne<{ total: string }>();

    return parseFloat(result?.total ?? '0');
  }
}
