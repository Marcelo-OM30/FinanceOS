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
import { Category } from '../../categories/entities/category.entity';

@Entity('budgets')
@Index(['userId', 'mes', 'ano'])
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  categoryId!: string;

  @Column('decimal', { precision: 15, scale: 2 })
  limiteMensal!: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  gastoAtual: number = 0;

  @Column('int')
  mes!: number;

  @Column('int')
  ano!: number;

  @Column('int', { default: 80 })
  alertaPercentual: number = 80;

  @Column('boolean', { default: true })
  ativo: boolean = true;

  @CreateDateColumn()
  dataCriacao!: Date;

  @UpdateDateColumn()
  dataAtualizacao!: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.budgets, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Category, (category) => category.budgets, { onDelete: 'CASCADE' })
  category: Category;
}
