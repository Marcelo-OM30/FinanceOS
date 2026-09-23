import {
  deslocarMes,
  diasEntre,
  hojeNoFuso,
  limitesDoMes,
} from './datas';

describe('datas', () => {
  // 30/09 às 23h30 em Brasília — no relógio do servidor (UTC) já é 01/10.
  const ultimaNoiteDeSetembro = new Date('2026-10-01T02:30:00Z');

  describe('hojeNoFuso', () => {
    it('usa o dia do usuário, não o do servidor', () => {
      expect(hojeNoFuso('America/Sao_Paulo', ultimaNoiteDeSetembro)).toBe('2026-09-30');
      expect(hojeNoFuso('UTC', ultimaNoiteDeSetembro)).toBe('2026-10-01');
    });

    it('cai no fuso padrão quando o do usuário falta ou é inválido', () => {
      expect(hojeNoFuso(undefined, ultimaNoiteDeSetembro)).toBe('2026-09-30');
      expect(hojeNoFuso('Marte/Olympus', ultimaNoiteDeSetembro)).toBe('2026-09-30');
    });

    it('respeita fusos a leste de UTC', () => {
      // 20h de 30/09 em UTC já é 01/10 em Tóquio.
      expect(hojeNoFuso('Asia/Tokyo', new Date('2026-09-30T20:00:00Z'))).toBe('2026-10-01');
    });
  });

  it('limitesDoMes acerta o último dia, inclusive em fevereiro bissexto', () => {
    expect(limitesDoMes(2026, 9)).toEqual({ inicio: '2026-09-01', fim: '2026-09-30' });
    expect(limitesDoMes(2028, 2)).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' });
    expect(limitesDoMes(2026, 12)).toEqual({ inicio: '2026-12-01', fim: '2026-12-31' });
  });

  it('deslocarMes atravessa a virada do ano nos dois sentidos', () => {
    expect(deslocarMes(2026, 1, -1)).toEqual({ ano: 2025, mes: 12 });
    expect(deslocarMes(2026, 3, -5)).toEqual({ ano: 2025, mes: 10 });
    expect(deslocarMes(2026, 12, 1)).toEqual({ ano: 2027, mes: 1 });
  });

  it('diasEntre conta dias de calendário, sem efeito de horário de verão', () => {
    expect(diasEntre('2026-09-30', '2026-10-01')).toBe(1);
    expect(diasEntre('2026-09-30', '2026-09-30')).toBe(0);
    expect(diasEntre('2026-10-01', '2026-09-30')).toBe(-1);
    expect(diasEntre('2026-01-01', '2027-01-01')).toBe(365);
  });
});
