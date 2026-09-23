import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Account } from '../../accounts/entities/account.entity';
import { Card } from '../../accounts/entities/card.entity';
import { Category } from '../../categories/entities/category.entity';

@Entity('transactions')
@Index(['userId', 'data'])
@Index(['categoryId'])
@Index(['accountId'])
@Index(['contaDestinoId'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  accountId!: string;

  @Column('uuid', { nullable: true })
  cardId?: string;

  // Só em transferência: a conta que recebe o valor. Transferências gravadas
  // antes desta coluna existir ficam com null e só debitam a origem.
  @Column('uuid', { nullable: true })
  contaDestinoId?: string | null;

  @Column('uuid', { nullable: true })
  categoryId?: string;

  @Column('varchar', { length: 20 })
  tipo!: string;

  @Column('varchar', { length: 255 })
  descricao!: string;

  @Column('decimal', { precision: 15, scale: 2 })
  valor!: number;

  @Column('date')
  data!: Date;

  @Column('date', { nullable: true })
  dataCompetencia?: Date;

  @Column('varchar', { length: 50, default: 'manual' })
  recurso!: string;

  @Column('varchar', { length: 20, nullable: true })
  recorrencia?: string;

  @Column('uuid', { nullable: true })
  recorrenciaGrupoId?: string;

  @Column('date', { nullable: true })
  proximoVencimento?: Date;

  @Column('simple-array', { default: () => 'ARRAY[]::varchar[]' })
  tags: string[] = [];

  @Column('varchar', { length: 50, nullable: true })
  numeroNota?: string;

  @Column('varchar', { length: 255, nullable: true })
  referenciaExterna?: string;

  @Column('boolean', { default: false })
  reconciliada: boolean = false;

  @Column('boolean', { default: true })
  confirmada: boolean = true;

  @CreateDateColumn()
  dataCriacao!: Date;

  @UpdateDateColumn()
  dataAtualizacao!: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'CASCADE' })
  user!: User;

  @ManyToOne(() => Account, (account) => account.transactions, { onDelete: 'CASCADE' })
  account!: Account;

  @ManyToOne(() => Account, { onDelete: 'SET NULL', nullable: true })
  contaDestino?: Account;

  @ManyToOne(() => Card, (card) => card.transactions, { onDelete: 'SET NULL', nullable: true })
  card?: Card;

  @ManyToOne(() => Category, (category) => category.transactions, { nullable: true, onDelete: 'SET NULL' })
  category?: Category;
}
