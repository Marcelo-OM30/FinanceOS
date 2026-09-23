import { calcularPosicao, efeitoNoCaixa, VendaMaiorQueAPosicao } from './posicao';

const compra = (quantidade: number, precoUnitario: number, taxas = 0) =>
  ({ tipo: 'compra', quantidade, precoUnitario, taxas }) as const;
const venda = (quantidade: number, precoUnitario: number, taxas = 0) =>
  ({ tipo: 'venda', quantidade, precoUnitario, taxas }) as const;

describe('calcularPosicao', () => {
  it('preço médio ponderado inclui as taxas', () => {
    const p = calcularPosicao([compra(100, 10, 5), compra(100, 20, 5)]);
    expect(p.quantidade).toBe(200);
    expect(p.custoTotal).toBe(3010);
    expect(p.precoMedio).toBeCloseTo(15.05, 6);
  });

  it('venda não muda o preço médio e realiza o resultado', () => {
    const p = calcularPosicao([compra(100, 10), compra(100, 20), venda(50, 30, 10)]);
    expect(p.quantidade).toBe(150);
    expect(p.precoMedio).toBeCloseTo(15, 6);
    expect(p.custoTotal).toBeCloseTo(2250, 6);
    expect(p.lucroRealizado).toBeCloseTo(50 * (30 - 15) - 10, 6);
  });

  it('zerar a posição e recomprar começa preço médio novo', () => {
    const p = calcularPosicao([compra(10, 10), venda(10, 12), compra(10, 50)]);
    expect(p.precoMedio).toBe(50);
    expect(p.lucroRealizado).toBe(20);
  });

  it('proventos e taxas avulsas não mexem no preço médio', () => {
    const p = calcularPosicao([
      compra(10, 100),
      { tipo: 'dividendo', quantidade: 0, precoUnitario: 12.5, taxas: 0 },
      { tipo: 'jcp', quantidade: 0, precoUnitario: 7.5, taxas: 0 },
      { tipo: 'taxa', quantidade: 0, precoUnitario: 3, taxas: 0 },
    ]);
    expect(p.precoMedio).toBe(100);
    expect(p.proventos).toBe(20);
    expect(p.taxasAvulsas).toBe(3);
  });

  it('frações de cripto', () => {
    const p = calcularPosicao([compra(0.00150000, 300000), venda(0.0005, 350000)]);
    expect(p.quantidade).toBeCloseTo(0.001, 8);
    expect(p.precoMedio).toBeCloseTo(300000, 4);
  });

  it('vender mais do que tem é recusado', () => {
    expect(() => calcularPosicao([compra(10, 10), venda(11, 10)])).toThrow(VendaMaiorQueAPosicao);
  });
});

describe('efeitoNoCaixa', () => {
  it('compra tira quantidade × preço + taxas; venda põe descontando taxas', () => {
    expect(efeitoNoCaixa(compra(10, 25, 4.9))).toBeCloseTo(-254.9, 6);
    expect(efeitoNoCaixa(venda(10, 30, 4.9))).toBeCloseTo(295.1, 6);
  });

  it('provento põe, taxa tira', () => {
    expect(efeitoNoCaixa({ tipo: 'rendimento', quantidade: 0, precoUnitario: 40, taxas: 0 })).toBe(40);
    expect(efeitoNoCaixa({ tipo: 'taxa', quantidade: 0, precoUnitario: 9.9, taxas: 0 })).toBe(-9.9);
  });
});
