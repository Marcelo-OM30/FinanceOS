import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from './entities/goal.entity';
import { GoalProgress } from './entities/goal-progress.entity';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { AddProgressDto } from './dto/add-progress.dto';

export interface GoalWithStats extends Goal {
  percentualProgresso: number;
  diasRestantes: number;
  emRisco: boolean;
}

@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(Goal)
    private goalsRepository: Repository<Goal>,
    @InjectRepository(GoalProgress)
    private progressRepository: Repository<GoalProgress>,
  ) {}

  async findAll(userId: string): Promise<GoalWithStats[]> {
    const goals = await this.goalsRepository.find({
      where: { userId },
      relations: ['category'],
      order: { dataFim: 'ASC' },
    });
    return goals.map((g) => this.enrichWithStats(g));
  }

  async findOne(id: string, userId: string): Promise<GoalWithStats> {
    const goal = await this.goalsRepository.findOne({
      where: { id, userId },
      relations: ['category', 'progresses'],
    });
    if (!goal) throw new NotFoundException('Meta não encontrada');
    return this.enrichWithStats(goal);
  }

  async create(userId: string, dto: CreateGoalDto): Promise<GoalWithStats> {
    if (new Date(dto.dataFim) <= new Date(dto.dataInicio)) {
      throw new BadRequestException('dataFim deve ser posterior a dataInicio');
    }

    const goal = this.goalsRepository.create({
      ...dto,
      userId,
      dataInicio: dto.dataInicio as any,
      dataFim: dto.dataFim as any,
      prioridade: dto.prioridade ?? 'media',
      valorAtual: 0,
      status: 'ativa',
    });

    const saved = await this.goalsRepository.save(goal);
    return this.enrichWithStats(saved);
  }

  async update(id: string, userId: string, dto: UpdateGoalDto): Promise<GoalWithStats> {
    const goal = await this.goalsRepository.findOne({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Meta não encontrada');

    if (dto.dataFim) {
      goal.dataFim = dto.dataFim as any;
    }

    Object.assign(goal, dto);
    const saved = await this.goalsRepository.save(goal);
    return this.enrichWithStats(saved);
  }

  async remove(id: string, userId: string): Promise<void> {
    const goal = await this.goalsRepository.findOne({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Meta não encontrada');
    await this.goalsRepository.remove(goal);
  }

  // ─── Progresso ───────────────────────────────────────────────────────────────

  async addProgress(id: string, userId: string, dto: AddProgressDto): Promise<GoalWithStats> {
    const goal = await this.goalsRepository.findOne({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Meta não encontrada');

    if (goal.status !== 'ativa') {
      throw new BadRequestException('Só é possível adicionar progresso a metas ativas');
    }

    const novoValor = Number(goal.valorAtual) + Number(dto.valorAdicionado);
    const percentual = Math.min(
      Math.round((novoValor / Number(goal.valorAlvo)) * 100),
      100,
    );

    // Registra o snapshot de progresso
    const progress = this.progressRepository.create({
      goalId: goal.id,
      valorAdicionado: dto.valorAdicionado,
      percentualProgresso: percentual,
      ...(dto.dataRegistro ? { dataRegistro: dto.dataRegistro as any } : {}),
    });
    await this.progressRepository.save(progress);

    // Atualiza valorAtual e status se concluída
    goal.valorAtual = novoValor;
    if (novoValor >= Number(goal.valorAlvo)) {
      goal.status = 'concluída';
    }

    const saved = await this.goalsRepository.save(goal);
    return this.enrichWithStats(saved);
  }

  async findProgress(id: string, userId: string): Promise<GoalProgress[]> {
    const goal = await this.goalsRepository.findOne({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Meta não encontrada');

    return this.progressRepository.find({
      where: { goalId: id },
      order: { dataRegistro: 'ASC' },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private enrichWithStats(goal: Goal): GoalWithStats {
    const percentualProgresso = goal.valorAlvo > 0
      ? Math.min(Math.round((Number(goal.valorAtual) / Number(goal.valorAlvo)) * 100), 100)
      : 0;

    const hoje = new Date();
    const dataFim = new Date(goal.dataFim);
    const diasRestantes = Math.max(
      0,
      Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // Em risco: ativa, menos de 30% do tempo restante, menos de 80% do valor atingido
    const totalDias = Math.ceil(
      (dataFim.getTime() - new Date(goal.dataInicio).getTime()) / (1000 * 60 * 60 * 24),
    );
    const percentualTempo = totalDias > 0 ? ((totalDias - diasRestantes) / totalDias) * 100 : 100;
    const emRisco =
      goal.status === 'ativa' &&
      percentualTempo > 70 &&
      percentualProgresso < 80;

    return { ...goal, percentualProgresso, diasRestantes, emRisco };
  }
}
