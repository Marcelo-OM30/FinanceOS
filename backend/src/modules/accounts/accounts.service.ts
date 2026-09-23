import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { Account } from './entities/account.entity';
import { Card } from './entities/card.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';

// Valores que estão ou estiveram no repositório: quem tem o código decifra.
const CHAVES_PUBLICAS = [
  'default-encryption-key-change-in-prod',
  'change_this_to_a_long_random_string_in_production',
];

/**
 * Sem chave válida o boot falha. Antes havia um default hardcoded: se a
 * variável sumisse do ambiente, os cartões passavam a ser cifrados com uma
 * chave pública, sem nenhum aviso. Trocar a chave de um ambiente com cartões
 * já salvos os torna indecifráveis — ela precisa ter cópia fora do Railway.
 */
export function chaveDeCriptografia(): string {
  const chave = process.env.CARD_ENCRYPTION_KEY;
  if (!chave) {
    throw new Error('CARD_ENCRYPTION_KEY não configurado');
  }
  if (CHAVES_PUBLICAS.includes(chave)) {
    throw new Error('CARD_ENCRYPTION_KEY usa um valor de exemplo publicado no repositório');
  }
  if (chave.length < 32) {
    throw new Error('CARD_ENCRYPTION_KEY precisa ter pelo menos 32 caracteres');
  }
  return chave;
}

@Injectable()
export class AccountsService {
  // AES-256-CBC key derivado da env var CARD_ENCRYPTION_KEY
  private readonly encryptionKey: Buffer;

  constructor(
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
    @InjectRepository(Card)
    private cardsRepository: Repository<Card>,
  ) {
    this.encryptionKey = scryptSync(chaveDeCriptografia(), 'salt', 32);
  }

  // ─── Accounts ───────────────────────────────────────────────────────────────

  async findAllAccounts(userId: string): Promise<Account[]> {
    return this.accountsRepository.find({
      where: { userId },
      order: { dataCriacao: 'ASC' },
    });
  }

  async findOneAccount(id: string, userId: string): Promise<Account> {
    const account = await this.accountsRepository.findOne({ where: { id, userId } });
    if (!account) throw new NotFoundException('Conta não encontrada');
    return account;
  }

  async createAccount(userId: string, dto: CreateAccountDto): Promise<Account> {
    if (dto.numeroConta) {
      const existing = await this.accountsRepository.findOne({
        where: { userId, numeroConta: dto.numeroConta },
      });
      if (existing) throw new ConflictException('Número de conta já cadastrado');
    }

    const saldo = dto.saldoInicial ?? 0;
    const account = this.accountsRepository.create({
      ...dto,
      userId,
      saldoInicial: saldo,
      saldoAtual: saldo,
    });

    return this.accountsRepository.save(account);
  }

  async updateAccount(id: string, userId: string, dto: UpdateAccountDto): Promise<Account> {
    const account = await this.findOneAccount(id, userId);

    if (dto.numeroConta && dto.numeroConta !== account.numeroConta) {
      const existing = await this.accountsRepository.findOne({
        where: { userId, numeroConta: dto.numeroConta },
      });
      if (existing) throw new ConflictException('Número de conta já cadastrado');
    }

    // Mudar o saldo inicial não deve apagar o efeito de transações já
    // lançadas: desloca o saldo atual pela mesma diferença.
    if (dto.saldoInicial !== undefined) {
      const delta = Number(dto.saldoInicial) - Number(account.saldoInicial);
      account.saldoAtual = Number(account.saldoAtual) + delta;
    }

    Object.assign(account, dto);
    return this.accountsRepository.save(account);
  }

  async removeAccount(id: string, userId: string): Promise<void> {
    const account = await this.findOneAccount(id, userId);
    await this.accountsRepository.remove(account);
  }

  // ─── Cards ──────────────────────────────────────────────────────────────────

  async findAllCards(userId: string, accountId?: string): Promise<Card[]> {
    const where: any = { userId };
    if (accountId) where.accountId = accountId;

    return this.cardsRepository.find({
      where,
      order: { dataCriacao: 'ASC' },
    });
  }

  async findOneCard(id: string, userId: string): Promise<Card> {
    const card = await this.cardsRepository.findOne({ where: { id, userId } });
    if (!card) throw new NotFoundException('Cartão não encontrado');
    return card;
  }

  async createCard(userId: string, dto: CreateCardDto): Promise<Card> {
    // Verifica que a conta pertence ao usuário
    await this.findOneAccount(dto.accountId, userId);

    const ultimosDigitos = dto.numero.slice(-4);
    const numeroCriptografado = this.encrypt(dto.numero);

    const card = this.cardsRepository.create({
      userId,
      accountId: dto.accountId,
      nome: dto.nome,
      numeroCriptografado,
      ultimosDigitos,
      tipo: dto.tipo,
      bandeira: dto.bandeira,
      limite: dto.limite,
      vencimentoFatura: dto.vencimentoFatura,
      dataFechamentoFatura: dto.dataFechamentoFatura,
      dataAbertura: dto.dataAbertura as any,
      dataVencimento: dto.dataVencimento as any,
    });

    return this.cardsRepository.save(card);
  }

  async updateCard(id: string, userId: string, dto: UpdateCardDto): Promise<Card> {
    const card = await this.findOneCard(id, userId);
    Object.assign(card, dto);
    return this.cardsRepository.save(card);
  }

  async removeCard(id: string, userId: string): Promise<void> {
    const card = await this.findOneCard(id, userId);
    await this.cardsRepository.remove(card);
  }

  // ─── Encryption helpers ──────────────────────────────────────────────────────

  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, encryptedHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
