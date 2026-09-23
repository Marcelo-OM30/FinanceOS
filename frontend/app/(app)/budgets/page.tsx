'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import api from '@/lib/api';
import { formatCurrency, getMonthName, getCurrentMonthYear } from '@/lib/format';
import { useForm } from 'react-hook-form';
import type { Budget, Category, Rollover, SugestaoOrcamento, SugestoesOrcamento } from '@/types';
import { HiPlus, HiTrash, HiChevronLeft, HiChevronRight, HiSparkles } from 'react-icons/hi';
import { clsx } from 'clsx';

interface BudgetForm {
  categoryId: string;
  limiteMensal: string;
  alertaPercentual: string;
  rollover: Rollover;
}

const rolloverOptions: { value: Rollover; label: string }[] = [
  { value: 'nenhum', label: 'Não passa para o mês seguinte' },
  { value: 'acumula', label: 'Sobra passa para o mês seguinte' },
  { value: 'ajustado', label: 'Sobra e estouro passam para o mês seguinte' },
];

const classeLabel: Record<SugestaoOrcamento['classe'], string> = {
  fixa: 'Fixa',
  variavel: 'Variável',
  esporadica: 'Esporádica',
};

const classeExplica: Record<SugestaoOrcamento['classe'], string> = {
  fixa: 'média dos meses',
  variavel: 'mediana dos 6 meses',
  esporadica: 'total de 12 meses ÷ 12',
};

function deslocar(mes: number, ano: number, delta: number) {
  const i = ano * 12 + (mes - 1) + delta;
  return { mes: (i % 12) + 1, ano: Math.floor(i / 12) };
}

function mensagemDeErro(err: unknown, padrao: string): string {
  const e = err as { response?: { data?: { message?: string | string[] } } };
  const msg = e.response?.data?.message;
  return Array.isArray(msg) ? msg.join('\n') : msg ?? padrao;
}

interface LinhaSugestao {
  incluir: boolean;
  valor: string;
}

