import { Repository } from 'typeorm';
import { AccountsService, chaveDeCriptografia } from './accounts.service';
import { Account } from './entities/account.entity';
import { Card } from './entities/card.entity';

describe('CARD_ENCRYPTION_KEY', () => {
  const original = process.env.CARD_ENCRYPTION_KEY;
  afterEach(() => {
    process.env.CARD_ENCRYPTION_KEY = original;
  });

  const criarService = () =>
    new AccountsService(
      {} as Repository<Account>,
      {} as Repository<Card>,
    );

  it('impede o boot quando a chave falta', () => {
    delete process.env.CARD_ENCRYPTION_KEY;
    expect(criarService).toThrow('CARD_ENCRYPTION_KEY não configurado');
  });

  it.each([
    'default-encryption-key-change-in-prod',
    'change_this_to_a_long_random_string_in_production',
  ])('recusa o valor publicado no repositório %s', (chave) => {
    process.env.CARD_ENCRYPTION_KEY = chave;
    expect(chaveDeCriptografia).toThrow('valor de exemplo');
  });

  it('recusa chave curta', () => {
    process.env.CARD_ENCRYPTION_KEY = 'curta-demais';
    expect(chaveDeCriptografia).toThrow('pelo menos 32 caracteres');
  });

  it('com chave válida, cifra e decifra o número do cartão', () => {
    process.env.CARD_ENCRYPTION_KEY = 'x'.repeat(64);
    const service = criarService() as unknown as {
      encrypt(t: string): string;
      decrypt(t: string): string;
    };

    const cifrado = service.encrypt('4111111111111111');

    expect(cifrado).not.toContain('4111111111111111');
    expect(service.decrypt(cifrado)).toBe('4111111111111111');
  });
});
