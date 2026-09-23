/**
 * Datas de calendário (`YYYY-MM-DD`) no fuso do usuário.
 *
 * O servidor roda em UTC e o usuário, em geral, em America/Sao_Paulo. Entre 21h
 * e a meia-noite de Brasília o relógio do servidor já está no dia seguinte — e,
 * no último dia do mês, no mês seguinte. Todo "hoje" e todo "mês atual" do
 * backend sai daqui. As colunas `date` do banco são comparadas como texto, sem
 * passar por `Date`, que reintroduziria o fuso do processo.
 */

export const FUSO_PADRAO = 'America/Sao_Paulo';

export interface DataCivil {
  ano: number;
  mes: number;
  dia: number;
}

export function fusoValido(fuso: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

/** Hoje no fuso informado; fuso ausente ou inválido cai no padrão. */
export function hojeNoFuso(fuso?: string | null, agora: Date = new Date()): string {
  const timeZone = fuso && fusoValido(fuso) ? fuso : FUSO_PADRAO;
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export function partesDaData(data: string): DataCivil {
  const [ano, mes, dia] = data.slice(0, 10).split('-').map(Number);
  return { ano, mes, dia };
}

/**
 * Coluna `date` lida do banco vem como texto; depois de um `save` com o valor
 * do DTO, também. Só por garantia aceita `Date`, lida como meia-noite UTC.
 */
export function comoData(valor: string | Date): string {
  return typeof valor === 'string' ? valor.slice(0, 10) : valor.toISOString().slice(0, 10);
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function limitesDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  const mm = String(mes).padStart(2, '0');
  const ultimo = String(diasNoMes(ano, mes)).padStart(2, '0');
  return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${ultimo}` };
}

/** O mês `delta` meses depois (negativo: antes). */
export function deslocarMes(ano: number, mes: number, delta: number): { ano: number; mes: number } {
  const indice = ano * 12 + (mes - 1) + delta;
  return { ano: Math.floor(indice / 12), mes: (((indice % 12) + 12) % 12) + 1 };
}

/** Dias de calendário de `de` até `ate` (negativo se `ate` vier antes). */
export function diasEntre(de: string, ate: string): number {
  const utc = ({ ano, mes, dia }: DataCivil) => Date.UTC(ano, mes - 1, dia);
  return Math.round((utc(partesDaData(ate)) - utc(partesDaData(de))) / 86_400_000);
}

/**
 * Soma meses a uma data. Se o dia não existe no mês de destino (31/01 + 1 mês),
 * usa o último dia do mês — nunca transborda para o mês seguinte.
 */
export function somarMeses(data: string, meses: number): string {
  const { ano, mes, dia } = partesDaData(data);
  const destino = deslocarMes(ano, mes, meses);
  const d = Math.min(dia, diasNoMes(destino.ano, destino.mes));
  return `${destino.ano}-${String(destino.mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
