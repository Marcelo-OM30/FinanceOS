import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { Category } from '../../categories/entities/category.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Budget } from '../../budgets/entities/budget.entity';
import { Goal } from '../../goals/entities/goal.entity';

@Entity('users')
@Index(['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255, unique: true })
  email!: string;

  @Column('varchar', { length: 255 })
  passwordHash!: string;

  @Column('varchar', { length: 255 })
  nome!: string;

  @Column('varchar', { length: 255, nullable: true })
  avatarUrl?: string;

  @Column('varchar', { length: 20, nullable: true })
  telefone?: string;

  @Column('varchar', { length: 20, nullable: true })
  documento?: string;

  @Column('date', { nullable: true })
  dataNascimento?: Date;

  // Configurações
  @Column('varchar', { length: 3, default: 'BRL' })
  moedaPadrao: string = 'BRL';

  @Column('varchar', { length: 50, default: 'America/Sao_Paulo' })
  timezone: string = 'America/Sao_Paulo';

  @Column('varchar', { length: 20, default: 'light' })
  preferenciaTema: string = 'light';

  // Status
  @Column('boolean', { default: true })
  ativo: boolean = true;

  @Column('boolean', { default: false })
  emailVerificado: boolean = false;

  @CreateDateColumn()
  dataCriacao!: Date;

  @UpdateDateColumn()
  dataAtualizacao!: Date;

  @Column('timestamp', { nullable: true })
  ultimoLogin?: Date;

  @Column('timestamp', { nullable: true })
  dataExclusao?: Date;

  // Relations
  @OneToMany(() => Account, (account) => account.user)
  accounts: Account[];

  @OneToMany(() => Category, (category) => category.user)
  categories: Category[];

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];

  @OneToMany(() => Budget, (budget) => budget.user)
  budgets: Budget[];

  @OneToMany(() => Goal, (goal) => goal.user)
  goals: Goal[];
}
