import { EntityManager } from 'typeorm';
import { InstallmentPurchase } from './entities/installment-purchase.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

/**
 * Depois de confirmar ou desconfirmar uma parcela: sem previstas, está
 * quitada; com alguma, ativa. Cancelada não volta.
 */
export async function sincronizarStatusDoParcelamento(
  manager: EntityManager,
  installmentPurchaseId: string,
): Promise<void> {
  const compra = await manager.findOne(InstallmentPurchase, { where: { id: installmentPurchaseId } });
  if (!compra || compra.status === 'cancelada') return;
  const previstas = await manager.count(Transaction, {
    where: { installmentPurchaseId, confirmada: false },
  });
  const status = previstas === 0 ? 'quitada' : 'ativa';
  if (status !== compra.status) {
    await manager.update(InstallmentPurchase, installmentPurchaseId, { status });
  }
}
