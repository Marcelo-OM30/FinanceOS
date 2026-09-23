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
import { Card } from '../../accounts/entities/card.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

/**
 * Fatura de cartão de crédito. Criada sob demanda, quando a primeira compra
 * cai nela. As compras ficam previstas e não mexem em saldo nenhum; pagar a
 * fatura gera uma saída na conta (transferência sem destino, fora dos totais)
 * e confirma todas as compras de uma vez.
 */
@Entity('card_invoices')
@Index(['cardId', 'mes', 'ano'], { unique: true })
export class CardInvoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  cardId!: string;

  // Mês/ano do fechamento.
  @Column('int')
  mes!: number;

  @Column('int')
  ano!: number;

  @Column('date')
  dataFechamento!: string;

  @Column('date')
  dataVencimento!: string;

  // Soma das compras vinculadas; recalculada a cada mudança nelas.
  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  valorTotal!: number;

  // 'fechada' não é gravado: é 'aberta' com o fechamento já passado.
  @Column('varchar', { length: 20, default: 'aberta' })
  status!: 'aberta' | 'paga';

  @Column('uuid', { nullable: true })
  pagamentoTransactionId?: string | null;

  @CreateDateColumn()
  dataCriacao!: Date;

  @UpdateDateColumn()
  dataAtualizacao!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @ManyToOne(() => Card, { onDelete: 'CASCADE' })
  card!: Card;

  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  pagamentoTransaction?: Transaction | null;

  @OneToMany(() => Transaction, (t) => t.cardInvoice)
  transacoes?: Transaction[];
}
