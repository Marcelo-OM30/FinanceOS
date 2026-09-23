import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';

describe('TransactionsService — efeito no saldo', () => {
  const userId = 'u1';
  const contasDoUsuario = ['itau', 'nubank', 'inter'];

  let manager: { create: jest.Mock; save: jest.Mock; remove: jest.Mock; increment: jest.Mock };
  let transactionsRepository: { findOne: jest.Mock };
  let accountsRepository: { findOne: jest.Mock };
  let service: TransactionsService;
  let faturaRepo: { findOne: jest.Mock };

  beforeEach(() => {
    manager = {
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn(async (_entity, t) => ({ id: 't1', ...t })),
      remove: jest.fn(),
      increment: jest.fn(),
    };
    transactionsRepository = { findOne: jest.fn() };
    accountsRepository = {
      findOne: jest.fn(async ({ where }) =>
        where.userId === userId && contasDoUsuario.includes(where.id) ? { id: where.id } : null,
      ),
    };
    faturaRepo = { findOne: jest.fn(async () => null) };
    const dataSource = {
      transaction: (fn: (m: typeof manager) => unknown) => fn(manager),
      getRepository: () => faturaRepo,
    };

    service = new TransactionsService(
      transactionsRepository as unknown as Repository<Transaction>,
      accountsRepository as unknown as Repository<Account>,
      dataSource as unknown as DataSource,
    );
  });

  // Soma dos incrementos por conta — o que o saldo de cada uma variou.
  const variacao = () =>
    manager.increment.mock.calls.reduce<Record<string, number>>((acc, [, { id }, , delta]) => {
      acc[id] = (acc[id] ?? 0) + delta;
      return acc;
    }, {});

  const base = { descricao: 'x', data: '2026-09-23' };

  describe('create', () => {
    it('transferência tira da origem e põe no destino', async () => {
      await service.create(userId, {
        ...base, tipo: 'transferência', valor: 2000, accountId: 'itau', contaDestinoId: 'nubank', confirmada: true,
      });

      expect(variacao()).toEqual({ itau: -2000, nubank: 2000 });
    });

    it('despesa e receita continuam mexendo só na própria conta', async () => {
      await service.create(userId, { ...base, tipo: 'despesa', valor: 50, accountId: 'itau' });
      await service.create(userId, { ...base, tipo: 'receita', valor: 80, accountId: 'itau' });

      expect(variacao()).toEqual({ itau: 30 });
    });

    it.each([
      ['sem destino', { contaDestinoId: undefined }],
      ['destino igual à origem', { contaDestinoId: 'itau' }],
      ['destino de outro usuário', { contaDestinoId: 'conta-alheia' }],
      ['lançada em cartão', { contaDestinoId: 'nubank', cardId: 'c1' }],
    ])('recusa transferência %s', async (_caso, extra) => {
      await expect(
        service.create(userId, {
          ...base, tipo: 'transferência', valor: 10, accountId: 'itau', ...extra,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('recusa conta de destino em despesa', async () => {
      await expect(
        service.create(userId, {
          ...base, tipo: 'despesa', valor: 10, accountId: 'itau', contaDestinoId: 'nubank',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('desfaz os dois lados da transferência', async () => {
      transactionsRepository.findOne.mockResolvedValue({
        id: 't1', tipo: 'transferência', valor: '2000.00', accountId: 'itau', contaDestinoId: 'nubank', confirmada: true,
      });

      await service.remove('t1', userId);

      expect(variacao()).toEqual({ itau: 2000, nubank: -2000 });
    });

    it('transferência antiga, sem destino, só devolve à origem', async () => {
      transactionsRepository.findOne.mockResolvedValue({
        id: 't1', tipo: 'transferência', valor: '300.00', accountId: 'itau', contaDestinoId: null, confirmada: true,
      });

      await service.remove('t1', userId);

      expect(variacao()).toEqual({ itau: 300 });
    });
  });

  describe('update', () => {
    const transferencia = () => ({
      id: 't1', tipo: 'transferência', valor: '2000.00', accountId: 'itau', contaDestinoId: 'nubank',
      confirmada: true,
    });

    it('trocar o destino move o crédito de uma conta para a outra', async () => {
      transactionsRepository.findOne.mockResolvedValue(transferencia());

      await service.update('t1', userId, { contaDestinoId: 'inter' });

      expect(variacao()).toEqual({ itau: 0, nubank: -2000, inter: 2000 });
    });

    it('trocar a conta de origem aplica o débito na conta nova', async () => {
      transactionsRepository.findOne.mockResolvedValue({
        id: 't1', tipo: 'despesa', valor: '50.00', accountId: 'itau', contaDestinoId: null, confirmada: true,
      });

      await service.update('t1', userId, { accountId: 'inter' });

      expect(variacao()).toEqual({ itau: 50, inter: -50 });
    });

    it('virar despesa apaga o destino e devolve o crédito', async () => {
      transactionsRepository.findOne.mockResolvedValue(transferencia());

      await service.update('t1', userId, { tipo: 'despesa' });

      const salva = manager.save.mock.calls[0][1];
      expect(salva.contaDestinoId).toBeNull();
      expect(variacao()).toEqual({ itau: 0, nubank: -2000 });
    });

    it('transferência antiga continua editável sem ganhar destino', async () => {
      transactionsRepository.findOne.mockResolvedValue({
        id: 't1', tipo: 'transferência', valor: '300.00', accountId: 'itau', contaDestinoId: null, confirmada: true,
      });

      await service.update('t1', userId, { descricao: 'renomeada' });

      expect(variacao()).toEqual({ itau: 0 });
    });
  });

  describe('previsto × realizado', () => {
    // Cada leitura devolve uma cópia nova, como o banco faria.
    const noBanco = (t: Record<string, unknown>) =>
      transactionsRepository.findOne.mockImplementation(async () => ({ ...t }));

    it('prevista não mexe no saldo ao ser criada', async () => {
      await service.create(userId, {
        ...base, tipo: 'despesa', valor: 3000, accountId: 'itau', confirmada: false,
      });

      expect(manager.increment).not.toHaveBeenCalled();
      expect(manager.save.mock.calls[0][1].confirmada).toBe(false);
    });

    it('sem confirmada no payload, nasce realizada', async () => {
      await service.create(userId, { ...base, tipo: 'despesa', valor: 10, accountId: 'itau' });

      expect(manager.save.mock.calls[0][1].confirmada).toBe(true);
    });

    it('confirmar aplica o valor no saldo', async () => {
      noBanco({ id: 't1', tipo: 'despesa', valor: '3000.00', accountId: 'itau', confirmada: false });

      await service.confirmar('t1', userId);

      expect(variacao()).toEqual({ itau: -3000 });
    });

    it('confirmar transferência prevista move entre as duas contas', async () => {
      noBanco({
        id: 't1', tipo: 'transferência', valor: '500.00', accountId: 'itau',
        contaDestinoId: 'nubank', confirmada: false,
      });

      await service.confirmar('t1', userId);

      expect(variacao()).toEqual({ itau: -500, nubank: 500 });
    });

    it('desconfirmar tira o valor do saldo', async () => {
      noBanco({ id: 't1', tipo: 'receita', valor: '5000.00', accountId: 'itau', confirmada: true });

      await service.desconfirmar('t1', userId);

      expect(variacao()).toEqual({ itau: -5000 });
    });

    it('confirmar o que já está confirmado dá conflito e não mexe em nada', async () => {
      noBanco({ id: 't1', tipo: 'despesa', valor: '10.00', accountId: 'itau', confirmada: true });

      await expect(service.confirmar('t1', userId)).rejects.toThrow(ConflictException);
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('desconfirmar o que já está previsto dá conflito', async () => {
      noBanco({ id: 't1', tipo: 'despesa', valor: '10.00', accountId: 'itau', confirmada: false });

      await expect(service.desconfirmar('t1', userId)).rejects.toThrow(ConflictException);
    });

    it('editar o valor de uma prevista não mexe no saldo', async () => {
      noBanco({ id: 't1', tipo: 'despesa', valor: '10.00', accountId: 'itau', confirmada: false });

      await service.update('t1', userId, { valor: 99 });

      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('excluir uma prevista não mexe no saldo', async () => {
      noBanco({ id: 't1', tipo: 'despesa', valor: '10.00', accountId: 'itau', confirmada: false });

      await service.remove('t1', userId);

      expect(manager.increment).not.toHaveBeenCalled();
      expect(manager.remove).toHaveBeenCalled();
    });
  });

  describe('parcela de parcelamento', () => {
    const parcela = (extra: Record<string, unknown> = {}) => ({
      id: 't1', tipo: 'despesa', valor: '100.00', accountId: 'itau', contaDestinoId: null,
      confirmada: false, installmentPurchaseId: 'compra1', numeroParcela: 3, ...extra,
    });

    beforeEach(() => {
      Object.assign(manager, {
        findOne: jest.fn(async () => ({ id: 'compra1', status: 'ativa' })),
        count: jest.fn(async () => 0),
        update: jest.fn(),
      });
    });

    it('não pode ser excluída sozinha', async () => {
      transactionsRepository.findOne.mockResolvedValue(parcela());

      await expect(service.remove('t1', userId)).rejects.toThrow(ConflictException);
      expect(manager.remove).not.toHaveBeenCalled();
    });

    it.each([['valor', { valor: 50 }], ['data', { data: '2026-12-01' }], ['conta', { accountId: 'inter' }]])(
      'não pode ter %s alterado sozinha',
      async (_campo, dto) => {
        transactionsRepository.findOne.mockResolvedValue(parcela());

        await expect(service.update('t1', userId, dto)).rejects.toThrow(BadRequestException);
      },
    );

    it('pode mudar a categoria', async () => {
      transactionsRepository.findOne.mockResolvedValue(parcela());

      await expect(service.update('t1', userId, { categoryId: 'cat2' })).resolves.toBeDefined();
    });

    it('confirmar a última prevista quita o parcelamento', async () => {
      transactionsRepository.findOne.mockImplementation(async () => parcela());

      await service.confirmar('t1', userId);

      expect((manager as any).update).toHaveBeenCalledWith(expect.anything(), 'compra1', { status: 'quitada' });
    });

    it('parcela paga de parcelamento cancelado não volta a prevista', async () => {
      transactionsRepository.findOne.mockResolvedValue(
        parcela({ confirmada: true, installmentPurchase: { status: 'cancelada' } }),
      );

      await expect(service.desconfirmar('t1', userId)).rejects.toThrow(ConflictException);
    });
  });

  describe('compra no cartão', () => {
    const compra = (extra: Record<string, unknown> = {}) => ({
      id: 't1', tipo: 'despesa', valor: '80.00', accountId: 'itau', contaDestinoId: null,
      confirmada: false, cardId: 'c1', cardInvoiceId: 'f1', ...extra,
    });

    beforeEach(() => {
      Object.assign(manager, {
        findOne: jest.fn(async (entidade: { name: string }, { where }: { where: Record<string, unknown> }) => {
          if (entidade.name === 'Card') {
            return where.id === 'c1'
              ? { id: 'c1', userId, accountId: 'itau', tipo: 'crédito', ativo: true, dataFechamentoFatura: 25, vencimentoFatura: 5 }
              : null;
          }
          return { id: 'f1', status: 'aberta', dataVencimento: '2026-10-05', ...where };
        }),
        createQueryBuilder: jest.fn(() => {
          const qb: Record<string, jest.Mock> = {};
          qb.select = qb.addSelect = qb.where = jest.fn(() => qb);
          qb.getRawOne = jest.fn(async () => ({ total: '80', compras: '1' }));
          return qb;
        }),
        update: jest.fn(),
      });
      transactionsRepository.findOne.mockImplementation(async () => compra());
    });

    it('cai na fatura, fica prevista, não mexe no saldo e grava vencimento e competência', async () => {
      await service.create(userId, {
        ...base, data: '2026-09-23', tipo: 'despesa', valor: 80, accountId: 'itau', cardId: 'c1',
      });

      const [primeiro, segundo] = manager.save.mock.calls[0];
      const salva = segundo ?? primeiro;
      expect(salva).toMatchObject({
        cardId: 'c1', cardInvoiceId: 'f1', confirmada: false,
        data: '2026-10-05', dataCompetencia: '2026-09-23', accountId: 'itau',
      });
      expect(manager.increment).not.toHaveBeenCalled();
      expect((manager as any).update).toHaveBeenCalledWith(expect.anything(), 'f1', { valorTotal: 80 });
    });

    it('recusa receita no cartão', async () => {
      await expect(
        service.create(userId, { ...base, tipo: 'receita', valor: 80, accountId: 'itau', cardId: 'c1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('não se confirma sozinha: é o pagamento da fatura que confirma', async () => {
      await expect(service.confirmar('t1', userId)).rejects.toThrow(ConflictException);
    });

    it('não pode mudar de data (mudaria de fatura)', async () => {
      await expect(service.update('t1', userId, { data: '2026-11-01' })).rejects.toThrow(BadRequestException);
    });

    it('com a fatura paga, não pode ser excluída nem mudar de valor', async () => {
      faturaRepo.findOne.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        where.id === 'f1' ? { id: 'f1', status: 'paga' } : null,
      );

      await expect(service.remove('t1', userId)).rejects.toThrow(ConflictException);
      await expect(service.update('t1', userId, { valor: 10 })).rejects.toThrow(ConflictException);
    });

    it('excluir recalcula a fatura', async () => {
      await service.remove('t1', userId);

      expect(manager.remove).toHaveBeenCalled();
      expect((manager as any).update).toHaveBeenCalledWith(expect.anything(), 'f1', { valorTotal: 80 });
    });

    it('o pagamento de uma fatura não se edita nem se exclui pela transação', async () => {
      transactionsRepository.findOne.mockImplementation(async () => ({
        id: 'pg', tipo: 'transferência', valor: '80.00', accountId: 'itau', contaDestinoId: null, confirmada: true,
      }));
      faturaRepo.findOne.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        where.pagamentoTransactionId === 'pg' ? { id: 'f1' } : null,
      );

      await expect(service.remove('pg', userId)).rejects.toThrow(ConflictException);
      await expect(service.update('pg', userId, { valor: 1 })).rejects.toThrow(ConflictException);
    });
  });
});
