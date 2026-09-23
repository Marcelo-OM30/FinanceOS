import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** Ativo do catálogo. userId nulo = global, como em categories. */
@Entity('assets')
@Index(['userId', 'ticker'])
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  userId?: string | null;

  @Column('varchar', { length: 20 })
  ticker!: string;

  @Column('varchar', { length: 255 })
  nome!: string;

  @Column('varchar', { length: 20 })
  tipo!: 'acao' | 'fii' | 'etf' | 'bdr' | 'tesouro' | 'cripto' | 'renda_fixa';

  @Column('varchar', { length: 3, default: 'BRL' })
  moeda!: string;

  // brapi: cotação automática; manual: o usuário informa (renda fixa, CDB).
  @Column('varchar', { length: 20, default: 'manual' })
  fonteCotacao!: 'brapi' | 'manual';

  @CreateDateColumn()
  dataCriacao!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  user?: User | null;
}