export default function BudgetsPage() {
  const hoje = getCurrentMonthYear();
  const [periodo, setPeriodo] = useState(hoje);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [sugestoes, setSugestoes] = useState<SugestoesOrcamento | null>(null);
  const [linhas, setLinhas] = useState<Record<string, LinhaSugestao>>({});
  const [rolloverLote, setRolloverLote] = useState<Rollover>('nenhum');
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BudgetForm>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([
        api.get<Budget[]>('/budgets', { params: { mes: periodo.mes, ano: periodo.ano } }),
        api.get<Category[]>('/categories'),
      ]);
      setBudgets(Array.isArray(b.data) ? b.data : []);
      setCategories(Array.isArray(c.data) ? c.data.filter((cat) => cat.tipo !== 'receita') : []);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = () => {
    reset({ alertaPercentual: '80', rollover: 'nenhum' });
    setModalOpen(true);
  };

  const onSubmit = async (data: BudgetForm) => {
    setSubmitting(true);
    try {
      await api.post('/budgets', {
        categoryId: data.categoryId,
        limiteMensal: parseFloat(data.limiteMensal),
        mes: periodo.mes,
        ano: periodo.ano,
        alertaPercentual: parseInt(data.alertaPercentual, 10),
        rollover: data.rollover,
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      alert(mensagemDeErro(err, 'Erro ao criar orçamento'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este orçamento?')) return;
    await api.delete(`/budgets/${id}`);
    await load();
  };

  const abrirSugestoes = async () => {
    setCarregandoSugestoes(true);
    try {
      const res = await api.get<SugestoesOrcamento>('/budgets/sugestoes', {
        params: { mes: periodo.mes, ano: periodo.ano },
      });
      setSugestoes(res.data);
      setLinhas(
        Object.fromEntries(
          res.data.data.map((s) => [
            s.categoryId,
            { incluir: s.sugerido > 0, valor: String(s.sugerido > 0 ? s.sugerido : s.orcamentoExistente?.limiteMensal ?? '') },
          ]),
        ),
      );
      setRolloverLote('nenhum');
    } catch (err) {
      alert(mensagemDeErro(err, 'Erro ao calcular sugestões'));
    } finally {
      setCarregandoSugestoes(false);
    }
  };

  const totalEscolhido = useMemo(
    () =>
      Object.values(linhas).reduce(
        (acc, l) => acc + (l.incluir ? parseFloat(l.valor) || 0 : 0),
        0,
      ),
    [linhas],
  );

  const aplicarSugestoes = async () => {
    if (!sugestoes) return;
    const itens = sugestoes.data
      .filter((s) => linhas[s.categoryId]?.incluir && parseFloat(linhas[s.categoryId].valor) > 0)
      .map((s) => ({
        categoryId: s.categoryId,
        limiteMensal: Math.round(parseFloat(linhas[s.categoryId].valor) * 100) / 100,
        rollover: rolloverLote,
      }));
    if (itens.length === 0) {
      alert('Selecione ao menos uma categoria com valor');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/budgets/aplicar-sugestoes', {
        mes: sugestoes.periodo.mes,
        ano: sugestoes.periodo.ano,
        itens,
      });
      setSugestoes(null);
      await load();
    } catch (err) {
      alert(mensagemDeErro(err, 'Erro ao aplicar sugestões'));
    } finally {
      setSubmitting(false);
    }
  };

  const setLinha = (id: string, parcial: Partial<LinhaSugestao>) =>
    setLinhas((atual) => ({ ...atual, [id]: { ...atual[id], ...parcial } }));

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.nome }));
  const totalLimites = budgets.reduce((acc, b) => acc + Number(b.limiteMensal), 0);
  const totalRealizado = budgets.reduce((acc, b) => acc + b.gastoRealizado, 0);
  const aAlocar = sugestoes ? sugestoes.rendaPrevista - totalEscolhido : 0;

  return (
    <div className="flex-1">
      <Header
        title="Orçamentos"
        subtitle="Controle seus gastos por categoria"
        actions={
          <div className="flex gap-2">
            <Button onClick={abrirSugestoes} size="sm" variant="secondary" loading={carregandoSugestoes}>
              <HiSparkles className="h-4 w-4" />
              Montar pelo histórico
            </Button>
            <Button onClick={openModal} size="sm">
              <HiPlus className="h-4 w-4" />
              Novo
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeriodo((p) => deslocar(p.mes, p.ano, -1))}
              className="p-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50"
              title="Mês anterior"
            >
              <HiChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold text-gray-900 min-w-[140px] text-center">
              {getMonthName(periodo.mes)} de {periodo.ano}
            </span>
            <button
              onClick={() => setPeriodo((p) => deslocar(p.mes, p.ano, 1))}
              className="p-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50"
              title="Próximo mês"
            >
              <HiChevronRight className="h-4 w-4" />
            </button>
          </div>
          {budgets.length > 0 && (
            <p className="text-sm text-gray-500">
              Gasto {formatCurrency(totalRealizado)} de {formatCurrency(totalLimites)} orçados
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="text-primary-600" />
          </div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📊</p>
            <p className="font-medium">Nenhum orçamento neste mês</p>
            <p className="text-sm mt-1">
              Use &quot;Montar pelo histórico&quot; para partir do que você gastou nos últimos meses
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {budgets.map((b) => {
              const limite = Number(b.limiteMensal);
              const efetivo = limite + b.saldoAnterior;
              const pctRealizado = efetivo > 0 ? Math.min((b.gastoRealizado / efetivo) * 100, 100) : 100;
              const pctComprometido =
                efetivo > 0 ? Math.min((b.comprometido / efetivo) * 100, 100 - pctRealizado) : 0;
              return (
                <Card key={b.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{b.category?.nome ?? 'Categoria'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Limite {formatCurrency(limite)}
                        {b.saldoAnterior !== 0 && (
                          <>
                            {' '}
                            {b.saldoAnterior > 0 ? '+' : '−'} {formatCurrency(Math.abs(b.saldoAnterior))} do mês
                            anterior
                          </>
                        )}
                        {b.rollover !== 'nenhum' && ' · passa para o próximo'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.estourado ? (
                        <Badge variant="danger">Estourado</Badge>
                      ) : b.emAlerta ? (
                        <Badge variant="warning">Em alerta</Badge>
                      ) : (
                        <Badge variant="success">Normal</Badge>
                      )}
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        title="Excluir"
                      >
                        <HiTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Realizado (cheio) + comprometido (claro) sobre o limite efetivo */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex mb-3">
                    <div
                      className={clsx(
                        'h-full transition-all',
                        b.estourado ? 'bg-red-500' : b.emAlerta ? 'bg-amber-400' : 'bg-green-500',
                      )}
                      style={{ width: `${pctRealizado}%` }}
                    />
                    <div className="h-full bg-gray-300" style={{ width: `${pctComprometido}%` }} />
                  </div>

                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
                    <span className="text-gray-500">
                      Gasto: <span className="font-medium text-gray-900">{formatCurrency(b.gastoRealizado)}</span>
                    </span>
                    {b.comprometido > 0 && (
                      <span className="text-gray-500">
                        Agendado:{' '}
                        <span className="font-medium text-gray-900">{formatCurrency(b.comprometido)}</span>
                      </span>
                    )}
                    <span className="text-gray-500">
                      Disponível:{' '}
                      <span
                        className={clsx('font-semibold', b.disponivel < 0 ? 'text-red-500' : 'text-green-600')}
                      >
                        {formatCurrency(b.disponivel)}
                      </span>
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Novo orçamento — ${getMonthName(periodo.mes)}/${periodo.ano}`}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Categoria"
            options={categoryOptions}
            placeholder="Selecione uma categoria"
            error={errors.categoryId?.message}
            {...register('categoryId', { required: 'Selecione uma categoria' })}
          />
          <Input
            label="Limite (R$)"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            error={errors.limiteMensal?.message}
            {...register('limiteMensal', { required: 'Limite é obrigatório' })}
          />
          <Select label="Ao fim do mês" options={rolloverOptions} {...register('rollover')} />
          <Input
            label="Alerta em (% do limite)"
            type="number"
            min="1"
            max="100"
            hint="Você será alertado ao atingir este percentual"
            {...register('alertaPercentual')}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth loading={submitting}>
              Criar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!sugestoes}
        onClose={() => setSugestoes(null)}
        size="lg"
        title={sugestoes ? `Orçamento de ${getMonthName(sugestoes.periodo.mes)}/${sugestoes.periodo.ano} pelo histórico` : ''}
      >
        {sugestoes && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Com base no que você gastou de {sugestoes.janela.de.split('-').reverse().join('/')} a{' '}
              {sugestoes.janela.ate.split('-').reverse().join('/')}. Ajuste os valores e escolha o que aplicar.
            </p>

            {sugestoes.data.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                Ainda não há despesas com categoria suficientes para sugerir um orçamento.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto -mx-1 px-1">
                {sugestoes.data.map((s) => {
                  const linha = linhas[s.categoryId];
                  if (!linha) return null;
                  return (
                    <li key={s.categoryId} className="py-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 rounded border-gray-300"
                          checked={linha.incluir}
                          onChange={(e) => setLinha(s.categoryId, { incluir: e.target.checked })}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{s.categoria}</span>
                            <Badge variant="default">{classeLabel[s.classe]}</Badge>
                            {s.orcamentoExistente && (
                              <span className="text-xs text-gray-400">
                                hoje: {formatCurrency(s.orcamentoExistente.limiteMensal)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {s.ajustadoPorCompromissos
                              ? `Elevado para o que já está agendado (${formatCurrency(s.comprometido)})`
                              : `${classeExplica[s.classe]} · gasto em ${s.mesesComGasto} de 6 meses`}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <button
                              type="button"
                              onClick={() => setLinha(s.categoryId, { valor: String(s.sugerido), incluir: true })}
                              className="text-xs px-2 py-0.5 rounded-full border border-gray-200 hover:bg-gray-50"
                            >
                              Sugerido {formatCurrency(s.sugerido)}
                            </button>
                            {s.p75 > s.sugerido && (
                              <button
                                type="button"
                                onClick={() => setLinha(s.categoryId, { valor: String(s.p75), incluir: true })}
                                className="text-xs px-2 py-0.5 rounded-full border border-gray-200 hover:bg-gray-50"
                              >
                                Com folga {formatCurrency(s.p75)}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="w-28 shrink-0">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={linha.valor}
                            onChange={(e) => setLinha(s.categoryId, { valor: e.target.value, incluir: true })}
                            aria-label={`Limite de ${s.categoria}`}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Renda típica (mediana dos 6 meses)</span>
                <span className="font-medium">{formatCurrency(sugestoes.rendaPrevista)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Orçado</span>
                <span className="font-medium">{formatCurrency(totalEscolhido)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1">
                <span className="text-gray-700 font-medium">A alocar</span>
                <span className={clsx('font-semibold', aAlocar < 0 ? 'text-red-500' : 'text-green-600')}>
                  {formatCurrency(aAlocar)}
                </span>
              </div>
              {aAlocar < 0 && (
                <p className="text-xs text-red-500">O orçamento passa da renda típica.</p>
              )}
            </div>

            <Select
              label="Ao fim do mês"
              options={rolloverOptions}
              value={rolloverLote}
              onChange={(e) => setRolloverLote(e.target.value as Rollover)}
            />

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" fullWidth onClick={() => setSugestoes(null)}>
                Cancelar
              </Button>
              <Button type="button" fullWidth loading={submitting} onClick={aplicarSugestoes}>
                Aplicar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
