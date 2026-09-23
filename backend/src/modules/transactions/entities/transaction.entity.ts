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
import { InstallmentPurchase } from '../../installments/entities/installment-purchase.entity';
import { CardInvoice } from '../../card-invoices/entities/card-invoice.entity';

@Entity('transactions')
@Index(['userId', 'data'])
@Index(['userId', 'confirmada', 'data'])
@Index(['categoryId'])
@Index(['accountId'])
@Index(['contaDestinoId'])
@Index(['installmentPurchaseId'])
@Index(['cardInvoiceId'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  accountId!: string;

  // Compra no cartão de crédito: não mexe no saldo; fica prevista até a fatura
  // (cardInvoiceId) ser paga. `data` é o vencimento da fatura e
  // `dataCompetencia`, o dia da compra.
  @Column('uuid', { nullable: true })
  cardId?: string | null;

  @Column('uuid', { nullable: true })
  cardInvoiceId?: string | null;

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

  // true = realizada (o dinheiro se moveu); false = prevista (agendada). Só a
  // realizada mexe no saldo e entra nos totais do mês.
  @Column('boolean', { default: true })
  confirmada: boolean = true;

  // Parcela de uma compra parcelada: não pode ser excluída nem ter valor ou
  // data alterados sozinha, senão a soma das parcelas deixa de fechar o total.
  @Column('uuid', { nullable: true })
  installmentPurchaseId?: string | null;

  @Column('int', { nullable: true })
  numeroParcela?: number | null;

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

  @ManyToOne(() => InstallmentPurchase, (p) => p.parcelas, { nullable: true, onDelete: 'CASCADE' })
  installmentPurchase?: InstallmentPurchase;

  @ManyToOne(() => CardInvoice, (f) => f.transacoes, { nullable: true, onDelete: 'SET NULL' })
  cardInvoice?: CardInvoice;

  @ManyToOne(() => Category, (category) => category.transactions, { nullable: true, onDelete: 'SET NULL' })
  category?: Category;
}
