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
import { DataSource, EntityManager, ILike, IsNull, Repository } from 'typeorm';
import { Asset } from './entities/asset.entity';
import { AssetQuote } from './entities/asset-quote.entity';
import { InvestmentTransaction } from './entities/investment-transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { CreateInvestmentTransactionDto } from './dto/create-investment-transaction.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CotacaoDto } from './dto/cotacao.dto';
import { FilterInvestmentTransactionDto } from './dto/filter-investment.dto';
import { calcularPosicao, efeitoNoCaixa, Movimento, VendaMaiorQueAPosicao } from './posicao';
import { FUSO_PADRAO, hojeNoFuso } from '../../common/datas';

export interface PosicaoDoAtivo {
  asset: Asset;
  quantidade: number;
  precoMedio: number;
  custoTotal: number;
  cotacao: number | null;
  dataCotacao: string | null;
  // Sem cotação, o valor de mercado é o custo: melhor que zero, e sinalizado.
  semCotacao: boolean;
  valorMercado: number;
  resultadoNaoRealizado: number;
  rentabilidadePercentual: number;
  lucroRealizado: number;
  proventos: number;
}

export interface Carteira {
  data: PosicaoDoAtivo[];
  totais: {
    custoTotal: number;
    valorMercado: number;
    resultadoNaoRealizado: number;
    lucroRealizado: number;
    proventos: number;
  };
}

const centavos = (v: number) => Math.round(v * 100) / 100;
const SEIS_HORAS = 6 * 60 * 60 * 1000;

