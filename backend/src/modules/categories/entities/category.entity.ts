import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Budget } from '../../budgets/entities/budget.entity';
import { Goal } from '../../goals/entities/goal.entity';

@Entity('categories')
@Index(['userId', 'nome'], { unique: true })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  userId?: string;

  @Column('varchar', { length: 100 })
  nome!: string;

  @Column('text', { nullable: true })
  descricao?: string;

  @Column('varchar', { length: 50, nullable: true })
  icone?: string;

  @Column('varchar', { length: 7, nullable: true })
  cor?: string;

  @Column('varchar', { length: 20 })
  tipo!: string;

  @Column('uuid', { nullable: true })
  categoriaPaiId?: string;

  @Column('boolean', { default: false })
  customizada: boolean = false;

  @Column('boolean', { default: true })
  ativo: boolean = true;

  @CreateDateColumn()
  dataCriacao!: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.categories, { onDelete: 'CASCADE', nullable: true })
  user: User;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  categoriaPai: Category;

  @OneToMany(() => Transaction, (transaction) => transaction.category)
  transactions: Transaction[];

  @OneToMany(() => Budget, (budget) => budget.category)
  budgets: Budget[];

  @OneToMany(() => Goal, (goal) => goal.category)
  goals: Goal[];
}
