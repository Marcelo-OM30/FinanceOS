import { EntityManager } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';

// Única regra de efeito no saldo das contas. Tudo que cria, edita, confirma ou
// exclui transação passa por aqui — inclusive as parcelas de um parcelamento.

export type EfeitoInput = Pick<
  Transaction,
  'tipo' | 'valor' | 'accountId' | 'contaDestinoId' | 'confirmada'
>;

/**
 * Quanto o saldo de cada conta muda por causa desta transação. Prevista
 * (`confirmada = false`) não muda nada: como create, update e remove sempre
 * desfazem o efeito antigo e aplicam o novo, confirmar e desconfirmar são só
 * uma edição de `confirmada`. Transferência tira da origem e põe no destino,
 * e por isso não entra em nenhum total de receita ou despesa. As antigas, sem
 * destino, só tiram da origem — que é exatamente o que fizeram ao ser criadas.
 */
export function efeitoNoSaldo(t: EfeitoInput): Array<[string, number]> {
  if (!t.confirmada) return [];
  const valor = Number(t.valor);
  if (t.tipo === 'receita') return [[t.accountId, valor]];
  if (t.tipo === 'transferência' && t.contaDestinoId) {
    return [[t.accountId, -valor], [t.contaDestinoId, valor]];
  }
  return [[t.accountId, -valor]];
}

/** `sinal = -1` desfaz o efeito. Incremento no banco, sem ler o saldo antes. */
export async function aplicarNoSaldo(
  manager: EntityManager,
  t: EfeitoInput,
  sinal: 1 | -1,
): Promise<void> {
  for (const [accountId, delta] of efeitoNoSaldo(t)) {
    await manager.increment(Account, { id: accountId }, 'saldoAtual', sinal * delta);
  }
}
