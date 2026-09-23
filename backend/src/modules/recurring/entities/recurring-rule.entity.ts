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

/**
 * Conta recorrente (aluguel, salário, assinatura). As ocorrências são
 * transações previstas comuns, com `recurringRuleId`, mantidas sempre para os
 * próximos 12 meses — ver RecurringService.garantirOcorrencias.
 */
@Entity('recurring_rules')
@Index(['userId', 'ativa'])
export class RecurringRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  accountId!: string;

  // No cartão, cada ocorrência vira compra na fatura.
  @Column('uuid', { nullable: true })
  cardId?: string | null;

  @Column('uuid', { nullable: true })
  categoryId?: string | null;

  @Column('varchar', { length: 255 })
  descricao!: string;

  @Column('varchar', { length: 20 })
  tipo!: 'receita' | 'despesa';

  @Column('decimal', { precision: 15, scale: 2 })
  valorEstimado!: number;

  // Luz, água: a previsão usa a média das 3 últimas ocorrências confirmadas.
  @Column('boolean', { default: false })
  valorVariavel!: boolean;

  @Column('varchar', { length: 20 })
  frequencia!: 'semanal' | 'mensal' | 'anual';

  @Column('int', { nullable: true })
  diaDoMes?: number | null;

  @Column('int', { nullable: true })
  mesDoAno?: number | null;

  // 0 = domingo.
  @Column('int', { nullable: true })
  diaDaSemana?: number | null;

  @Column('date')
  dataInicio!: string;

  @Column('date', { nullable: true })
  dataFim?: string | null;

  @Column('boolean', { default: true })
  ativa!: boolean;

  // Ocorrências que o usuário excluiu ("este mês não teve"). Sem isso, a
  // próxima rodada da geração as recriaria.
  @Column('simple-array', { default: '' })
  datasPuladas!: string[];

  @CreateDateColumn()
  dataCriacao!: Date;

  @UpdateDateColumn()
  dataAtualizacao!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  account!: Account;

  @ManyToOne(() => Card, { nullable: true, onDelete: 'CASCADE' })
  card?: Card | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  category?: Category | null;
}
