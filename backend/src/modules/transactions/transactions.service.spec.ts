import { BadRequestException } from '@nestjs/common';
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
    const dataSource = { transaction: (fn: (m: typeof manager) => unknown) => fn(manager) };

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
        ...base, tipo: 'transferência', valor: 2000, accountId: 'itau', contaDestinoId: 'nubank',
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
        id: 't1', tipo: 'transferência', valor: '2000.00', accountId: 'itau', contaDestinoId: 'nubank',
      });

      await service.remove('t1', userId);

      expect(variacao()).toEqual({ itau: 2000, nubank: -2000 });
    });

    it('transferência antiga, sem destino, só devolve à origem', async () => {
      transactionsRepository.findOne.mockResolvedValue({
        id: 't1', tipo: 'transferência', valor: '300.00', accountId: 'itau', contaDestinoId: null,
      });

      await service.remove('t1', userId);

      expect(variacao()).toEqual({ itau: 300 });
    });
  });

  describe('update', () => {
    const transferencia = () => ({
      id: 't1', tipo: 'transferência', valor: '2000.00', accountId: 'itau', contaDestinoId: 'nubank',
    });

    it('trocar o destino move o crédito de uma conta para a outra', async () => {
      transactionsRepository.findOne.mockResolvedValue(transferencia());

      await service.update('t1', userId, { contaDestinoId: 'inter' });

      expect(variacao()).toEqual({ itau: 0, nubank: -2000, inter: 2000 });
    });

    it('trocar a conta de origem aplica o débito na conta nova', async () => {
      transactionsRepository.findOne.mockResolvedValue({
        id: 't1', tipo: 'despesa', valor: '50.00', accountId: 'itau', contaDestinoId: null,
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
        id: 't1', tipo: 'transferência', valor: '300.00', accountId: 'itau', contaDestinoId: null,
      });

      await service.update('t1', userId, { descricao: 'renomeada' });

      expect(variacao()).toEqual({ itau: 0 });
    });
  });
});
