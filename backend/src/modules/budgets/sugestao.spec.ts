import { coeficienteDeVariacao, estatisticaDaCategoria, percentil } from './sugestao';

describe('estatisticaDaCategoria', () => {
  it('aluguel: todo mês, quase igual → fixa, pela média', () => {
    const r = estatisticaDaCategoria([2000, 2000, 2000, 2100, 2100, 2100], 24600);
    expect(r).toMatchObject({ classe: 'fixa', sugerido: 2050, mesesComGasto: 6 });
  });

  it('conta de luz lançada atrasada num mês continua fixa, sem o zero puxar o valor', () => {
    const r = estatisticaDaCategoria([180, 0, 190, 185, 175, 180], 2000);
    expect(r).toMatchObject({ classe: 'fixa', sugerido: 182, mesesComGasto: 5 });
  });

  it('mercado varia → variável, pela mediana, que ignora o mês atípico', () => {
    const r = estatisticaDaCategoria([1100, 1200, 1250, 1150, 1300, 4000], 20000);
    expect(r.classe).toBe('variavel');
    expect(r.sugerido).toBe(1225); // a média seria 1666,67
    expect(r.media).toBeCloseTo(1666.67, 2);
  });

  it('IPVA: um mês no ano → esporádica, diluída em 12', () => {
    const r = estatisticaDaCategoria([0, 0, 0, 2400, 0, 0], 2400);
    expect(r).toMatchObject({ classe: 'esporadica', sugerido: 200, mesesComGasto: 1 });
  });

  it('esporádica olha 12 meses, não só os 6', () => {
    // Seguro pago há 8 meses, fora da janela de 6.
    const r = estatisticaDaCategoria([0, 0, 0, 0, 0, 0], 1800);
    expect(r).toMatchObject({ classe: 'esporadica', sugerido: 150 });
  });

  it('muito variável todo mês não é fixa', () => {
    const r = estatisticaDaCategoria([100, 400, 150, 500, 120, 450], 3440);
    expect(r.classe).toBe('variavel');
  });

  it('p75 é a opção "com folga"', () => {
    const r = estatisticaDaCategoria([100, 200, 300, 400, 500, 600], 2100);
    expect(r.p75).toBe(475);
    expect(r.mediana).toBe(350);
  });
});

describe('funções de apoio', () => {
  it('percentil interpola', () => {
    expect(percentil([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentil([], 0.5)).toBe(0);
  });

  it('coeficiente de variação de série constante é zero', () => {
    expect(coeficienteDeVariacao([5, 5, 5])).toBe(0);
  });
});
