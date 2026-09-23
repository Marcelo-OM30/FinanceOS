import { Repository } from 'typeorm';
import { DashboardService } from './dashboard.service';
import { AlertsService } from './alerts.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';

describe('DashboardService — mês do usuário', () => {
  // 30/09 às 23h30 em Brasília; o servidor, em UTC, já está em 01/10.
  const ultimaNoiteDeSetembro = new Date('2026-10-01T02:30:00Z');

  let periodos: Array<{ inicio: string; fim: string }>;
  let service: DashboardService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(ultimaNoiteDeSetembro);
    periodos = [];

    const qb: Record<string, jest.Mock> = {};
    for (const m of ['select', 'addSelect', 'leftJoin', 'where', 'groupBy', 'addGroupBy', 'orderBy']) {
      qb[m] = jest.fn(() => qb);
    }
    qb.andWhere = jest.fn((sql: string, params?: { inicio: string; fim: string }) => {
      if (sql.includes('BETWEEN')) periodos.push(params!);
      return qb;
    });
    qb.getRawOne = jest.fn(async () => ({ total: '0' }));
    qb.getRawMany = jest.fn(async () => []);

    service = new DashboardService(
      { createQueryBuilder: () => qb } as unknown as Repository<Transaction>,
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
});
