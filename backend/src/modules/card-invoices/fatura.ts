import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CardInvoice } from './entities/card-invoice.entity';
import { Card } from '../accounts/entities/card.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { deslocarMes, diasNoMes, partesDaData } from '../../common/datas';

export interface CicloDaFatura {
  mes: number;
  ano: number;
  dataFechamento: string;
  dataVencimento: string;
}

const dataCivil = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, diasNoMes(ano, mes))).padStart(2, '0')}`;

/** Fechamento e vencimento da fatura que fecha em mes/ano. */
export function cicloDoMes(
  card: Pick<Card, 'dataFechamentoFatura' | 'vencimentoFatura'>,
  ano: number,
  mes: number,
): CicloDaFatura {
  const fechamento = card.dataFechamentoFatura!;
  const vencimento = card.vencimentoFatura!;
  // Fecha dia 28 e vence dia 5: o vencimento é no mês seguinte ao fechamento.
  const mesVenc = vencimento > fechamento ? { ano, mes } : deslocarMes(ano, mes, 1);
  return {
    mes,
    ano,
    dataFechamento: dataCivil(ano, mes, fechamento),
    dataVencimento: dataCivil(mesVenc.ano, mesVenc.mes, vencimento),
  };
}

/**
 * Em qual fatura cai uma compra: a primeira cujo fechamento é no dia da
 * compra ou depois. `mesesDepois` desloca para a fatura seguinte — é como a
 * parcela N de uma compra parcelada cai N−1 faturas depois da primeira.
 */
export function cicloDaCompra(
  card: Pick<Card, 'dataFechamentoFatura' | 'vencimentoFatura'>,
  dataCompra: string,
  mesesDepois = 0,
): CicloDaFatura {
  const { ano, mes, dia } = partesDaData(dataCompra);
  const fechamentoNoMes = Math.min(card.dataFechamentoFatura!, diasNoMes(ano, mes));
  const base = dia <= fechamentoNoMes ? { ano, mes } : deslocarMes(ano, mes, 1);
  const alvo = deslocarMes(base.ano, base.mes, mesesDepois);
  return cicloDoMes(card, alvo.ano, alvo.mes);
}

/** Cartão que pode receber compra: do usuário, de crédito, ativo, com ciclo definido. */
export async function cartaoParaCompra(
  manager: EntityManager,
  userId: string,
  cardId: string,
): Promise<Card> {
  const card = await manager.findOne(Card, { where: { id: cardId, userId } });
  if (!card) throw new BadRequestException('Cartão não encontrado');
  if (card.tipo !== 'crédito') {
    throw new BadRequestException('Só cartão de crédito tem fatura; compra no débito é lançada na conta');
  }
  if (!card.ativo) throw new BadRequestException('Cartão desativado');
  if (!card.dataFechamentoFatura || !card.vencimentoFatura) {
    throw new BadRequestException('Defina o dia de fechamento e o de vencimento da fatura do cartão');
  }
  return card;
}

/** A fatura do ciclo, criada se ainda não existe. Recusa se já estiver paga. */
export async function faturaAberta(
  manager: EntityManager,
  card: Card,
  ciclo: CicloDaFatura,
): Promise<CardInvoice> {
  let fatura = await manager.findOne(CardInvoice, {
    where: { cardId: card.id, mes: ciclo.mes, ano: ciclo.ano },
  });
  if (!fatura) {
    fatura = await manager.save(
      manager.create(CardInvoice, {
        userId: card.userId,
        cardId: card.id,
        ...ciclo,
        valorTotal: 0,
        status: 'aberta',
      }),
    );
  }
  if (fatura.status === 'paga') {
    throw new ConflictException(
      `A fatura de ${String(ciclo.mes).padStart(2, '0')}/${ciclo.ano} já foi paga; desfaça o pagamento antes`,
    );
  }
  return fatura;
}

/**
 * Atualiza o total. Fatura aberta que ficou sem compras (a única foi excluída,
 * o parcelamento foi cancelado) deixa de existir; renasce se outra compra cair
 * no mesmo ciclo.
 */
export async function recalcularFatura(manager: EntityManager, cardInvoiceId: string): Promise<void> {
  const r = await manager
    .createQueryBuilder(Transaction, 't')
    .select('COALESCE(SUM(t.valor), 0)', 'total')
    .addSelect('COUNT(*)', 'compras')
    .where('t.cardInvoiceId = :id', { id: cardInvoiceId })
    .getRawOne<{ total: string; compras: string }>();
  if (Number(r?.compras ?? 0) === 0) {
    await manager.delete(CardInvoice, { id: cardInvoiceId, status: 'aberta' });
    return;
  }
  await manager.update(CardInvoice, cardInvoiceId, { valorTotal: Number(r?.total ?? 0) });
}
