import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Goal } from './goal.entity';

@Entity('goal_progress')
export class GoalProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  goalId!: string;

  @Column('decimal', { precision: 15, scale: 2 })
  valorAdicionado!: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  percentualProgresso?: number;

  @Column('date', { default: () => 'CURRENT_DATE' })
  dataRegistro!: Date;

  @CreateDateColumn()
  dataCriacao!: Date;

  // Relations
  @ManyToOne(() => Goal, (goal) => goal.progresses, { onDelete: 'CASCADE' })
  goal: Goal;
}
