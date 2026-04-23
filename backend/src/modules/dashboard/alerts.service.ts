import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Alert } from './entities/alert.entity';

export interface CreateAlertData {
  userId: string;
  tipo: string;
  mensagem: string;
  descricao?: string;
  entidadeTipo?: string;
  entidadeId?: string;
  severidade?: 'info' | 'warning' | 'critical';
}

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
  ) {}

  async findAll(
    userId: string,
    lido?: boolean,
    tipo?: string,
  ): Promise<{ data: Alert[]; naoLidos: number }> {
    const where: FindOptionsWhere<Alert> = { userId };
    if (lido !== undefined) where.lido = lido;
    if (tipo) where.tipo = tipo;

    const [data, naoLidos] = await Promise.all([
      this.alertsRepository.find({
        where,
        order: { dataCriacao: 'DESC' },
        take: 50,
      }),
      this.alertsRepository.count({ where: { userId, lido: false } }),
    ]);

    return { data, naoLidos };
  }

  async markAsRead(id: string, userId: string): Promise<Alert> {
    const alert = await this.alertsRepository.findOne({ where: { id, userId } });
    if (!alert) throw new NotFoundException('Alerta não encontrado');

    alert.lido = true;
    alert.dataLeitura = new Date();
    return this.alertsRepository.save(alert);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.alertsRepository.update(
      { userId, lido: false },
      { lido: true, dataLeitura: new Date() },
    );
  }

  async create(data: CreateAlertData): Promise<Alert> {
    const alert = this.alertsRepository.create({
      ...data,
      severidade: data.severidade ?? 'info',
    });
    return this.alertsRepository.save(alert);
  }

  async countUnread(userId: string): Promise<number> {
    return this.alertsRepository.count({ where: { userId, lido: false } });
  }
}
