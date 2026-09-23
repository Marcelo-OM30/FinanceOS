/**
 * Posição a partir dos movimentos, por custo médio ponderado (critério da
 * Receita Federal). Venda não muda o preço médio: só reduz a quantidade e
 * realiza resultado — errar isso é o bug clássico de tracker de carteira.
 */

export interface Movimento {
  tipo: 'compra' | 'venda' | 'dividendo' | 'jcp' | 'rendimento' | 'taxa';
  quantidade: number;
  precoUnitario: number;
  taxas: number;
}

export interface Posicao {
  quantidade: number;
  custoTotal: number;
  precoMedio: number;
  lucroRealizado: number;
  proventos: number;
  taxasAvulsas: number;
}

const EPSILON = 1e-9;

export class VendaMaiorQueAPosicao extends Error {}

/** Os movimentos já em ordem cronológica. */
export function calcularPosicao(movimentos: Movimento[]): Posicao {
  let quantidade = 0;
  let custoTotal = 0;
  let lucroRealizado = 0;
  let proventos = 0;
  let taxasAvulsas = 0;

  for (const m of movimentos) {
    const q = Number(m.quantidade);
    const p = Number(m.precoUnitario);
    const t = Number(m.taxas);
    if (m.tipo === 'compra') {
      custoTotal += q * p + t;
      quantidade += q;
    } else if (m.tipo === 'venda') {
      if (q > quantidade + EPSILON) throw new VendaMaiorQueAPosicao();
      const precoMedio = quantidade > 0 ? custoTotal / quantidade : 0;
      lucroRealizado += q * (p - precoMedio) - t;
      custoTotal -= q * precoMedio;
      quantidade -= q;
      if (quantidade < EPSILON) {
        quantidade = 0;
        custoTotal = 0;
      }
    } else if (m.tipo === 'taxa') {
      taxasAvulsas += p;
    } else {
      proventos += p;
    }
  }

  return {
    quantidade,
    custoTotal,
    precoMedio: quantidade > 0 ? custoTotal / quantidade : 0,
    lucroRealizado,
    proventos,
    taxasAvulsas,
  };
}

/** Quanto o movimento muda o caixa da conta de investimento. */
export function efeitoNoCaixa(m: Movimento): number {
  const q = Number(m.quantidade);
  const p = Number(m.precoUnitario);
  const t = Number(m.taxas);
  switch (m.tipo) {
    case 'compra':
      return -(q * p + t);
    case 'venda':
      return q * p - t;
    case 'taxa':
      return -p;
    default:
      return p;
  }
}
