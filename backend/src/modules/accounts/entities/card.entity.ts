import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Account } from './account.entity';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Entity('cards')
export class Card {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  accountId!: string;

  @Column('varchar', { length: 255 })
  nome!: string;

  @Column('varchar', { length: 255 })
  numeroCriptografado!: string;

  @Column('varchar', { length: 4, nullable: true })
  ultimosDigitos?: string;

  @Column('varchar', { length: 20 })
  tipo!: string;

  @Column('varchar', { length: 50, nullable: true })
  bandeira?: string;

  @Column('decimal', { precision: 15, scale: 2, nullable: true })
  limite?: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  limiteUtilizado: number = 0;

  @Column('int', { nullable: true })
  vencimentoFatura?: number;

  @Column('int', { nullable: true })
  dataFechamentoFatura?: number;

  @Column('boolean', { default: true })
  ativo: boolean = true;

  @Column('date', { nullable: true })
  dataAbertura?: Date;

  @Column('date', { nullable: true })
  dataVencimento?: Date;

  @CreateDateColumn()
  dataCriacao!: Date;

  @UpdateDateColumn()
  dataAtualizacao!: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Account, (account) => account.cards, { onDelete: 'CASCADE' })
  account: Account;

  @OneToMany(() => Transaction, (transaction) => transaction.card)
  transactions: Transaction[];
}
