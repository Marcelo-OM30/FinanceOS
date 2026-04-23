import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

export interface BudgetWithProgress extends Budget {
  percentualUtilizado: number;
  emAlerta: boolean;
  estourado: boolean;
}

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private budgetsRepository: Repository<Budget>,
    private transactionsService: TransactionsService,
  ) {}

  async findAll(userId: string, mes?: number, ano?: number): Promise<BudgetWithProgress[]> {
    const where: any = { userId };
    if (mes) where.mes = mes;
    if (ano) where.ano = ano;

    const budgets = await this.budgetsRepository.find({
      where,
      relations: ['category'],
      order: { ano: 'DESC', mes: 'DESC' },
    });

    return Promise.all(budgets.map((b) => this.enrichWithProgress(b)));
  }

  async findOne(id: string, userId: string): Promise<BudgetWithProgress> {
    const budget = await this.budgetsRepository.findOne({
      where: { id, userId },
      relations: ['category'],
    });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    return this.enrichWithProgress(budget);
  }

  async create(userId: string, dto: CreateBudgetDto): Promise<BudgetWithProgress> {
    const existing = await this.budgetsRepository.findOne({
      where: { userId, categoryId: dto.categoryId, mes: dto.mes, ano: dto.ano },
    });
    if (existing) {
      throw new ConflictException('Já existe um orçamento para essa categoria neste período');
    }

    // Calcula gasto atual para o período ao criar
    const gastoAtual = await this.transactionsService.sumByCategory(
      userId,
      dto.categoryId,
      dto.mes,
      dto.ano,
    );

    const budget = this.budgetsRepository.create({
      ...dto,
      userId,
      gastoAtual,
      alertaPercentual: dto.alertaPercentual ?? 80,
    });

    const saved = await this.budgetsRepository.save(budget);
    return this.enrichWithProgress(saved);
  }

  async update(id: string, userId: string, dto: UpdateBudgetDto): Promise<BudgetWithProgress> {
    const budget = await this.budgetsRepository.findOne({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');

    Object.assign(budget, dto);
    const saved = await this.budgetsRepository.save(budget);
    return this.enrichWithProgress(saved);
  }

  async remove(id: string, userId: string): Promise<void> {
    const budget = await this.budgetsRepository.findOne({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    await this.budgetsRepository.remove(budget);
  }

  /**
   * Recalcula gastoAtual de todos os budgets do período.
   * Chamado após criar/editar/excluir uma transação.
   */
  async recalcularGasto(userId: string, categoryId: string, mes: number, ano: number): Promise<void> {
    const budget = await this.budgetsRepository.findOne({
      where: { userId, categoryId, mes, ano },
    });
    if (!budget) return;

    const gastoAtual = await this.transactionsService.sumByCategory(userId, categoryId, mes, ano);
    budget.gastoAtual = gastoAtual;
    await this.budgetsRepository.save(budget);
  }

  private async enrichWithProgress(budget: Budget): Promise<BudgetWithProgress> {
    const percentualUtilizado =
      budget.limiteMensal > 0
        ? Math.round((Number(budget.gastoAtual) / Number(budget.limiteMensal)) * 100)
        : 0;

    return {
      ...budget,
      percentualUtilizado,
      emAlerta: percentualUtilizado >= budget.alertaPercentual && percentualUtilizado < 100,
      estourado: percentualUtilizado >= 100,
    };
  }
}
