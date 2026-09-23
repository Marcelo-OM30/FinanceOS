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
import { formatCurrency, formatDate, getMonthName, todayISO } from '@/lib/format';
import { useForm } from 'react-hook-form';
import type { Account, Card as CreditCard, Category, RecurringRule } from '@/types';
import { HiPlus, HiTrash, HiPause, HiPlay } from 'react-icons/hi';

interface RegraForm {
  tipo: 'receita' | 'despesa';
  descricao: string;
  valorEstimado: string;
  valorVariavel: boolean;
  frequencia: 'semanal' | 'mensal' | 'anual';
  diaDaSemana: string;
  dataInicio: string;
  dataFim: string;
  accountId: string;
  cardId: string;
  categoryId: string;
}

const diasDaSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function descreverFrequencia(r: RecurringRule): string {
  if (r.frequencia === 'semanal') return `toda ${diasDaSemana[r.diaDaSemana ?? 0]}`;
  if (r.frequencia === 'anual') return `todo ano em ${r.diaDoMes} de ${getMonthName(r.mesDoAno ?? 1)}`;
  return `todo dia ${r.diaDoMes}`;
}

function mensagemDeErro(err: unknown, padrao: string): string {
  const e = err as { response?: { data?: { message?: string | string[] } } };
  const msg = e.response?.data?.message;
  return Array.isArray(msg) ? msg.join('\n') : msg ?? padrao;
}

