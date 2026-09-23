import { Repository } from 'typeorm';
import { DashboardService } from './dashboard.service';
import { AlertsService } from './alerts.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';

describe('DashboardService — mês do usuário', () => {
  // 30/09 às 23h30 em Brasília; o servidor, em UTC, já está em 01/10.
  const ultimaNoiteDeSetembro = new Date('2026-10-01T02:30:00Z');

  let periodos: Array<{ inicio: string; fim: string }>;
  let previstas: { receita: number; despesa: number };
  let consultas: Array<{ condicoes: string[]; params: Record<string, unknown> }>;
  let service: DashboardService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(ultimaNoiteDeSetembro);
    periodos = [];

    // Um query builder por consulta, que guarda o que foi pedido. Previstas
    // devolvem valores fixos; realizadas, zero.
    previstas = { receita: 0, despesa: 0 };
    consultas = [];
    const novoQb = () => {
      const consulta = { condicoes: [] as string[], params: {} as Record<string, unknown> };
      consultas.push(consulta);
      const qb: Record<string, jest.Mock> = {};
      for (const m of ['select', 'addSelect', 'leftJoin', 'groupBy', 'addGroupBy', 'orderBy']) {
        qb[m] = jest.fn(() => qb);
      }
      qb.where = qb.andWhere = jest.fn((sql: string, params?: Record<string, unknown>) => {
        consulta.condicoes.push(sql);
        Object.assign(consulta.params, params);
        if (sql.includes('BETWEEN')) periodos.push(params as { inicio: string; fim: string });
        return qb;
      });
      qb.getRawOne = jest.fn(async () => {
        const prevista = consulta.condicoes.includes('t.confirmada = false');
        const tipo = consulta.params.tipo as 'receita' | 'despesa';
        return { total: String(prevista ? previstas[tipo] : 0) };
      });
      qb.getRawMany = jest.fn(async () => []);
      return qb;
    };

    service = new DashboardService(
      { createQueryBuilder: novoQb } as unknown as Repository<Transaction>,
      { find: jest.fn(async () => [{ saldoAtual: '1000' }]) } as unknown as Repository<Account>,
      { countUnread: jest.fn(async () => 0) } as unknown as AlertsService,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('o resumo soma setembro, não outubro', async () => {
    await service.getSummary('u1', 'America/Sao_Paulo');

    expect(periodos).toEqual([
      { inicio: '2026-09-01', fim: '2026-09-30' },
      { inicio: '2026-09-01', fim: '2026-09-30' },
    ]);
  });

  it('a projeção está no último dia do mês, sem dias restantes', async () => {
    const projecao = await service.getProjection('u1', 'America/Sao_Paulo');

    expect(periodos).toEqual([{ inicio: '2026-09-01', fim: '2026-09-30' }]);
    expect(projecao.diasRestantes).toBe(0);
  });

  it('a evolução termina em setembro', async () => {
    const { data } = await service.getChartEvolution('u1', 3, 'America/Sao_Paulo');

    expect(data.map((m) => [m.mes, m.ano])).toEqual([
      ['julho', 2026],
      ['agosto', 2026],
      ['setembro', 2026],
    ]);
    expect(periodos.at(-1)).toEqual({ inicio: '2026-09-01', fim: '2026-09-30' });
  });

  it('totais do mês e evolução só somam realizadas', async () => {
    await service.getSummary('u1', 'America/Sao_Paulo');
    await service.getChartEvolution('u1', 2, 'America/Sao_Paulo');
    await service.getChartCategories('u1', 'America/Sao_Paulo');

    expect(consultas.length).toBeGreaterThan(0);
    for (const c of consultas) expect(c.condicoes).toContain('t.confirmada = true');
  });

  it('gráfico de categorias usa a data de competência', async () => {
    await service.getChartCategories('u1', 'America/Sao_Paulo');

    expect(consultas[0].condicoes.some((c) => c.startsWith('COALESCE(t.dataCompetencia, t.data)'))).toBe(true);
  });

  it('a projeção soma o que está agendado até o fim do mês', async () => {
    previstas = { receita: 200, despesa: 700 };

    const projecao = await service.getProjection('u1', 'America/Sao_Paulo');

    // saldo 1000 + 200 agendado entrando − 700 agendado saindo; sem dias restantes.
    expect(projecao.saldoProjetadoFimMes).toBe(500);
    expect(projecao.previstoEntradas).toBe(200);
    expect(projecao.previstoSaidas).toBe(700);
    const prevista = consultas.find((c) => c.condicoes.includes('t.confirmada = false'))!;
    expect(prevista.params.ate).toBe('2026-09-30');
  });
});
