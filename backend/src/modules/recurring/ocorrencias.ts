import { deslocarMes, diasEntre, diasNoMes, partesDaData, somarMeses } from '../../common/datas';
import { RecurringRule } from './entities/recurring-rule.entity';

type Regra = Pick<
  RecurringRule,
  'frequencia' | 'diaDoMes' | 'mesDoAno' | 'diaDaSemana' | 'dataInicio' | 'dataFim'
>;

const dataCivil = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, diasNoMes(ano, mes))).padStart(2, '0')}`;

/** Dia da semana (0 = domingo) de uma data civil, sem passar pelo fuso do processo. */
function diaDaSemanaDe(data: string): number {
  const { ano, mes, dia } = partesDaData(data);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/**
 * Datas das ocorrências entre `de` e `ate` (inclusive), respeitando início e
 * fim da regra. Dia inexistente no mês (31 em fevereiro) cai no último dia.
 */
export function datasDasOcorrencias(regra: Regra, de: string, ate: string): string[] {
  const inicio = [String(regra.dataInicio).slice(0, 10), de].sort()[1];
  const fim = regra.dataFim ? [String(regra.dataFim).slice(0, 10), ate].sort()[0] : ate;
  if (inicio > fim) return [];

  const datas: string[] = [];
  if (regra.frequencia === 'semanal') {
    const alvo = regra.diaDaSemana ?? diaDaSemanaDe(String(regra.dataInicio));
    const deslocamento = (alvo - diaDaSemanaDe(inicio) + 7) % 7;
    const { ano, mes, dia } = partesDaData(inicio);
    let t = Date.UTC(ano, mes - 1, dia + deslocamento);
    const limite = diasEntre(inicio, fim) - deslocamento;
    for (let i = 0; i <= limite; i += 7) {
      datas.push(new Date(t).toISOString().slice(0, 10));
      t += 7 * 86_400_000;
    }
    return datas;
  }

  const diaBase = regra.diaDoMes ?? partesDaData(String(regra.dataInicio)).dia;
  const passo = regra.frequencia === 'anual' ? 12 : 1;
  const i0 = partesDaData(inicio);
  let cursor =
    regra.frequencia === 'anual'
      ? { ano: i0.ano, mes: regra.mesDoAno ?? partesDaData(String(regra.dataInicio)).mes }
      : { ano: i0.ano, mes: i0.mes };
  // Recua um passo para não perder a ocorrência do primeiro período.
  cursor = deslocarMes(cursor.ano, cursor.mes, -passo);
  for (let n = 0; n < 1000; n++) {
    const data = dataCivil(cursor.ano, cursor.mes, diaBase);
    if (data > fim) break;
    if (data >= inicio) datas.push(data);
    cursor = deslocarMes(cursor.ano, cursor.mes, passo);
  }
  return datas;
}

/** Até onde as previsões vão: 12 meses depois de hoje. */
export const fimDaJanela = (hoje: string) => somarMeses(hoje, 12);