export default function RecurringPage() {
  const [regras, setRegras] = useState<RecurringRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<RegraForm>();
  const tipo = watch('tipo');
  const frequencia = watch('frequencia');
  const cardId = watch('cardId');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, a, k, c] = await Promise.all([
        api.get<{ data: RecurringRule[] }>('/recurring-rules'),
        api.get<Account[]>('/accounts'),
        api.get<CreditCard[]>('/cards'),
        api.get<Category[]>('/categories'),
      ]);
      setRegras(Array.isArray(r.data?.data) ? r.data.data : []);
      setAccounts(Array.isArray(a.data) ? a.data : []);
      setCards(Array.isArray(k.data) ? k.data.filter((card) => card.tipo === 'crédito' && card.ativo) : []);
      setCategories(Array.isArray(c.data) ? c.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = () => {
    reset({ tipo: 'despesa', frequencia: 'mensal', dataInicio: todayISO(), valorVariavel: false, diaDaSemana: '1' });
    setModalOpen(true);
  };

  const onSubmit = async (data: RegraForm) => {
    setSubmitting(true);
    try {
      const noCartao = data.tipo === 'despesa' && !!data.cardId;
      // Campo a campo: o backend recusa qualquer propriedade que não conheça.
      // Dia do mês e mês do ano saem da data de início.
      await api.post('/recurring-rules', {
        tipo: data.tipo,
        descricao: data.descricao,
        valorEstimado: parseFloat(data.valorEstimado),
        valorVariavel: data.valorVariavel,
        frequencia: data.frequencia,
        diaDaSemana: data.frequencia === 'semanal' ? parseInt(data.diaDaSemana, 10) : undefined,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim || undefined,
        accountId: noCartao ? undefined : data.accountId,
        cardId: noCartao ? data.cardId : undefined,
        categoryId: data.categoryId || undefined,
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      alert(mensagemDeErro(err, 'Erro ao criar recorrência'));
    } finally {
      setSubmitting(false);
    }
  };

  const alternarAtiva = async (r: RecurringRule) => {
    if (r.ativa && !confirm(`Pausar "${r.descricao}"? As previsões futuras somem; o que já aconteceu fica.`)) return;
    await api.patch(`/recurring-rules/${r.id}`, { ativa: !r.ativa });
    await load();
  };

  const excluir = async (r: RecurringRule) => {
    if (!confirm(`Excluir "${r.descricao}"? As previsões futuras somem; as já confirmadas ficam.`)) return;
    await api.delete(`/recurring-rules/${r.id}`);
    await load();
  };

  const categoriasDoTipo = categories.filter((c) => c.tipo === tipo || c.tipo === 'ambos');
  const totalMensal = (t: 'receita' | 'despesa') =>
    regras
      .filter((r) => r.ativa && r.tipo === t)
      .reduce((acc, r) => acc + r.valorPrevisto * (r.frequencia === 'semanal' ? 52 / 12 : r.frequencia === 'anual' ? 1 / 12 : 1), 0);

  return (
    <div className="flex-1">
      <Header
        title="Recorrentes"
        subtitle="Contas fixas, salário e assinaturas, previstos 12 meses à frente"
        actions={
          <Button onClick={openModal} size="sm">
            <HiPlus className="h-4 w-4" />
            Nova Recorrência
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {regras.some((r) => r.ativa) && (
          <p className="text-sm text-gray-500">
            Por mês, em média: <span className="text-green-600 font-medium">+{formatCurrency(totalMensal('receita'))}</span>{' '}
            · <span className="text-red-500 font-medium">−{formatCurrency(totalMensal('despesa'))}</span>
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="text-primary-600" />
          </div>
        ) : regras.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🔁</p>
            <p className="font-medium">Nenhuma conta recorrente</p>
            <p className="text-sm mt-1">Cadastre aluguel, salário e assinaturas para vê-los na projeção</p>
          </div>
        ) : (
          <Card noPadding>
            <ul className="divide-y divide-gray-100">
              {regras.map((r) => (
                <li key={r.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 sm:px-6 py-3.5 ${r.ativa ? '' : 'opacity-60'}`}>
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-medium text-gray-900">
                      {r.descricao}
                      {!r.ativa && (
                        <span className="ml-2 align-middle">
                          <Badge variant="default">Pausada</Badge>
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {descreverFrequencia(r)} · {r.card ? `💳 ${r.card.nome}` : r.account?.nome ?? 'conta'}
                      {r.category ? ` · ${r.category.nome}` : ''}
                      {r.valorVariavel ? ' · valor variável' : ''}
                      {r.proximaOcorrencia ? ` · próxima ${formatDate(r.proximaOcorrencia)}` : ''}
                    </p>
                  </div>
                  <span className={`font-semibold whitespace-nowrap ${r.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                    {r.tipo === 'receita' ? '+' : '−'}
                    {formatCurrency(r.valorPrevisto)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => alternarAtiva(r)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                      title={r.ativa ? 'Pausar' : 'Retomar'}
                    >
                      {r.ativa ? <HiPause className="h-4 w-4" /> : <HiPlay className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => excluir(r)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                      title="Excluir"
                    >
                      <HiTrash className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nova Recorrência">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Tipo"
              options={[
                { value: 'despesa', label: 'Despesa' },
                { value: 'receita', label: 'Receita' },
              ]}
              {...register('tipo')}
            />
            <Select
              label="Frequência"
              options={[
                { value: 'mensal', label: 'Mensal' },
                { value: 'semanal', label: 'Semanal' },
                { value: 'anual', label: 'Anual' },
              ]}
              {...register('frequencia')}
            />
          </div>
          <Input
            label="Descrição"
            placeholder="Ex: Aluguel"
            error={errors.descricao?.message}
            {...register('descricao', { required: 'Descrição é obrigatória' })}
          />
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0.01"
            error={errors.valorEstimado?.message}
            {...register('valorEstimado', { required: 'Valor é obrigatório' })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" className="rounded border-gray-300" {...register('valorVariavel')} />
            Valor muda todo mês (luz, água): prever pela média das 3 últimas
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={frequencia === 'semanal' ? 'A partir de' : 'Primeira vez em'}
              type="date"
              hint={frequencia === 'mensal' ? 'Repete todo mês nesse dia' : frequencia === 'anual' ? 'Repete todo ano nessa data' : undefined}
              {...register('dataInicio', { required: true })}
            />
            <Input label="Até (opcional)" type="date" {...register('dataFim')} />
          </div>
          {frequencia === 'semanal' && (
            <Select
              label="Dia da semana"
              options={diasDaSemana.map((d, i) => ({ value: String(i), label: d }))}
              {...register('diaDaSemana')}
            />
          )}
          {tipo === 'despesa' && cards.length > 0 && (
            <Select
              label="Cartão de crédito"
              options={[{ value: '', label: 'Não — sai direto da conta' }, ...cards.map((c) => ({ value: c.id, label: c.nome }))]}
              {...register('cardId')}
            />
          )}
          {!(tipo === 'despesa' && cardId) && (
            <Select
              label="Conta"
              options={[{ value: '', label: 'Selecione uma conta' }, ...accounts.map((a) => ({ value: a.id, label: a.nome }))]}
              error={errors.accountId?.message}
              {...register('accountId', {
                validate: (v, form) => (form.tipo === 'despesa' && !!form.cardId) || !!v || 'Selecione uma conta',
              })}
            />
          )}
          <Select
            label="Categoria"
            options={[{ value: '', label: 'Sem categoria' }, ...categoriasDoTipo.map((c) => ({ value: c.id, label: c.nome }))]}
            {...register('categoryId')}
          />
          <p className="text-xs text-gray-500">
            As próximas ocorrências aparecem como agendadas em Transações e na projeção. Quando acontecer, confirme
            informando o valor real; para pular uma vez, exclua aquela ocorrência.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth loading={submitting}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
