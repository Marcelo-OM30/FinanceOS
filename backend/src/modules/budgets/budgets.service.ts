import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Category } from '../categories/entities/category.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { AplicarSugestoesDto } from './dto/aplicar-sugestoes.dto';
import { deslocarMes, hojeNoFuso, limitesDoMes, partesDaData } from '../../common/datas';
import { ClasseDeGasto, estatisticaDaCategoria, mediana } from './sugestao';

export interface BudgetWithProgress extends Budget {
  // Mesmo valor que gastoRealizado; mantido porque a tela o lia quando era coluna.
  gastoAtual: number;
  gastoRealizado: number;
  comprometido: number;
  saldoAnterior: number;
  disponivel: number;
  // Significado de sempre: só o realizado. O comprometido vem em campo próprio.
  percentualUtilizado: number;
  percentualComprometido: number;
  emAlerta: boolean;
  estourado: boolean;
}

export interface SugestaoDeCategoria {
  categoryId: string;
  categoria: string;
  classe: ClasseDeGasto;
  sugerido: number;
  media: number;
  mediana: number;
  p75: number;
  mesesComGasto: number;
  comprometido: number;
  ajustadoPorCompromissos: boolean;
  orcamentoExistente: { id: string; limiteMensal: number; rollover: Budget['rollover'] } | null;
}

export interface Sugestoes {
  periodo: { mes: number; ano: number };
  janela: { de: string; ate: string };
  rendaPrevista: number;
  totalSugerido: number;
  aAlocar: number;
  data: SugestaoDeCategoria[];
}

