'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { Transaction, Category, Account, Card as CreditCard, PaginatedResponse } from '@/types';
import {
  HiPlus,
  HiChevronLeft,
  HiChevronRight,
  HiTrash,
  HiCheck,
} from 'react-icons/hi';

interface TransactionForm {
  descricao: string;
  valor: string;
  tipo: string;
  data: string;
  accountId: string;
  contaDestinoId: string;
  cardId: string;
  categoryId: string;
  recorrente: boolean;
  confirmada: boolean;
}

/** Mesmo dia no mês seguinte; 31/01 → 28/02. */
function mesSeguinte(data: string): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const alvo = new Date(Date.UTC(ano, mes, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString().slice(0, 10);
}

const tipoColors: Record<string, 'success' | 'danger' | 'info'> = {
  receita: 'success',
  despesa: 'danger',
  'transferência': 'info',
};

const tipoLabels: Record<string, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  'transferência': 'Transferência',
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'true' | 'false'>('');
  const [submitting, setSubmitting] = useState(false);

  const LIMIT = 15;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TransactionForm>({
    defaultValues: {
      tipo: 'despesa',
      data: todayISO(),
      recorrente: false,
      confirmada: true,
    },
  });

  const tipo = watch('tipo');
  const isTransferencia = tipo === 'transferência';
  const cardId = watch('cardId');
  const noCartao = tipo === 'despesa' && !!cardId;

  // Data futura sugere "ainda não aconteceu"; o usuário pode desmarcar ou
  // marcar depois. Só reage a mudança de data, não sobrescreve a escolha feita.
  const dataForm = watch('data');
  const ultimaData = useRef(dataForm);
  useEffect(() => {
    if (dataForm === ultimaData.current) return;
    ultimaData.current = dataForm;
    setValue('confirmada', !dataForm || dataForm <= todayISO());
  }, [dataForm, setValue]);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: LIMIT };
      if (filterTipo) params.tipo = filterTipo;
      if (filterStatus) params.confirmada = filterStatus;
      const res = await api.get<PaginatedResponse<Transaction>>(
        '/transactions',
        { params }
      );
      setTransactions(res.data.data);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }, [page, filterTipo, filterStatus]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    Promise.all([
      api.get<Category[]>('/categories'),
      api.get<Account[]>('/accounts'),
      api.get<CreditCard[]>('/cards'),
    ]).then(([c, a, k]) => {
      setCategories(Array.isArray(c.data) ? c.data : []);
      setAccounts(Array.isArray(a.data) ? a.data : []);
      setCards(Array.isArray(k.data) ? k.data.filter((card) => card.tipo === 'crédito' && card.ativo) : []);
    });
  }, []);

  const openModal = () => {
    reset({
      tipo: 'despesa',
      data: todayISO(),
      recorrente: false,
      confirmada: true,
    });
    ultimaData.current = todayISO();
    setModalOpen(true);
  };

  const onSubmit = async (data: TransactionForm) => {
    setSubmitting(true);
    try {
      // Campo a campo: o backend recusa qualquer propriedade que não conheça.
      const transferencia = data.tipo === 'transferência';
      // No cartão: `data` é o dia da compra, a conta é a do cartão e quem
      // confirma é o pagamento da fatura.
      const cartao = data.tipo === 'despesa' ? cards.find((c) => c.id === data.cardId) : undefined;
      await api.post('/transactions', {
        descricao: data.descricao,
        tipo: data.tipo,
        data: data.data,
        valor: parseFloat(data.valor),
        accountId: cartao ? cartao.accountId : data.accountId || undefined,
        cardId: cartao?.id,
        contaDestinoId: transferencia ? data.contaDestinoId : undefined,
        categoryId: transferencia ? undefined : data.categoryId || undefined,
        confirmada: cartao ? undefined : data.confirmada,
      });
      // "Repetir todo mês": esta fica como está e a regra cuida dos próximos
      // meses, a partir do mês seguinte, no mesmo dia.
      if (data.recorrente && !transferencia) {
        await api.post('/recurring-rules', {
          tipo: data.tipo,
          descricao: data.descricao,
          valorEstimado: parseFloat(data.valor),
          frequencia: 'mensal',
          dataInicio: mesSeguinte(data.data),
          accountId: cartao ? undefined : data.accountId,
          cardId: cartao?.id,
          categoryId: data.categoryId || undefined,
        });
      }
      setModalOpen(false);
      setPage(1);
      await loadTransactions();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erro ao criar transação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmar = async (t: Transaction) => {
    // Recorrente é estimativa (a luz de cada mês é uma): pergunta o valor real.
    let valor: number | undefined;
    if (t.recurringRuleId) {
      const resposta = prompt(`Valor real de "${t.descricao}":`, String(Number(t.valor)));
      if (resposta === null) return;
      const n = parseFloat(resposta.replace(',', '.'));
      if (!(n > 0)) {
        alert('Valor inválido');
        return;
      }
      valor = Math.round(n * 100) / 100;
    }
    try {
      await api.post(`/transactions/${t.id}/confirmar`, valor === undefined ? {} : { valor });
      await loadTransactions();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erro ao confirmar transação');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta transação?')) return;
    await api.delete(`/transactions/${id}`);
    await loadTransactions();
  };

  const totalPages = Math.ceil(total / LIMIT);

  const categoryOptions = [
    { value: '', label: 'Sem categoria' },
    ...categories.map((c) => ({ value: c.id, label: c.nome })),
  ];

  const accountOptions = [
    { value: '', label: 'Selecione uma conta' },
    ...accounts.map((a) => ({ value: a.id, label: `${a.nome} (${formatCurrency(a.saldoAtual)})` })),
  ];

  return (
    <div className="flex-1">
      <Header
        title="Transações"
        subtitle={`${total} transações encontradas`}
        actions={
          <Button onClick={openModal} size="sm">
            <HiPlus className="h-4 w-4" />
            Nova Transação
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {['', 'receita', 'despesa', 'transferência'].map((tipo) => (
            <button
              key={tipo}
              onClick={() => { setFilterTipo(tipo); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterTipo === tipo
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tipo === '' ? 'Todas' : tipoLabels[tipo]}
            </button>
          ))}
          <span className="w-px bg-gray-200 mx-1" />
          {([
            ['', 'Qualquer status'],
            ['true', 'Realizadas'],
            ['false', 'Agendadas'],
          ] as const).map(([status, label]) => (
            <button
              key={status}
              onClick={() => { setFilterStatus(status); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <Card noPadding>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="text-primary-600" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">💸</p>
              <p className="font-medium">Nenhuma transação encontrada</p>
              <p className="text-sm mt-1">Clique em &quot;Nova Transação&quot; para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* Colunas secundárias somem nas telas menores: no celular
                      sobram data, descrição, valor e a ação de excluir. */}
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Data
                    </th>
                    <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Descrição
                    </th>
                    <th className="hidden md:table-cell text-left px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Categoria
                    </th>
                    <th className="hidden lg:table-cell text-left px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Conta
                    </th>
                    <th className="hidden sm:table-cell text-left px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Tipo
                    </th>
                    <th className="text-right px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Valor
                    </th>
                    <th className="px-4 sm:px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      className={`hover:bg-gray-50 transition-colors ${t.confirmada ? '' : 'opacity-70'}`}
                    >
                      <td className="px-4 sm:px-6 py-3.5 text-gray-500 whitespace-nowrap">
                        {formatDate(t.data)}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 font-medium text-gray-900 max-w-[140px] sm:max-w-[200px] truncate">
                        {t.descricao}
                        {!t.confirmada && (
                          <span className="ml-2 align-middle">
                            <Badge variant="warning">{t.cardId ? 'Na fatura' : 'Agendada'}</Badge>
                          </span>
                        )}
                        {t.cardId && t.dataCompetencia && (
                          <span className="block text-xs font-normal text-gray-400">
                            compra em {formatDate(t.dataCompetencia)} · sai da conta no vencimento da fatura
                          </span>
                        )}
                      </td>
                      <td className="hidden md:table-cell px-4 sm:px-6 py-3.5 text-gray-500">
                        {t.category?.nome ?? '—'}
                      </td>
                      <td className="hidden lg:table-cell px-4 sm:px-6 py-3.5 text-gray-500">
                        {t.card ? `💳 ${t.card.nome}` : t.account?.nome ?? '—'}
                        {t.contaDestino && ` → ${t.contaDestino.nome}`}
                      </td>
                      <td className="hidden sm:table-cell px-4 sm:px-6 py-3.5">
                        <Badge variant={tipoColors[t.tipo] ?? 'default'}>
                          {tipoLabels[t.tipo] ?? t.tipo}
                        </Badge>
                      </td>
                      <td
                        className={`px-4 sm:px-6 py-3.5 text-right font-semibold whitespace-nowrap ${
                          t.tipo === 'receita'
                            ? 'text-green-600'
                            : t.tipo === 'transferência'
                              ? 'text-gray-600'
                              : 'text-red-500'
                        }`}
                      >
                        {/* Transferência não é entrada nem saída: o dinheiro só muda de conta. */}
                        {t.tipo === 'receita' ? '+' : t.tipo === 'transferência' ? '' : '-'}
                        {formatCurrency(t.valor)}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                        {!t.confirmada && !t.cardId && (
                          <button
                            onClick={() => handleConfirmar(t)}
                            className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                            title="Confirmar: já aconteceu"
                          >
                            <HiCheck className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Excluir"
                        >
                          <HiTrash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
              >
                <HiChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                Próxima
                <HiChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New Transaction Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova Transação"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Descrição"
            placeholder="Ex: Supermercado"
            error={errors.descricao?.message}
            {...register('descricao', { required: 'Descrição é obrigatória' })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              error={errors.valor?.message}
              {...register('valor', {
                required: 'Valor é obrigatório',
                min: { value: 0.01, message: 'Valor deve ser positivo' },
              })}
            />
            <Input
              label={noCartao ? 'Data da compra' : 'Data'}
              type="date"
              error={errors.data?.message}
              {...register('data', { required: 'Data é obrigatória' })}
            />
          </div>
          <Select
            label="Tipo"
            options={[
              { value: 'despesa', label: 'Despesa' },
              { value: 'receita', label: 'Receita' },
              { value: 'transferência', label: 'Transferência' },
            ]}
            {...register('tipo', { required: true })}
          />
          {tipo === 'despesa' && cards.length > 0 && (
            <Select
              label="Cartão de crédito"
              options={[
                { value: '', label: 'Não — sai direto da conta' },
                ...cards.map((c) => ({
                  value: c.id,
                  label: `${c.nome}${c.ultimosDigitos ? ` •••• ${c.ultimosDigitos}` : ''}`,
                })),
              ]}
              {...register('cardId')}
            />
          )}
          {noCartao ? (
            <p className="text-xs text-gray-500 -mt-2">
              Entra na fatura pela data da compra e só sai da conta quando você pagar a fatura,
              na tela de Cartões.
            </p>
          ) : (
            <Select
              label={isTransferencia ? 'Conta de origem' : 'Conta'}
              options={accountOptions}
              error={errors.accountId?.message}
              {...register('accountId', {
                validate: (v, form) =>
                  (form.tipo === 'despesa' && !!form.cardId) || !!v || 'Selecione uma conta',
              })}
            />
          )}
          {isTransferencia ? (
            <>
              <Select
                label="Conta de destino"
                options={accountOptions}
                error={errors.contaDestinoId?.message}
                {...register('contaDestinoId', {
                  shouldUnregister: true,
                  required: 'Selecione a conta de destino',
                  validate: (v, form) =>
                    v !== form.accountId || 'Escolha uma conta diferente da de origem',
                })}
              />
              <p className="text-xs text-gray-500">
                Transferência entre suas próprias contas. Não conta como receita nem
                despesa. Um PIX para outra pessoa é despesa.
              </p>
            </>
          ) : (
            <Select
              label="Categoria"
              options={categoryOptions}
              {...register('categoryId')}
            />
          )}
          <label
            className={`flex items-center gap-2 text-sm text-gray-700 cursor-pointer ${noCartao ? 'hidden' : ''}`}
          >
            <input
              type="checkbox"
              className="rounded border-gray-300"
              {...register('confirmada')}
            />
            Já aconteceu (desmarcado: fica agendada e só entra no saldo quando confirmar)
          </label>
          {!isTransferencia && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                {...register('recorrente')}
              />
              Repetir todo mês (cria uma conta recorrente a partir do mês que vem)
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setModalOpen(false)}
            >
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
