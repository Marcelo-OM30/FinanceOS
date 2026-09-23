import { datasDasOcorrencias, fimDaJanela } from './ocorrencias';

const base = { diaDoMes: null, mesDoAno: null, diaDaSemana: null, dataFim: null };

describe('datasDasOcorrencias', () => {
  it('mensal: um por mês, no dia escolhido, a partir de hoje', () => {
    const r = datasDasOcorrencias(
      { ...base, frequencia: 'mensal', diaDoMes: 5, dataInicio: '2026-01-05' },
      '2026-09-23',
      '2027-01-31',
    );
    expect(r).toEqual(['2026-10-05', '2026-11-05', '2026-12-05', '2027-01-05']);
  });

  it('mensal no dia 31 cai no último dia dos meses curtos', () => {
    const r = datasDasOcorrencias(
      { ...base, frequencia: 'mensal', diaDoMes: 31, dataInicio: '2026-01-31' },
      '2027-01-01',
      '2027-04-30',
    );
    expect(r).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });

  it('inclui a ocorrência de hoje', () => {
    const r = datasDasOcorrencias(
      { ...base, frequencia: 'mensal', diaDoMes: 23, dataInicio: '2026-01-23' },
      '2026-09-23',
      '2026-10-31',
    );
    expect(r).toEqual(['2026-09-23', '2026-10-23']);
  });

  it('respeita início futuro e data de fim', () => {
    const r = datasDasOcorrencias(
      { ...base, frequencia: 'mensal', diaDoMes: 10, dataInicio: '2026-11-10', dataFim: '2027-01-15' },
      '2026-09-23',
      '2027-09-23',
    );
    expect(r).toEqual(['2026-11-10', '2026-12-10', '2027-01-10']);
  });

  it('semanal: toda semana no dia escolhido', () => {
    // 23/09/2026 é quarta; dia 1 = segunda.
    const r = datasDasOcorrencias(
      { ...base, frequencia: 'semanal', diaDaSemana: 1, dataInicio: '2026-01-01' },
      '2026-09-23',
      '2026-10-13',
    );
    expect(r).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
  });

  it('anual: uma vez por ano no mês e dia', () => {
    const r = datasDasOcorrencias(
      { ...base, frequencia: 'anual', diaDoMes: 15, mesDoAno: 3, dataInicio: '2025-03-15' },
      '2026-09-23',
      fimDaJanela('2026-09-23'),
    );
    expect(r).toEqual(['2027-03-15']);
  });

  it('a janela padrão é de 12 meses', () => {
    const r = datasDasOcorrencias(
      { ...base, frequencia: 'mensal', diaDoMes: 1, dataInicio: '2020-01-01' },
      '2026-09-23',
      fimDaJanela('2026-09-23'),
    );
    expect(r).toHaveLength(12);
    expect(r[0]).toBe('2026-10-01');
    expect(r[11]).toBe('2027-09-01');
  });
});