const centavos = (v: number) => Math.round(v * 100) / 100;
const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`;
// Rollover encadeado para trás tem limite: ninguém precisa de 2 anos de cascata.
const PROFUNDIDADE_MAXIMA_DO_ROLLOVER = 24;

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private budgetsRepository: Repository<Budget>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private dataSource: DataSource,
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

    const budget = this.budgetsRepository.create({
      ...dto,
      userId,
      alertaPercentual: dto.alertaPercentual ?? 80,
      rollover: dto.rollover ?? 'nenhum',
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

  // ─── Sugestões a partir do histórico (spec §5.4) ────────────────────────────

  /**
   * Propõe um teto por categoria de despesa para mes/ano, sem gravar nada.
   * Janela: os 6 meses fechados antes do alvo — nunca o mês corrente, que
   * incompleto puxaria tudo para baixo. Só o realizado, por competência.
   */
  async sugestoes(userId: string, mes: number, ano: number, fuso?: string): Promise<Sugestoes> {
    const hoje = partesDaData(hojeNoFuso(fuso));
    const antesDoAlvo = deslocarMes(ano, mes, -1);
    const antesDeHoje = deslocarMes(hoje.ano, hoje.mes, -1);
    const ultimoFechado =
      chaveMes(antesDoAlvo.ano, antesDoAlvo.mes) < chaveMes(antesDeHoje.ano, antesDeHoje.mes)
        ? antesDoAlvo
        : antesDeHoje;
    const meses12 = Array.from({ length: 12 }, (_, i) => deslocarMes(ultimoFechado.ano, ultimoFechado.mes, i - 11));
    const meses6 = meses12.slice(6);
    const inicio12 = limitesDoMes(meses12[0].ano, meses12[0].mes).inicio;
    const fimJanela = limitesDoMes(ultimoFechado.ano, ultimoFechado.mes).fim;
    const alvo = limitesDoMes(ano, mes);

    const [despesas, receitas, comprometidos, existentes] = await Promise.all([
      this.somaPorCategoriaEMes(userId, 'despesa', inicio12, fimJanela),
      this.somaPorCategoriaEMes(userId, 'receita', limitesDoMes(meses6[0].ano, meses6[0].mes).inicio, fimJanela),
      this.somaPorCategoria(userId, alvo.inicio, alvo.fim, false),
      this.budgetsRepository.find({ where: { userId, mes, ano } }),
    ]);

    const idsCategorias = new Set<string>([
      ...[...despesas.keys()],
      ...[...comprometidos.keys()],
      ...existentes.map((b) => b.categoryId),
    ]);
    const categorias = idsCategorias.size
      ? await this.categoriesRepository.find({
          where: [
            { id: In([...idsCategorias]), userId },
            { id: In([...idsCategorias]), userId: IsNull() },
          ],
        })
      : [];

    const data: SugestaoDeCategoria[] = categorias
      .filter((c) => c.tipo !== 'receita')
      .map((c) => {
        const serie = despesas.get(c.id) ?? new Map<string, number>();
        const ultimos6 = meses6.map((m) => serie.get(chaveMes(m.ano, m.mes)) ?? 0);
        const total12 = meses12.reduce((acc, m) => acc + (serie.get(chaveMes(m.ano, m.mes)) ?? 0), 0);
        const estatistica = estatisticaDaCategoria(ultimos6, total12);
        const comprometido = centavos(comprometidos.get(c.id) ?? 0);
        // Teto abaixo do que já está assumido nasceria estourado.
        const ajustadoPorCompromissos = comprometido > estatistica.sugerido;
        const existente = existentes.find((b) => b.categoryId === c.id);
        return {
          categoryId: c.id,
          categoria: c.nome,
          ...estatistica,
          sugerido: ajustadoPorCompromissos ? comprometido : estatistica.sugerido,
          comprometido,
          ajustadoPorCompromissos,
          orcamentoExistente: existente
            ? { id: existente.id, limiteMensal: Number(existente.limiteMensal), rollover: existente.rollover }
            : null,
        };
      })
      .filter((s) => s.sugerido > 0 || s.orcamentoExistente)
      .sort((a, b) => b.sugerido - a.sugerido);

    // Renda: mediana das receitas mensais da janela. Receitas recorrentes
    // entram quando existirem (Fase 5).
    const receitaPorMes = new Map<string, number>();
    for (const serie of receitas.values()) {
      for (const [chave, valor] of serie) receitaPorMes.set(chave, (receitaPorMes.get(chave) ?? 0) + valor);
    }
    const rendaPrevista = centavos(mediana(meses6.map((m) => receitaPorMes.get(chaveMes(m.ano, m.mes)) ?? 0)));
    const totalSugerido = centavos(data.reduce((acc, s) => acc + s.sugerido, 0));

    return {
      periodo: { mes, ano },
      janela: { de: chaveMes(meses6[0].ano, meses6[0].mes), ate: chaveMes(ultimoFechado.ano, ultimoFechado.mes) },
      rendaPrevista,
      totalSugerido,
      aAlocar: centavos(rendaPrevista - totalSugerido),
      data,
    };
  }

  /** Cria ou atualiza em lote; categoria que já tem orçamento no mês é atualizada. */
  async aplicarSugestoes(userId: string, dto: AplicarSugestoesDto): Promise<BudgetWithProgress[]> {
    const ids = [...new Set(dto.itens.map((i) => i.categoryId))];
    const visiveis = await this.categoriesRepository.find({
      where: [
        { id: In(ids), userId },
        { id: In(ids), userId: IsNull() },
      ],
    });
    if (visiveis.length !== ids.length) throw new NotFoundException('Categoria não encontrada');

    await this.dataSource.transaction(async (manager) => {
      for (const item of dto.itens) {
        const existente = await manager.findOne(Budget, {
          where: { userId, categoryId: item.categoryId, mes: dto.mes, ano: dto.ano },
        });
        if (existente) {
          existente.limiteMensal = item.limiteMensal;
          if (item.rollover) existente.rollover = item.rollover;
          await manager.save(existente);
        } else {
          await manager.save(
            manager.create(Budget, {
              userId,
              categoryId: item.categoryId,
              mes: dto.mes,
              ano: dto.ano,
              limiteMensal: item.limiteMensal,
              rollover: item.rollover ?? 'nenhum',
              alertaPercentual: 80,
            }),
          );
        }
      }
    });

    return this.findAll(userId, dto.mes, dto.ano);
  }

  // ─── Progresso ───────────────────────────────────────────────────────────────

  private async enrichWithProgress(budget: Budget): Promise<BudgetWithProgress> {
    const limite = Number(budget.limiteMensal);
    const [{ gastoRealizado, comprometido }, saldoAnterior] = await Promise.all([
      this.gastoDoMes(budget.userId, budget.categoryId, budget.mes, budget.ano),
      this.saldoAnterior(budget, limite),
    ]);
    const disponivel = centavos(limite + saldoAnterior - gastoRealizado - comprometido);
    const percentualUtilizado = limite > 0 ? Math.round((gastoRealizado / limite) * 100) : 0;
    const percentualComprometido =
      limite > 0 ? Math.round(((gastoRealizado + comprometido) / limite) * 100) : 0;

    return {
      ...budget,
      gastoAtual: gastoRealizado,
      gastoRealizado,
      comprometido,
      saldoAnterior,
      disponivel,
      percentualUtilizado,
      percentualComprometido,
      emAlerta: percentualUtilizado >= budget.alertaPercentual && percentualUtilizado < 100,
      estourado: percentualUtilizado >= 100,
    };
  }

  /**
   * O que vem do mês anterior da mesma categoria, segundo o rollover dele.
   * Calculado a cada leitura, e não gravado: uma transação editada no mês
   * passado muda o saldo que chega neste. (A spec previa gravar no primeiro
   * acesso, o que deixaria o valor velho.)
   */
  private async saldoAnterior(budget: Budget, limiteDeste: number, profundidade = 0): Promise<number> {
    if (profundidade >= PROFUNDIDADE_MAXIMA_DO_ROLLOVER) return 0;
    const m = deslocarMes(budget.ano, budget.mes, -1);
    const anterior = await this.budgetsRepository.findOne({
      where: { userId: budget.userId, categoryId: budget.categoryId, mes: m.mes, ano: m.ano },
    });
    if (!anterior || anterior.rollover === 'nenhum') return 0;

    const limiteAnterior = Number(anterior.limiteMensal);
    const [{ gastoRealizado, comprometido }, saldoDoAnterior] = await Promise.all([
      this.gastoDoMes(anterior.userId, anterior.categoryId, anterior.mes, anterior.ano),
      this.saldoAnterior(anterior, limiteAnterior, profundidade + 1),
    ]);
    const disponivel = limiteAnterior + saldoDoAnterior - gastoRealizado - comprometido;

    if (anterior.rollover === 'acumula') return centavos(Math.max(0, disponivel));
    // ajustado: o estouro passa, mas com piso — estourar mais de 2× o limite
    // deixa R$ 1,00 simbólico em vez de um buraco impagável (regra do Firefly III).
    if (-disponivel > 2 * limiteDeste) return centavos(-(limiteDeste - 1));
    return centavos(disponivel);
  }

  private async gastoDoMes(userId: string, categoryId: string, mes: number, ano: number) {
    const { inicio, fim } = limitesDoMes(ano, mes);
    const linhas = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('t.confirmada', 'confirmada')
      .addSelect('COALESCE(SUM(t.valor), 0)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.categoryId = :categoryId', { categoryId })
      .andWhere("t.tipo = 'despesa'")
      .andWhere('COALESCE(t.dataCompetencia, t.data) BETWEEN :inicio AND :fim', { inicio, fim })
      .groupBy('t.confirmada')
      .getRawMany<{ confirmada: boolean; total: string }>();
    const total = (c: boolean) => Number(linhas.find((l) => l.confirmada === c)?.total ?? 0);
    return { gastoRealizado: centavos(total(true)), comprometido: centavos(total(false)) };
  }

  /** categoryId → ('AAAA-MM' → soma realizada), por competência. */
  private async somaPorCategoriaEMes(userId: string, tipo: string, inicio: string, fim: string) {
    const linhas = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('t.categoryId', 'categoryId')
      .addSelect(`TO_CHAR(COALESCE(t.dataCompetencia, t.data), 'YYYY-MM')`, 'mes')
      .addSelect('SUM(t.valor)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.tipo = :tipo', { tipo })
      .andWhere('t.confirmada = true')
      .andWhere('COALESCE(t.dataCompetencia, t.data) BETWEEN :inicio AND :fim', { inicio, fim })
      .groupBy('t.categoryId')
      .addGroupBy('mes')
      .getRawMany<{ categoryId: string | null; mes: string; total: string }>();
    const resultado = new Map<string, Map<string, number>>();
    for (const l of linhas) {
      // Receita sem categoria ainda é renda; despesa sem categoria não tem onde ser orçada.
      const chave = l.categoryId ?? '__sem_categoria__';
      if (!resultado.has(chave)) resultado.set(chave, new Map());
      resultado.get(chave)!.set(l.mes, Number(l.total));
    }
    if (tipo === 'despesa') resultado.delete('__sem_categoria__');
    return resultado;
  }

  /** categoryId → soma de despesas no período, por competência. */
  private async somaPorCategoria(userId: string, inicio: string, fim: string, confirmada: boolean) {
    const linhas = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('t.categoryId', 'categoryId')
      .addSelect('SUM(t.valor)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere("t.tipo = 'despesa'")
      .andWhere('t.confirmada = :confirmada', { confirmada })
      .andWhere('t.categoryId IS NOT NULL')
      .andWhere('COALESCE(t.dataCompetencia, t.data) BETWEEN :inicio AND :fim', { inicio, fim })
      .groupBy('t.categoryId')
      .getRawMany<{ categoryId: string; total: string }>();
    return new Map(linhas.map((l) => [l.categoryId, Number(l.total)]));
  }
}
