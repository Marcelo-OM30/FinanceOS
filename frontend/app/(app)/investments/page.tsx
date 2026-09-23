'use client';
import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import api from '@/lib/api';
import { formatCurrency, formatDate, todayISO } from '@/lib/format';
import { useForm } from 'react-hook-form';
import type { Account, Asset, Carteira, InvestmentTransaction, PaginatedResponse, TipoAtivo } from '@/types';
import { HiPlus, HiTrash, HiRefresh, HiPencil } from 'react-icons/hi';
import { clsx } from 'clsx';

interface OperacaoForm {
  accountId: string;
  tipo: InvestmentTransaction['tipo'];
  ticker: string;
  tipoAtivo: TipoAtivo;
  nomeAtivo: string;
  quantidade: string;
  precoUnitario: string;
  taxas: string;
  data: string;
}

const tipoOperacaoLabel: Record<InvestmentTransaction['tipo'], string> = {
  compra: 'Compra',
  venda: 'Venda',
  dividendo: 'Dividendo',
  jcp: 'JCP',
  rendimento: 'Rendimento',
  taxa: 'Taxa (custódia etc.)',
};

const tipoAtivoLabel: Record<TipoAtivo, string> = {
  acao: 'Ação',
  fii: 'FII',
  etf: 'ETF',
  bdr: 'BDR',
  tesouro: 'Tesouro Direto',
  cripto: 'Cripto',
  renda_fixa: 'Renda fixa (CDB, LCI…)',
};

const formatQtd = (q: number) => q.toLocaleString('pt-BR', { maximumFractionDigits: 8 });

function mensagemDeErro(err: unknown, padrao: string): string {
  const e = err as { response?: { data?: { message?: string | string[] } } };
  const msg = e.response?.data?.message;
  return Array.isArray(msg) ? msg.join('\n') : msg ?? padrao;
}

