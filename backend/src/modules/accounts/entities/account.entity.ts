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
import { Card } from './card.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Entity('accounts')
@Index(['userId'])
@Index(['userId', 'numeroConta'], { unique: true })
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('varchar', { length: 255 })
  nome!: string;

  @Column('varchar', { length: 50 })
  tipo!: string;

  @Column('varchar', { length: 100, nullable: true })
  banco?: string;

  @Column('varchar', { length: 10, nullable: true })
  agencia?: string;

  @Column('varchar', { length: 20, nullable: true })
  numeroConta?: string;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  saldoInicial: number = 0;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  saldoAtual: number = 0;

  @Column('varchar', { length: 3, default: 'BRL' })
  moeda: string = 'BRL';

  @Column('boolean', { default: true })
  ativo: boolean = true;

  @Column('varchar', { length: 20, nullable: true })
  cor?: string;

  @Column('date', { nullable: true })
  dataAbertura?: Date;

  @CreateDateColumn()
  dataCriacao!: Date;

  @UpdateDateColumn()
  dataAtualizacao!: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.accounts, { onDelete: 'CASCADE' })
  user: User;

  @OneToMany(() => Card, (card) => card.account)
  cards: Card[];

  @OneToMany(() => Transaction, (transaction) => transaction.account)
  transactions: Transaction[];
}
