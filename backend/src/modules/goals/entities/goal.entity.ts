import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { GoalProgress } from './goal-progress.entity';

@Entity('goals')
export class Goal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid', { nullable: true })
  categoryId?: string;

  @Column('varchar', { length: 255 })
  nome!: string;

  @Column('text', { nullable: true })
  descricao?: string;

  @Column('decimal', { precision: 15, scale: 2 })
  valorAlvo!: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  valorAtual: number = 0;

  @Column('date')
  dataInicio!: Date;

  @Column('date')
  dataFim!: Date;

  @Column('varchar', { length: 20, default: 'media' })
  prioridade: string = 'media';

  @Column('varchar', { length: 20, default: 'ativa' })
  status: string = 'ativa';

  @CreateDateColumn()
  dataCriacao!: Date;

  @UpdateDateColumn()
  dataAtualizacao!: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.goals, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Category, (category) => category.goals, { nullable: true, onDelete: 'SET NULL' })
  category: Category;

  @OneToMany(() => GoalProgress, (progress) => progress.goal)
  progresses: GoalProgress[];
}
