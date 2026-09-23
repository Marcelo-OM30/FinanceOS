import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Account } from '../../accounts/entities/account.entity';
import { Category } from '../../categories/entities/category.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

/**
 * Compra parcelada. As parcelas são transações comuns (`installmentPurchaseId`,
 * `numeroParcela`), geradas todas de uma vez na criação: as já vencidas nascem
 * realizadas, as futuras previstas.
 */
@Entity('installment_purchases')
@Index(['userId', 'status'])
export class InstallmentPurchase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  accountId!: string;

  // Parcelado no cartão: cada parcela cai numa fatura, a partir da fatura da compra.
  @Column('uuid', { nullable: true })
  cardId?: string | null;

  @Column('uuid', { nullable: true })
  categoryId?: string | null;

  @Column('varchar', { length: 255 })
  descricao!: string;

  @Column('decimal', { precision: 15, scale: 2 })
  valorTotal!: number;

  @Column('int')
  numeroParcelas!: number;

  // Gravado, não derivado: a primeira parcela leva o resíduo do arredondamento
  // e é diferente desta.
  @Column('decimal', { precision: 15, scale: 2 })
  valorParcela!: number;

  // Vira dataCompetencia de todas as parcelas.
  @Column('date')
  dataCompra!: string;

  @Column('date')
  primeiroVencimento!: string;

  @Column('varchar', { length: 20, default: 'ativa' })
  status!: 'ativa' | 'quitada' | 'cancelada';

  @CreateDateColumn()
  dataCriacao!: Date;

  @UpdateDateColumn()
  dataAtualizacao!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  account!: Account;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  category?: Category;

  @OneToMany(() => Transaction, (t) => t.installmentPurchase)
  parcelas?: Transaction[];
}
