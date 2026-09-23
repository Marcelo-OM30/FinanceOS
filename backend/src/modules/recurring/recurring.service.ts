import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, MoreThanOrEqual, Repository } from 'typeorm';
import { RecurringRule } from './entities/recurring-rule.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';
import { datasDasOcorrencias, fimDaJanela } from './ocorrencias';
import { hojeNoFuso, partesDaData } from '../../common/datas';
import { cartaoParaCompra, cicloDaCompra, faturaAberta, recalcularFatura } from '../card-invoices/fatura';

export type RegraComProxima = RecurringRule & { proximaOcorrencia: string | null; valorPrevisto: number };

const SEIS_HORAS = 6 * 60 * 60 * 1000;
const centavos = (v: number) => Math.round(v * 100) / 100;

@Injectable()
export class RecurringService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RecurringService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(RecurringRule)
    private rulesRepository: Repository<RecurringRule>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
    private dataSource: DataSource,
  ) {}

  /**
   * Não existe "a ocorrência de hoje" para perder se o processo cair: cada
   * rodada garante a janela inteira de 12 meses. Rodar de novo não duplica
   * (índice único); ficar dias fora do ar se recupera na próxima.
   */
  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    setTimeout(() => void this.garantirTodas(), 10_000).unref();
    this.timer = setInterval(() => void this.garantirTodas(), SEIS_HORAS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async garantirTodas(): Promise<void> {
    const regras = await this.rulesRepository.find({ where: { ativa: true }, relations: ['user'] });
    for (const regra of regras) {
      try {
        await this.dataSource.transaction((m) => this.garantirOcorrencias(m, regra, regra.user?.timezone));
      } catch (err) {
        this.logger.error(`Recorrência ${regra.id}: ${(err as Error).message}`);
      }
    }
  }

  async findAll(userId: string, fuso?: string): Promise<{ data: RegraComProxima[] }> {
    const regras = await this.rulesRepository.find({
      where: { userId },
      relations: ['account', 'card', 'category'],
      order: { ativa: 'DESC', descricao: 'ASC' },
    });
    return { data: await this.comProxima(regras, fuso) };
  }

  async findOne(id: string, userId: string, fuso?: string): Promise<RegraComProxima> {
    const regra = await this.rulesRepository.findOne({
      where: { id, userId },
      relations: ['account', 'card', 'category'],
    });
    if (!regra) throw new NotFoundException('Recorrência não encontrada');
    return (await this.comProxima([regra], fuso))[0];
  }

  async create(userId: string, dto: CreateRecurringDto, fuso?: string): Promise<RegraComProxima> {
    if (dto.dataFim && dto.dataFim.slice(0, 10) < dto.dataInicio.slice(0, 10)) {
      throw new BadRequestException('A data de fim não pode ser antes do início');
    }
    if (dto.cardId && dto.tipo !== 'despesa') {
      throw new BadRequestException('No cartão de crédito só há despesa');
    }
    const inicio = partesDaData(dto.dataInicio);

    const id = await this.dataSource.transaction(async (manager) => {
      let accountId = dto.accountId;
      if (dto.cardId) {
        accountId = (await cartaoParaCompra(manager, userId, dto.cardId)).accountId;
      } else {
        const conta = await manager.findOne(Account, { where: { id: dto.accountId, userId } });
        if (!conta) throw new BadRequestException('Conta não encontrada');
      }
      const regra = await manager.save(
        manager.create(RecurringRule, {
          userId,
          accountId,
          cardId: dto.cardId ?? null,
          categoryId: dto.categoryId ?? null,
          descricao: dto.descricao,
          tipo: dto.tipo,
          valorEstimado: dto.valorEstimado,
          valorVariavel: dto.valorVariavel ?? false,
          frequencia: dto.frequencia,
          diaDoMes: dto.frequencia === 'semanal' ? null : dto.diaDoMes ?? inicio.dia,
          mesDoAno: dto.frequencia === 'anual' ? dto.mesDoAno ?? inicio.mes : null,
          diaDaSemana: dto.frequencia === 'semanal' ? dto.diaDaSemana ?? null : null,
          dataInicio: dto.dataInicio.slice(0, 10),
          dataFim: dto.dataFim?.slice(0, 10) ?? null,
          ativa: true,
          datasPuladas: [],
        }),
      );
      // Criar já materializa a previsão de 12 meses, sem esperar a próxima rodada.
      await this.garantirOcorrencias(manager, regra, fuso);
      return regra.id;
    });
    return this.findOne(id, userId, fuso);
  }

  /** Muda a regra e refaz a previsão futura; o que já aconteceu fica como está. */
  async update(id: string, userId: string, dto: UpdateRecurringDto, fuso?: string): Promise<RegraComProxima> {
    const regra = await this.rulesRepository.findOne({ where: { id, userId } });
    if (!regra) throw new NotFoundException('Recorrência não encontrada');
    Object.assign(regra, dto);
    if (regra.dataFim && String(regra.dataFim) < String(regra.dataInicio)) {
      throw new BadRequestException('A data de fim não pode ser antes do início');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(RecurringRule, regra);
      await this.removerPrevistasFuturas(manager, regra.id, hojeNoFuso(fuso));
      if (regra.ativa) await this.garantirOcorrencias(manager, regra, fuso);
    });
    return this.findOne(id, userId, fuso);
  }

  /** Some a regra e a previsão futura; as ocorrências confirmadas ficam, sem vínculo. */
  async remove(id: string, userId: string, fuso?: string): Promise<void> {
    const regra = await this.rulesRepository.findOne({ where: { id, userId } });
    if (!regra) throw new NotFoundException('Recorrência não encontrada');
    await this.dataSource.transaction(async (manager) => {
      await this.removerPrevistasFuturas(manager, id, hojeNoFuso(fuso));
      await manager.remove(RecurringRule, regra);
    });
  }

  async garantirOcorrencias(manager: EntityManager, regra: RecurringRule, fuso?: string): Promise<void> {
    if (!regra.ativa) return;
    const hoje = hojeNoFuso(fuso);
    const puladas = new Set(regra.datasPuladas ?? []);
    const datas = datasDasOcorrencias(regra, hoje, fimDaJanela(hoje)).filter((d) => !puladas.has(d));
    if (datas.length === 0) return;

    const existentes = await manager.find(Transaction, {
      where: { recurringRuleId: regra.id, dataCompetencia: In(datas) as any },
      select: ['id', 'dataCompetencia', 'confirmada', 'valor', 'cardInvoiceId'],
    });
    const jaExiste = new Set(existentes.map((t) => String(t.dataCompetencia).slice(0, 10)));
    const valor = await this.valorPrevisto(manager, regra);
    const card = regra.cardId ? await cartaoParaCompra(manager, regra.userId, regra.cardId) : null;
    const faturas = new Set<string>();

    for (const data of datas) {
      if (jaExiste.has(data)) continue;
      let dataCaixa = data;
      let cardInvoiceId: string | null = null;
      if (card) {
        try {
          const fatura = await faturaAberta(manager, card, cicloDaCompra(card, data));
          dataCaixa = fatura.dataVencimento;
          cardInvoiceId = fatura.id;
          faturas.add(fatura.id);
        } catch (err) {
          if (err instanceof ConflictException) continue; // fatura já paga: não entra
          throw err;
        }
      }
      // ON CONFLICT DO NOTHING: duas rodadas simultâneas não duplicam.
      await manager
        .createQueryBuilder()
        .insert()
        .into(Transaction)
        .values({
          userId: regra.userId,
          accountId: regra.accountId,
          cardId: regra.cardId ?? null,
          cardInvoiceId,
          categoryId: regra.categoryId ?? undefined,
          tipo: regra.tipo,
          descricao: regra.descricao,
          valor,
          data: dataCaixa as any,
          dataCompetencia: data as any,
          confirmada: false,
          recurso: 'manual',
          recorrencia: regra.frequencia,
          tags: [],
          recurringRuleId: regra.id,
        })
        .orIgnore()
        .execute();
    }

    // Valor variável: a estimativa das previstas já existentes acompanha a média.
    if (regra.valorVariavel) {
      const desatualizadas = existentes.filter((t) => !t.confirmada && Number(t.valor) !== valor);
      for (const t of desatualizadas) {
        await manager.update(Transaction, t.id, { valor });
        if (t.cardInvoiceId) faturas.add(t.cardInvoiceId);
      }
    }
    for (const f of faturas) await recalcularFatura(manager, f);
  }

  /** Fixo: o estimado. Variável: média das 3 últimas confirmadas, ou o estimado. */
  private async valorPrevisto(manager: EntityManager, regra: RecurringRule): Promise<number> {
    if (!regra.valorVariavel) return Number(regra.valorEstimado);
    const ultimas = await manager.find(Transaction, {
      where: { recurringRuleId: regra.id, confirmada: true },
      order: { dataCompetencia: 'DESC' },
      take: 3,
      select: ['valor'],
    });
    if (ultimas.length === 0) return Number(regra.valorEstimado);
    return centavos(ultimas.reduce((acc, t) => acc + Number(t.valor), 0) / ultimas.length);
  }

  private async removerPrevistasFuturas(manager: EntityManager, recurringRuleId: string, hoje: string) {
    const previstas = await manager.find(Transaction, {
      where: { recurringRuleId, confirmada: false, dataCompetencia: MoreThanOrEqual(hoje) as any },
    });
    const faturas = [...new Set(previstas.map((t) => t.cardInvoiceId).filter((f): f is string => !!f))];
    await manager.remove(Transaction, previstas);
    for (const f of faturas) await recalcularFatura(manager, f);
  }

  private async comProxima(regras: RecurringRule[], fuso?: string): Promise<RegraComProxima[]> {
    if (regras.length === 0) return [];
    const hoje = hojeNoFuso(fuso);
    const linhas = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('t.recurringRuleId', 'id')
      .addSelect(`TO_CHAR(MIN(t.dataCompetencia), 'YYYY-MM-DD')`, 'proxima')
      .where({ recurringRuleId: In(regras.map((r) => r.id)) })
      .andWhere('t.confirmada = false')
      .andWhere('t.dataCompetencia >= :hoje', { hoje })
      .groupBy('t.recurringRuleId')
      .getRawMany<{ id: string; proxima: string }>();
    const proximas = new Map(linhas.map((l) => [l.id, l.proxima]));
    return Promise.all(
      regras.map(async (r) => ({
        ...r,
        proximaOcorrencia: r.ativa ? proximas.get(r.id) ?? null : null,
        valorPrevisto: await this.valorPrevisto(this.dataSource.manager, r),
      })),
    );
  }
}
