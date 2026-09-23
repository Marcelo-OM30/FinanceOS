import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InstallmentsService, dividirEmParcelas } from './installments.service';
import { InstallmentPurchase } from './entities/installment-purchase.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { somarMeses } from '../../common/datas';

describe('dividirEmParcelas', () => {
  it('R$ 100 em 3x: resíduo na primeira parcela', () => {
    expect(dividirEmParcelas(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });

  it('a soma fecha o total, em centavos, para qualquer combinação', () => {
    for (const total of [0.02, 0.99, 1, 99.99, 100, 1234.56, 9999.99, 15000]) {
      for (let n = 2; n <= 24 && n <= total * 100; n++) {
        const parcelas = dividirEmParcelas(total, n);
        const soma = parcelas.reduce((acc, v) => acc + Math.round(v * 100), 0);
        expect(soma).toBe(Math.round(total * 100));
        expect(parcelas).toHaveLength(n);
        expect(Math.min(...parcelas)).toBeGreaterThanOrEqual(0.01);
      }
    }
  });
});

describe('somarMeses', () => {
  it('usa o último dia quando o dia não existe no mês de destino', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2028-01-31', 1)).toBe('2028-02-29');
    expect(somarMeses('2026-01-31', 2)).toBe('2026-03-31');
    expect(somarMeses('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('atravessa a virada do ano', () => {
    expect(somarMeses('2026-11-10', 3)).toBe('2027-02-10');
  });
});

describe('InstallmentsService', () => {
  const userId = 'u1';
  let manager: {
    create: jest.Mock; save: jest.Mock; update: jest.Mock; find: jest.Mock;
    remove: jest.Mock; increment: jest.Mock;
  };
  let service: InstallmentsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-23T15:00:00Z'));
    manager = {
      create: jest.fn((_e, data) => ({ ...data })),
      save: jest.fn(async (a, b) => {
        const alvo = b ?? a;
        if (Array.isArray(alvo)) return alvo;
        return { id: 'compra1', ...alvo };
      }),
      update: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      increment: jest.fn(),
    };
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['select', 'addSelect', 'where', 'groupBy']) qb[m] = jest.fn(() => qb);
    qb.getRawMany = jest.fn(async () => []);

    service = new InstallmentsService(
      { findOne: jest.fn(async () => ({ id: 'compra1', status: 'ativa', parcelas: [] })) } as unknown as Repository<InstallmentPurchase>,
      { createQueryBuilder: () => qb } as unknown as Repository<Transaction>,
      {
        findOne: jest.fn(async ({ where }) => (where.id === 'itau' && where.userId === userId ? { id: 'itau' } : null)),
      } as unknown as Repository<Account>,
      { transaction: (fn: (m: typeof manager) => unknown) => fn(manager) } as unknown as DataSource,
    );
  });

  afterEach(() => jest.useRealTimers());

  const parcelasSalvas = (): Array<Record<string, any>> =>
    manager.save.mock.calls.find(([e, b]) => e === Transaction && Array.isArray(b))![1];

  const base = {
    descricao: 'Notebook', valorTotal: 1200, numeroParcelas: 12,
    accountId: 'itau', categoryId: 'cat1',
  };

  it('gera N parcelas com descrição, competência e vencimentos mensais', async () => {
    await service.create(userId, { ...base, dataCompra: '2026-09-20', primeiroVencimento: '2026-10-10' });

    const parcelas = parcelasSalvas();
    expect(parcelas).toHaveLength(12);
    expect(parcelas[0]).toMatchObject({
      descricao: 'Notebook (1/12)', valor: 100, data: '2026-10-10',
      dataCompetencia: '2026-09-20', tipo: 'despesa', numeroParcela: 1,
      installmentPurchaseId: 'compra1', categoryId: 'cat1',
    });
    expect(parcelas[11]).toMatchObject({ descricao: 'Notebook (12/12)', data: '2027-09-10' });
  });

  it('futuras nascem previstas e não mexem no saldo', async () => {
    await service.create(userId, { ...base, dataCompra: '2026-09-20', primeiroVencimento: '2026-10-10' });

    expect(parcelasSalvas().every((p) => p.confirmada === false)).toBe(true);
    expect(manager.increment).not.toHaveBeenCalled();
  });

  it('compra em andamento: parcelas vencidas até hoje nascem pagas e saem do saldo', async () => {
    // Hoje é 23/09/2026; vencimentos 23/07, 23/08, 23/09 já passaram.
    await service.create(userId, {
      ...base, valorTotal: 600, numeroParcelas: 6, dataCompra: '2026-07-01', primeiroVencimento: '2026-07-23',
    });

    expect(parcelasSalvas().map((p) => p.confirmada)).toEqual([true, true, true, false, false, false]);
    const debitado = manager.increment.mock.calls.reduce((acc, [, , , d]) => acc + d, 0);
    expect(debitado).toBe(-300);
    expect(manager.update).not.toHaveBeenCalled(); // continua ativa
  });

  it('compra toda no passado nasce quitada', async () => {
    await service.create(userId, {
      ...base, valorTotal: 200, numeroParcelas: 2, dataCompra: '2026-01-05', primeiroVencimento: '2026-02-05',
    });

    expect(manager.update).toHaveBeenCalledWith(InstallmentPurchase, 'compra1', { status: 'quitada' });
  });

  it.each([
    ['conta de outro usuário', { accountId: 'conta-alheia' }],
    ['primeiro vencimento antes da compra', { primeiroVencimento: '2026-09-01' }],
    ['menos de um centavo por parcela', { valorTotal: 0.05, numeroParcelas: 10 }],
  ])('recusa %s', async (_caso, extra) => {
    await expect(
      service.create(userId, { ...base, dataCompra: '2026-09-20', primeiroVencimento: '2026-10-10', ...extra }),
    ).rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('cancelar exclui só as previstas e marca cancelada', async () => {
    const previstas = [{ id: 'p4', confirmada: false }, { id: 'p5', confirmada: false }];
    manager.find.mockResolvedValue(previstas);

    await service.cancel('compra1', userId);

    expect(manager.find).toHaveBeenCalledWith(Transaction, {
      where: { installmentPurchaseId: 'compra1', confirmada: false },
    });
    expect(manager.remove).toHaveBeenCalledWith(Transaction, previstas);
    expect(manager.increment).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(InstallmentPurchase, 'compra1', { status: 'cancelada' });
  });

  it('renomear atualiza a descrição de todas as parcelas', async () => {
    const parcelas = [{ numeroParcela: 1 }, { numeroParcela: 2 }];
    manager.find.mockResolvedValue(parcelas);
    (service as any).installmentsRepository.findOne = jest.fn(async () => ({
      id: 'compra1', numeroParcelas: 2, descricao: 'Velho', parcelas: [],
    }));

    await service.update('compra1', userId, { descricao: 'Geladeira' });

    expect(parcelas.map((p: any) => p.descricao)).toEqual(['Geladeira (1/2)', 'Geladeira (2/2)']);
  });
});