export default function InvestmentsPage() {
  const [carteira, setCarteira] = useState<Carteira | null>(null);
  const [movimentos, setMovimentos] = useState<InvestmentTransaction[]>([]);
  const [contas, setContas] = useState<Account[]>([]);
  const [ativos, setAtivos] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<OperacaoForm>();
  const tipo = watch('tipo');
  const ticker = (watch('ticker') ?? '').trim().toUpperCase();
  const negociacao = tipo === 'compra' || tipo === 'venda';
  const ativoNovo = ticker !== '' && !ativos.some((a) => a.ticker === ticker);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, m, a, k] = await Promise.all([
        api.get<Carteira>('/investments/positions'),
        api.get<PaginatedResponse<InvestmentTransaction>>('/investments/transactions', { params: { limit: 50 } }),
        api.get<Account[]>('/accounts'),
        api.get<Asset[]>('/assets'),
      ]);
      setCarteira(c.data);
      setMovimentos(Array.isArray(m.data?.data) ? m.data.data : []);
      setContas(Array.isArray(a.data) ? a.data.filter((conta) => conta.tipo === 'investimento') : []);
      setAtivos(Array.isArray(k.data) ? k.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = () => {
    reset({ tipo: 'compra', data: todayISO(), tipoAtivo: 'acao', accountId: contas[0]?.id ?? '' });
    setModalOpen(true);
  };

  const onSubmit = async (data: OperacaoForm) => {
    setSubmitting(true);
    try {
      const existente = ativos.find((a) => a.ticker === data.ticker.trim().toUpperCase());
      // Campo a campo: o backend recusa qualquer propriedade que não conheça.
      await api.post('/investments/transactions', {
        accountId: data.accountId,
        tipo: data.tipo,
        assetId: existente?.id,
        ticker: existente ? undefined : data.ticker.trim(),
        tipoAtivo: existente ? undefined : data.tipoAtivo,
        nomeAtivo: existente ? undefined : data.nomeAtivo || undefined,
        quantidade: negociacao ? parseFloat(data.quantidade) : undefined,
        precoUnitario: parseFloat(data.precoUnitario),
        taxas: negociacao && data.taxas ? parseFloat(data.taxas) : undefined,
        data: data.data,
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      alert(mensagemDeErro(err, 'Erro ao registrar operação'));
    } finally {
      setSubmitting(false);
    }
  };

  const excluir = async (m: InvestmentTransaction) => {
    if (!confirm(`Excluir ${tipoOperacaoLabel[m.tipo].toLowerCase()} de ${m.asset?.ticker}? O caixa da corretora volta ao que era.`)) return;
    try {
      await api.delete(`/investments/transactions/${m.id}`);
      await load();
    } catch (err) {
      alert(mensagemDeErro(err, 'Erro ao excluir'));
    }
  };

  const atualizarCotacoes = async () => {
    setAtualizando(true);
    try {
      const res = await api.post<{ atualizados: string[]; falhas: string[] }>('/investments/cotacoes/atualizar');
      if (res.data.falhas.length) {
        alert(
          `Sem cotação automática para: ${res.data.falhas.join(', ')}.\n` +
            'Sem token da brapi só os ativos de teste são cotados; informe a cotação à mão pelo lápis.',
        );
      }
      await load();
    } finally {
      setAtualizando(false);
    }
  };

  const informarCotacao = async (asset: Asset, atual: number | null) => {
    const resposta = prompt(`Cotação de ${asset.ticker} hoje:`, atual ? String(atual) : '');
    if (resposta === null) return;
    const preco = parseFloat(resposta.replace(',', '.'));
    if (!(preco > 0)) {
      alert('Valor inválido');
      return;
    }
    await api.post(`/assets/${asset.id}/cotacoes`, { preco });
    await load();
  };

  const totais = carteira?.totais;

  return (
    <div className="flex-1">
      <Header
        title="Investimentos"
        subtitle="Carteira com preço médio e cotação"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={atualizarCotacoes} loading={atualizando}>
              <HiRefresh className="h-4 w-4" />
              Cotações
            </Button>
            <Button size="sm" onClick={openModal} disabled={contas.length === 0}>
              <HiPlus className="h-4 w-4" />
              Operação
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="text-primary-600" />
          </div>
        ) : contas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📈</p>
            <p className="font-medium">Crie primeiro uma conta do tipo &quot;investimento&quot; em Contas</p>
            <p className="text-sm mt-1">
              Ela é o caixa da corretora: o dinheiro entra por transferência e as compras saem dele
            </p>
          </div>
        ) : (
          <>
            {totais && carteira!.data.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <p className="text-sm text-gray-500">Valor de mercado</p>
                  <p className="text-xl font-bold mt-1 text-gray-900">{formatCurrency(totais.valorMercado)}</p>
                </Card>
                <Card>
                  <p className="text-sm text-gray-500">Custo</p>
                  <p className="text-xl font-bold mt-1 text-gray-900">{formatCurrency(totais.custoTotal)}</p>
                </Card>
                <Card>
                  <p className="text-sm text-gray-500">Resultado em aberto</p>
                  <p className={clsx('text-xl font-bold mt-1', totais.resultadoNaoRealizado >= 0 ? 'text-green-600' : 'text-red-500')}>
                    {formatCurrency(totais.resultadoNaoRealizado)}
                  </p>
                </Card>
                <Card>
                  <p className="text-sm text-gray-500">Realizado + proventos</p>
                  <p className="text-xl font-bold mt-1 text-gray-900">
                    {formatCurrency(totais.lucroRealizado + totais.proventos)}
                  </p>
                </Card>
              </div>
            )}

            <Card noPadding>
              {carteira && carteira.data.length === 0 ? (
                <p className="text-center py-12 text-gray-400 text-sm">Nenhum ativo em carteira. Registre uma compra.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-3">Ativo</th>
                        <th className="text-right px-4 py-3">Qtd</th>
                        <th className="hidden sm:table-cell text-right px-4 py-3">Preço médio</th>
                        <th className="text-right px-4 py-3">Cotação</th>
                        <th className="text-right px-4 py-3">Valor</th>
                        <th className="text-right px-4 py-3">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {carteira?.data.map((p) => (
                        <tr key={p.asset.id} className={p.quantidade === 0 ? 'opacity-60' : ''}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{p.asset.ticker}</p>
                            <p className="text-xs text-gray-400">{tipoAtivoLabel[p.asset.tipo]}</p>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">{formatQtd(p.quantidade)}</td>
                          <td className="hidden sm:table-cell px-4 py-3 text-right whitespace-nowrap">
                            {formatCurrency(p.precoMedio)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {p.semCotacao ? (
                              <Badge variant="warning">sem cotação</Badge>
                            ) : (
                              <>
                                {formatCurrency(p.cotacao!)}
                                <span className="block text-xs text-gray-400">{formatDate(p.dataCotacao!)}</span>
                              </>
                            )}
                            <button
                              onClick={() => informarCotacao(p.asset, p.cotacao)}
                              className="ml-1 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 align-middle"
                              title="Informar cotação"
                            >
                              <HiPencil className="h-3.5 w-3.5" />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-medium">{formatCurrency(p.valorMercado)}</td>
                          <td className={clsx('px-4 py-3 text-right whitespace-nowrap', p.resultadoNaoRealizado >= 0 ? 'text-green-600' : 'text-red-500')}>
                            {formatCurrency(p.resultadoNaoRealizado)}
                            <span className="block text-xs">{p.rentabilidadePercentual.toLocaleString('pt-BR')}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {movimentos.length > 0 && (
              <Card noPadding>
                <p className="px-4 pt-4 pb-2 font-semibold text-gray-900">Operações</p>
                <ul className="divide-y divide-gray-50">
                  {movimentos.map((m) => {
                    const q = Number(m.quantidade);
                    const p = Number(m.precoUnitario);
                    const negocio = m.tipo === 'compra' || m.tipo === 'venda';
                    const total = negocio ? q * p : p;
                    return (
                      <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                        <span className="text-gray-400 w-20">{formatDate(m.data)}</span>
                        <span className="font-medium text-gray-900">{m.asset?.ticker}</span>
                        <Badge variant={m.tipo === 'venda' || m.tipo === 'taxa' ? 'default' : m.tipo === 'compra' ? 'info' : 'success'}>
                          {tipoOperacaoLabel[m.tipo]}
                        </Badge>
                        {negocio && (
                          <span className="text-gray-500">
                            {formatQtd(q)} × {formatCurrency(p)}
                          </span>
                        )}
                        <span className="ml-auto font-medium">{formatCurrency(total)}</span>
                        <button
                          onClick={() => excluir(m)}
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                          title="Excluir"
                        >
                          <HiTrash className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nova operação">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Operação"
              options={Object.entries(tipoOperacaoLabel).map(([value, label]) => ({ value, label }))}
              {...register('tipo')}
            />
            <Select
              label="Corretora"
              options={contas.map((c) => ({ value: c.id, label: `${c.nome} (caixa ${formatCurrency(Number(c.saldoAtual))})` }))}
              {...register('accountId', { required: true })}
            />
          </div>
          <Input
            label="Ativo (ticker)"
            placeholder="Ex: PETR4, IVVB11, TESOURO-IPCA-2035"
            list="lista-ativos"
            autoComplete="off"
            error={errors.ticker?.message}
            {...register('ticker', { required: 'Informe o ativo' })}
          />
          <datalist id="lista-ativos">
            {ativos.map((a) => (
              <option key={a.id} value={a.ticker}>
                {a.nome}
              </option>
            ))}
          </datalist>
          {ativoNovo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
              <p className="sm:col-span-2 text-xs text-gray-500">{ticker} é novo: ele será cadastrado.</p>
              <Select
                label="Tipo de ativo"
                options={Object.entries(tipoAtivoLabel).map(([value, label]) => ({ value, label }))}
                {...register('tipoAtivo')}
              />
              <Input label="Nome (opcional)" {...register('nomeAtivo')} />
            </div>
          )}
          {negociacao ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Quantidade"
                type="number"
                step="any"
                min="0"
                error={errors.quantidade?.message}
                {...register('quantidade', { validate: (v, f) => !(f.tipo === 'compra' || f.tipo === 'venda') || parseFloat(v) > 0 || 'Informe a quantidade' })}
              />
              <Input
                label="Preço unitário"
                type="number"
                step="any"
                min="0"
                error={errors.precoUnitario?.message}
                {...register('precoUnitario', { required: 'Informe o preço' })}
              />
              <Input label="Taxas" type="number" step="0.01" min="0" {...register('taxas')} />
            </div>
          ) : (
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0.01"
              error={errors.precoUnitario?.message}
              {...register('precoUnitario', { required: 'Informe o valor' })}
            />
          )}
          <Input label="Data" type="date" {...register('data', { required: true })} />
          <p className="text-xs text-gray-500">
            Compra e taxa saem do caixa da corretora; venda e proventos entram nele. Para pôr dinheiro na
            corretora, faça uma transferência da sua conta.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth loading={submitting}>
              Registrar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
