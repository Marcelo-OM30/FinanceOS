import { cicloDaCompra } from './fatura';

describe('cicloDaCompra', () => {
  // Fecha dia 25, vence dia 5 do mês seguinte.
  const nubank = { dataFechamentoFatura: 25, vencimentoFatura: 5 };
  // Fecha dia 3, vence dia 10 do mesmo mês.
  const itau = { dataFechamentoFatura: 3, vencimentoFatura: 10 };

  it('compra até o dia do fechamento entra na fatura que fecha nesse mês', () => {
    expect(cicloDaCompra(nubank, '2026-09-25')).toEqual({
      mes: 9, ano: 2026, dataFechamento: '2026-09-25', dataVencimento: '2026-10-05',
    });
  });

  it('compra depois do fechamento vai para a fatura seguinte', () => {
    expect(cicloDaCompra(nubank, '2026-09-26')).toMatchObject({ mes: 10, dataVencimento: '2026-11-05' });
  });

  it('vencimento depois do fechamento fica no mesmo mês', () => {
    expect(cicloDaCompra(itau, '2026-09-02')).toMatchObject({
      mes: 9, dataFechamento: '2026-09-03', dataVencimento: '2026-09-10',
    });
    expect(cicloDaCompra(itau, '2026-09-04')).toMatchObject({ mes: 10, dataVencimento: '2026-10-10' });
  });

  it('atravessa a virada do ano', () => {
    expect(cicloDaCompra(nubank, '2026-12-28')).toMatchObject({
      mes: 1, ano: 2027, dataFechamento: '2027-01-25', dataVencimento: '2027-02-05',
    });
  });

  it('parcela N cai N−1 faturas depois da primeira', () => {
    expect(cicloDaCompra(nubank, '2026-09-10', 2)).toMatchObject({ mes: 11, dataVencimento: '2026-12-05' });
  });

  it('fechamento maior que os dias do mês usa o último dia', () => {
    const dia31 = { dataFechamentoFatura: 31, vencimentoFatura: 10 };
    expect(cicloDaCompra(dia31, '2026-02-20')).toMatchObject({
      mes: 2, dataFechamento: '2026-02-28', dataVencimento: '2026-03-10',
    });
  });
});
