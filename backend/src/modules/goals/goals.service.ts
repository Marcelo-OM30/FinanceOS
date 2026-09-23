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
import { comoData, diasEntre, hojeNoFuso } from '../../common/datas';

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

  async findAll(userId: string, fuso?: string): Promise<GoalWithStats[]> {
    const goals = await this.goalsRepository.find({
      where: { userId },
      relations: ['category'],
      order: { dataFim: 'ASC' },
    });
    return goals.map((g) => this.enrichWithStats(g, fuso));
  }

  async findOne(id: string, userId: string, fuso?: string): Promise<GoalWithStats> {
    const goal = await this.goalsRepository.findOne({
      where: { id, userId },
      relations: ['category', 'progresses'],
    });
    if (!goal) throw new NotFoundException('Meta não encontrada');
    return this.enrichWithStats(goal, fuso);
  }

  async create(userId: string, dto: CreateGoalDto, fuso?: string): Promise<GoalWithStats> {
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
    return this.enrichWithStats(saved, fuso);
  }

  async update(id: string, userId: string, dto: UpdateGoalDto, fuso?: string): Promise<GoalWithStats> {
    const goal = await this.goalsRepository.findOne({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Meta não encontrada');

    if (dto.dataFim) {
      goal.dataFim = dto.dataFim as any;
    }

    Object.assign(goal, dto);
    const saved = await this.goalsRepository.save(goal);
    return this.enrichWithStats(saved, fuso);
  }

  async remove(id: string, userId: string): Promise<void> {
    const goal = await this.goalsRepository.findOne({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Meta não encontrada');
    await this.goalsRepository.remove(goal);
  }

  // ─── Progresso ───────────────────────────────────────────────────────────────

  async addProgress(id: string, userId: string, dto: AddProgressDto, fuso?: string): Promise<GoalWithStats> {
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
      // Sem data explícita, "hoje" do usuário — o DEFAULT CURRENT_DATE da coluna
      // usaria o relógio UTC do banco.
      dataRegistro: (dto.dataRegistro ?? hojeNoFuso(fuso)) as any,
    });
    await this.progressRepository.save(progress);

    // Atualiza valorAtual e status se concluída
    goal.valorAtual = novoValor;
    if (novoValor >= Number(goal.valorAlvo)) {
      goal.status = 'concluída';
    }

    const saved = await this.goalsRepository.save(goal);
    return this.enrichWithStats(saved, fuso);
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

  private enrichWithStats(goal: Goal, fuso?: string): GoalWithStats {
    const percentualProgresso = goal.valorAlvo > 0
      ? Math.min(Math.round((Number(goal.valorAtual) / Number(goal.valorAlvo)) * 100), 100)
      : 0;

    const hoje = hojeNoFuso(fuso);
    const dataFim = comoData(goal.dataFim);
    const diasRestantes = Math.max(0, diasEntre(hoje, dataFim));

    // Em risco: ativa, menos de 30% do tempo restante, menos de 80% do valor atingido
    const totalDias = diasEntre(comoData(goal.dataInicio), dataFim);
    const percentualTempo = totalDias > 0 ? ((totalDias - diasRestantes) / totalDias) * 100 : 100;
    const emRisco =
      goal.status === 'ativa' &&
      percentualTempo > 70 &&
      percentualProgresso < 80;

    return { ...goal, percentualProgresso, diasRestantes, emRisco };
  }
}
