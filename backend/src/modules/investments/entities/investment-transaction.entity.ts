import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Account } from '../../accounts/entities/account.entity';
import { Asset } from './asset.entity';

/**
 * Movimento de carteira. Mexe no caixa da conta de investimento (saldoAtual):
 * compra tira, venda e proventos põem, taxa tira. A posição (quantidade,
 * preço médio) não é gravada: sai destes movimentos a cada leitura.
 */
@Entity('investment_transactions')
@Index(['userId', 'assetId', 'data'])
export class InvestmentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  accountId!: string;

  @Column('uuid')
  assetId!: string;

  @Column('varchar', { length: 20 })
  tipo!: 'compra' | 'venda' | 'dividendo' | 'jcp' | 'rendimento' | 'taxa';

  // 8 casas: cripto e frações. Zero em provento e taxa.
  @Column('decimal', { precision: 18, scale: 8 })
  quantidade!: number;

  // Em provento e taxa, é o valor recebido/pago.
  @Column('decimal', { precision: 15, scale: 6 })
  precoUnitario!: number;

  // Corretagem, emolumentos.
  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  taxas!: number;

  @Column('date')
  data!: string;

  @CreateDateColumn()
  dataCriacao!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  account!: Account;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  asset!: Asset;
}
