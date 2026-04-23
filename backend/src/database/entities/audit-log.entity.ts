import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index(['userId', 'dataCriacao'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('varchar', { length: 50 })
  acao!: string;

  @Column('varchar', { length: 50, nullable: true })
  entidadeTipo?: string;

  @Column('uuid', { nullable: true })
  entidadeId?: string;

  @Column('jsonb', { nullable: true })
  valoresAnteriores?: Record<string, any>;

  @Column('jsonb', { nullable: true })
  valoresNovos?: Record<string, any>;

  @Column('varchar', { length: 45, nullable: true })
  enderecoIp?: string;

  @Column('text', { nullable: true })
  userAgent?: string;

  @CreateDateColumn()
  dataCriacao!: Date;
}
