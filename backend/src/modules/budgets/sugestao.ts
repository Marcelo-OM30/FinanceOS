/**
 * Sugestão de teto por categoria a partir do histórico (spec §5.4). Funções
 * puras: recebem as séries já somadas por mês e só fazem a estatística.
 */

export type ClasseDeGasto = 'fixa' | 'variavel' | 'esporadica';

export interface EstatisticaDaCategoria {
  classe: ClasseDeGasto;
  sugerido: number;
  media: number;
  mediana: number;
  p75: number;
  mesesComGasto: number;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

export function media(valores: number[]): number {
  return valores.length ? valores.reduce((a, v) => a + v, 0) / valores.length : 0;
}

/** Percentil com interpolação linear (p entre 0 e 1). */
export function percentil(valores: number[], p: number): number {
  if (!valores.length) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const pos = (ordenados.length - 1) * p;
  const baixo = Math.floor(pos);
  const alto = Math.ceil(pos);
  return ordenados[baixo] + (ordenados[alto] - ordenados[baixo]) * (pos - baixo);
}

export const mediana = (valores: number[]) => percentil(valores, 0.5);

/** Desvio padrão populacional ÷ média. */
export function coeficienteDeVariacao(valores: number[]): number {
  const m = media(valores);
  if (m === 0) return 0;
  const variancia = media(valores.map((v) => (v - m) ** 2));
  return Math.sqrt(variancia) / m;
}

/**
 * @param ultimos6 gasto de cada um dos 6 meses fechados da janela (zeros inclusos)
 * @param total12 soma dos 12 meses fechados, para as esporádicas
 *
 * - fixa: aparece em ≥ 5 dos 6 meses e varia pouco (CV ≤ 0,15 entre os meses
 *   em que apareceu) → média desses meses. Um mês sem lançamento (a conta de
 *   luz lançada atrasada) não derruba a classificação nem o valor.
 * - variável: aparece em ≥ 3 → mediana dos 6 meses, com zeros. Mediana e não
 *   média: um mês atípico não infla o teto para sempre.
 * - esporádica: ≤ 2 → total de 12 meses ÷ 12. IPVA e seguro são despesa
 *   anual paga de uma vez; diluir é o que impede o mês do vencimento de
 *   estourar o orçamento.
 */
export function estatisticaDaCategoria(ultimos6: number[], total12: number): EstatisticaDaCategoria {
  const comGasto = ultimos6.filter((v) => v > 0);
  const base = {
    media: centavos(media(ultimos6)),
    mediana: centavos(mediana(ultimos6)),
    p75: centavos(percentil(ultimos6, 0.75)),
    mesesComGasto: comGasto.length,
  };
  if (comGasto.length >= 5 && coeficienteDeVariacao(comGasto) <= 0.15) {
    return { ...base, classe: 'fixa', sugerido: centavos(media(comGasto)) };
  }
  if (comGasto.length >= 3) {
    return { ...base, classe: 'variavel', sugerido: base.mediana };
  }
  return { ...base, classe: 'esporadica', sugerido: centavos(total12 / 12) };
}
