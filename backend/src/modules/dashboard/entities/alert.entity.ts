import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('alerts')
@Index(['userId'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('varchar', { length: 50 })
  tipo!: string;

  @Column('text')
  mensagem!: string;

  @Column('text', { nullable: true })
  descricao?: string;

  @Column('varchar', { length: 50, nullable: true })
  entidadeTipo?: string;

  @Column('uuid', { nullable: true })
  entidadeId?: string;

  @Column('varchar', { length: 20, default: 'info' })
  severidade: string = 'info';

  @Column('boolean', { default: false })
  lido: boolean = false;

  @Column('timestamp', { nullable: true })
  dataLeitura?: Date;

  @CreateDateColumn()
  dataCriacao!: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}