@Injectable()
export class InvestmentsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(InvestmentsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(InvestmentTransaction)
    private movimentosRepository: Repository<InvestmentTransaction>,
    @InjectRepository(Asset)
    private assetsRepository: Repository<Asset>,
    @InjectRepository(AssetQuote)
    private quotesRepository: Repository<AssetQuote>,
    private dataSource: DataSource,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    setTimeout(() => void this.atualizarCotacoes(), 15_000).unref();
    this.timer = setInterval(() => void this.atualizarCotacoes(), SEIS_HORAS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  // ─── Carteira ────────────────────────────────────────────────────────────────

  async carteira(userId: string): Promise<Carteira> {
    const movimentos = await this.movimentosRepository.find({
      where: { userId },
      relations: ['asset'],
      order: { data: 'ASC', dataCriacao: 'ASC' },
    });
    const porAtivo = new Map<string, InvestmentTransaction[]>();
    for (const m of movimentos) {
      if (!porAtivo.has(m.assetId)) porAtivo.set(m.assetId, []);
      porAtivo.get(m.assetId)!.push(m);
    }
    const cotacoes = await this.ultimasCotacoes([...porAtivo.keys()]);

    const data: PosicaoDoAtivo[] = [...porAtivo.values()].map((ms) => {
      const p = calcularPosicao(ms);
      const cot = cotacoes.get(ms[0].assetId);
      const semCotacao = !cot;
      const valorMercado = semCotacao ? p.custoTotal : p.quantidade * cot!.preco;
      const resultado = valorMercado - p.custoTotal;
      return {
        asset: ms[0].asset,
        quantidade: p.quantidade,
        precoMedio: Math.round(p.precoMedio * 1e6) / 1e6,
        custoTotal: centavos(p.custoTotal),
        cotacao: cot?.preco ?? null,
        dataCotacao: cot?.data ?? null,
        semCotacao,
        valorMercado: centavos(valorMercado),
        resultadoNaoRealizado: centavos(resultado),
        rentabilidadePercentual: p.custoTotal > 0 ? Math.round((resultado / p.custoTotal) * 10000) / 100 : 0,
        lucroRealizado: centavos(p.lucroRealizado),
        proventos: centavos(p.proventos),
      };
    });
    data.sort((a, b) => b.valorMercado - a.valorMercado);

    const soma = (k: keyof PosicaoDoAtivo) => centavos(data.reduce((acc, p) => acc + (p[k] as number), 0));
    return {
      data,
      totais: {
        custoTotal: soma('custoTotal'),
        valorMercado: soma('valorMercado'),
        resultadoNaoRealizado: soma('resultadoNaoRealizado'),
        lucroRealizado: soma('lucroRealizado'),
        proventos: soma('proventos'),
      },
    };
  }

  async listarMovimentos(userId: string, filters: FilterInvestmentTransactionDto) {
    const { page = 1, limit = 30, assetId } = filters;
    const [data, total] = await this.movimentosRepository.findAndCount({
      where: { userId, ...(assetId ? { assetId } : {}) },
      relations: ['asset', 'account'],
      order: { data: 'DESC', dataCriacao: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async registrarMovimento(userId: string, dto: CreateInvestmentTransactionDto): Promise<InvestmentTransaction> {
    const conta = await this.dataSource.getRepository(Account).findOne({ where: { id: dto.accountId, userId } });
    if (!conta) throw new BadRequestException('Conta não encontrada');
    if (conta.tipo !== 'investimento') {
      throw new BadRequestException('Movimento de carteira vai numa conta do tipo investimento (a corretora)');
    }
    const negociacao = dto.tipo === 'compra' || dto.tipo === 'venda';

    const id = await this.dataSource.transaction(async (manager) => {
      const asset = await this.resolverAtivo(manager, userId, dto);
      const movimento = manager.create(InvestmentTransaction, {
        userId,
        accountId: conta.id,
        assetId: asset.id,
        tipo: dto.tipo,
        quantidade: negociacao ? dto.quantidade! : 0,
        precoUnitario: dto.precoUnitario,
        taxas: negociacao ? dto.taxas ?? 0 : 0,
        data: dto.data.slice(0, 10),
      });
      // A venda precisa caber na posição naquela data, não só na de hoje.
      await this.validarCronologia(manager, userId, asset.id, movimento);
      const salvo = await manager.save(movimento);
      await this.mexerNoCaixa(manager, conta.id, efeitoNoCaixa(salvo));
      return salvo.id;
    });
    return this.movimentosRepository.findOneOrFail({ where: { id }, relations: ['asset', 'account'] });
  }

  async excluirMovimento(id: string, userId: string): Promise<void> {
    const movimento = await this.movimentosRepository.findOne({ where: { id, userId } });
    if (!movimento) throw new NotFoundException('Movimento não encontrado');
    await this.dataSource.transaction(async (manager) => {
      await this.validarCronologia(manager, userId, movimento.assetId, null, id);
      await manager.remove(movimento);
      await this.mexerNoCaixa(manager, movimento.accountId, -efeitoNoCaixa(movimento));
    });
  }

  /** Patrimônio investido a valor de mercado, para o dashboard. */
  async valorDeMercado(userId: string): Promise<number> {
    return (await this.carteira(userId)).totais.valorMercado;
  }

  // ─── Ativos e cotações ───────────────────────────────────────────────────────

  async buscarAtivos(userId: string, q?: string): Promise<Asset[]> {
    const termo = q?.trim();
    const filtro = termo ? [{ ticker: ILike(`%${termo}%`) }, { nome: ILike(`%${termo}%`) }] : [{}];
    return this.assetsRepository.find({
      where: filtro.flatMap((f) => [
        { ...f, userId },
        { ...f, userId: IsNull() },
      ]),
      order: { ticker: 'ASC' },
      take: 50,
    });
  }

  async criarAtivo(userId: string, dto: CreateAssetDto): Promise<Asset> {
    const ticker = dto.ticker.toUpperCase();
    const existente = await this.assetsRepository.findOne({ where: [{ ticker, userId }, { ticker, userId: IsNull() }] });
    if (existente) throw new ConflictException(`O ativo ${ticker} já existe`);
    return this.assetsRepository.save(
      this.assetsRepository.create({ userId, ticker, nome: dto.nome, tipo: dto.tipo, fonteCotacao: dto.fonteCotacao ?? 'manual' }),
    );
  }

  async informarCotacao(userId: string, assetId: string, dto: CotacaoDto, fuso?: string): Promise<AssetQuote> {
    const asset = await this.assetsRepository.findOne({ where: [{ id: assetId, userId }, { id: assetId, userId: IsNull() }] });
    if (!asset) throw new NotFoundException('Ativo não encontrado');
    return this.gravarCotacao(assetId, dto.data?.slice(0, 10) ?? hojeNoFuso(fuso), dto.preco);
  }

  /**
   * Busca na brapi a cotação dos ativos marcados como 'brapi' que alguém tem
   * em carteira. Sem BRAPI_TOKEN só os ativos de teste da brapi respondem; os
   * demais ficam com a última cotação que tiverem (ou a informada à mão).
   */
  async atualizarCotacoes(): Promise<{ atualizados: string[]; falhas: string[] }> {
    const ativos = await this.assetsRepository
      .createQueryBuilder('a')
      .where("a.fonteCotacao = 'brapi'")
      .andWhere('EXISTS (SELECT 1 FROM investment_transactions m WHERE m."assetId" = a.id)')
      .getMany();
    const hoje = hojeNoFuso(FUSO_PADRAO);
    const token = process.env.BRAPI_TOKEN;
    const atualizados: string[] = [];
    const falhas: string[] = [];
    for (const a of ativos) {
      try {
        const url = `https://brapi.dev/api/quote/${encodeURIComponent(a.ticker)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        const corpo = (await res.json()) as { results?: Array<{ regularMarketPrice?: number }>; message?: string };
        const preco = corpo.results?.[0]?.regularMarketPrice;
        if (!res.ok || typeof preco !== 'number') throw new Error(corpo.message ?? `HTTP ${res.status}`);
        await this.gravarCotacao(a.id, hoje, preco);
        atualizados.push(a.ticker);
      } catch (err) {
        falhas.push(a.ticker);
        this.logger.warn(`Cotação de ${a.ticker}: ${(err as Error).message}`);
      }
    }
    return { atualizados, falhas };
  }

  // ─── Internos ────────────────────────────────────────────────────────────────

  private async resolverAtivo(manager: EntityManager, userId: string, dto: CreateInvestmentTransactionDto): Promise<Asset> {
    if (dto.assetId) {
      const asset = await manager.findOne(Asset, {
        where: [{ id: dto.assetId, userId }, { id: dto.assetId, userId: IsNull() }],
      });
      if (!asset) throw new BadRequestException('Ativo não encontrado');
      return asset;
    }
    const ticker = dto.ticker!.toUpperCase();
    const existente = await manager.findOne(Asset, { where: [{ ticker, userId }, { ticker, userId: IsNull() }] });
    if (existente) return existente;
    if (!dto.tipoAtivo) {
      throw new BadRequestException(`Ativo ${ticker} ainda não existe: informe tipoAtivo para criá-lo`);
    }
    return manager.save(
      manager.create(Asset, {
        userId,
        ticker,
        nome: dto.nomeAtivo ?? ticker,
        tipo: dto.tipoAtivo,
        fonteCotacao: dto.fonteCotacao ?? (dto.tipoAtivo === 'renda_fixa' ? 'manual' : 'brapi'),
      }),
    );
  }

  /** Refaz a posição com o movimento novo (ou sem o excluído) e recusa se alguma venda ficar descoberta. */
  private async validarCronologia(
    manager: EntityManager,
    userId: string,
    assetId: string,
    novo: InvestmentTransaction | null,
    semId?: string,
  ): Promise<void> {
    const existentes = await manager.find(InvestmentTransaction, {
      where: { userId, assetId },
      order: { data: 'ASC', dataCriacao: 'ASC' },
    });
    let lista: Movimento[] & { data?: string }[] = existentes.filter((m) => m.id !== semId) as any;
    if (novo) {
      // No mesmo dia, o novo entra por último.
      const i = lista.findIndex((m: any) => String(m.data) > String(novo.data));
      lista = [...lista.slice(0, i < 0 ? lista.length : i), novo, ...(i < 0 ? [] : lista.slice(i))] as any;
    }
    try {
      calcularPosicao(lista);
    } catch (err) {
      if (err instanceof VendaMaiorQueAPosicao) {
        throw new ConflictException(
          novo ? 'Venda maior que a quantidade em carteira nessa data' : 'Excluir deixaria uma venda posterior descoberta',
        );
      }
      throw err;
    }
  }

  private async mexerNoCaixa(manager: EntityManager, accountId: string, delta: number) {
    const valor = centavos(delta);
    if (valor !== 0) await manager.increment(Account, { id: accountId }, 'saldoAtual', valor);
  }

  private async gravarCotacao(assetId: string, data: string, preco: number): Promise<AssetQuote> {
    await this.quotesRepository.upsert({ assetId, data, preco }, ['assetId', 'data']);
    return this.quotesRepository.findOneOrFail({ where: { assetId, data } });
  }

  private async ultimasCotacoes(assetIds: string[]): Promise<Map<string, { preco: number; data: string }>> {
    if (assetIds.length === 0) return new Map();
    const linhas: Array<{ assetId: string; preco: string; data: string }> = await this.quotesRepository.query(
      `SELECT DISTINCT ON ("assetId") "assetId", preco, TO_CHAR(data, 'YYYY-MM-DD') AS data
         FROM asset_quotes WHERE "assetId" = ANY($1) ORDER BY "assetId", data DESC`,
      [assetIds],
    );
    return new Map(linhas.map((l) => [l.assetId, { preco: Number(l.preco), data: l.data }]));
  }
}
