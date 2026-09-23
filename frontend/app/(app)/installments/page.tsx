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
import type { Account, Card as CreditCard, Category, Installment } from '@/types';
import { HiPlus, HiX } from 'react-icons/hi';

interface InstallmentForm {
  descricao: string;
  valorTotal: string;
  numeroParcelas: string;
  dataCompra: string;
  primeiroVencimento: string;
  accountId: string;
  cardId: string;
  categoryId: string;
}

const statusBadge: Record<Installment['status'], { label: string; variant: 'info' | 'success' | 'default' }> = {
  ativa: { label: 'Em andamento', variant: 'info' },
  quitada: { label: 'Quitado', variant: 'success' },
  cancelada: { label: 'Cancelado', variant: 'default' },
};

// Mesma regra do backend (resíduo na primeira parcela), só para a prévia.
function previaParcelas(total: number, n: number): [number, number] | null {
  if (!(total > 0) || !(n >= 2)) return null;
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / n);
  if (base < 1) return null;
  return [(base + centavos - base * n) / 100, base / 100];
}

export default function InstallmentsPage() {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<InstallmentForm>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, a, c, k] = await Promise.all([
        api.get<{ data: Installment[] }>('/installments'),
        api.get<Account[]>('/accounts'),
        api.get<Category[]>('/categories'),
        api.get<CreditCard[]>('/cards'),
      ]);
      setCards(Array.isArray(k.data) ? k.data.filter((card) => card.tipo === 'crédito') : []);
      setInstallments(Array.isArray(i.data?.data) ? i.data.data : []);
      setAccounts(Array.isArray(a.data) ? a.data : []);
      setCategories(Array.isArray(c.data) ? c.data.filter((cat) => cat.tipo !== 'receita') : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = () => {
    reset({
      numeroParcelas: '12',
      dataCompra: todayISO(),
      primeiroVencimento: todayISO(),
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: InstallmentForm) => {
    setSubmitting(true);
    try {
      // Campo a campo: o backend recusa qualquer propriedade que não conheça.
      // No cartão, conta e vencimentos vêm do cartão e das faturas.
      const noCartao = !!data.cardId;
      await api.post('/installments', {
        descricao: data.descricao,
        valorTotal: parseFloat(data.valorTotal),
        numeroParcelas: parseInt(data.numeroParcelas, 10),
        dataCompra: data.dataCompra,
        primeiroVencimento: noCartao ? undefined : data.primeiroVencimento,
        accountId: noCartao ? undefined : data.accountId,
        cardId: noCartao ? data.cardId : undefined,
        categoryId: data.categoryId || undefined,
      });
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join('\n') : msg ?? 'Erro ao criar parcelamento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (i: Installment) => {
    const aviso =
      i.parcelasPagas > 0
        ? `Cancelar "${i.descricao}"? As ${i.parcelasRestantes} parcelas futuras serão excluídas; as ${i.parcelasPagas} já pagas ficam.`
        : `Cancelar "${i.descricao}"? Todas as parcelas serão excluídas.`;
    if (!confirm(aviso)) return;
    await api.delete(`/installments/${i.id}`);
    await load();
  };

  const cardId = watch('cardId');
  const previa = previaParcelas(parseFloat(watch('valorTotal')), parseInt(watch('numeroParcelas'), 10));

  const accountOptions = [
    { value: '', label: 'Selecione uma conta' },
    ...accounts.map((a) => ({ value: a.id, label: a.nome })),
  ];
  const categoryOptions = [
    { value: '', label: 'Sem categoria' },
    ...categories.map((c) => ({ value: c.id, label: c.nome })),
  ];

  return (
    <div className="flex-1">
      <Header
        title="Parcelamentos"
        subtitle="Compras parceladas e quanto ainda falta pagar"
        actions={
          <Button onClick={openModal} size="sm">
            <HiPlus className="h-4 w-4" />
            Novo Parcelamento
          </Button>
        }
      />

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="text-primary-600" />
          </div>
        ) : installments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🧾</p>
            <p className="font-medium">Nenhum parcelamento cadastrado</p>
            <p className="text-sm mt-1">
              Cadastre uma compra parcelada e as parcelas aparecem nos meses seguintes
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {installments.map((i) => {
              const total = Number(i.valorTotal);
              const pct = total > 0 ? Math.round((i.valorPago / total) * 100) : 0;
              const badge = statusBadge[i.status];
              return (
                <Card key={i.id}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{i.descricao}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {i.numeroParcelas}x de {formatCurrency(Number(i.valorParcela))} ·{' '}
                        {i.cardId
                          ? `💳 ${cards.find((c) => c.id === i.cardId)?.nome ?? 'Cartão'}`
                          : i.account?.nome ?? 'Conta'}
                        {i.category ? ` · ${i.category.nome}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {i.status === 'ativa' && (
                        <button
                          onClick={() => handleCancel(i)}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Cancelar parcelamento"
                        >
                          <HiX className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full bg-primary-600 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
                    <span className="text-gray-500">
                      Pagas:{' '}
                      <span className="font-medium text-gray-900">
                        {i.parcelasPagas}/{i.numeroParcelas}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      Falta:{' '}
                      <span className="font-medium text-gray-900">
                        {formatCurrency(i.saldoDevedor)}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      {i.proximoVencimento ? (
                        <>
                          Próxima:{' '}
                          <span className="font-medium text-gray-900">
                            {formatDate(i.proximoVencimento)}
                          </span>
                        </>
                      ) : (
                        <>Total: <span className="font-medium text-gray-900">{formatCurrency(total)}</span></>
                      )}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Novo Parcelamento">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Descrição"
            placeholder="Ex: Notebook"
            error={errors.descricao?.message}
            {...register('descricao', { required: 'Descrição é obrigatória' })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Valor total (R$)"
              type="number"
              step="0.01"
              min="0.02"
              placeholder="0,00"
              error={errors.valorTotal?.message}
              {...register('valorTotal', {
                required: 'Valor é obrigatório',
                min: { value: 0.02, message: 'Valor deve ser positivo' },
              })}
            />
            <Input
              label="Parcelas"
              type="number"
              step="1"
              min="2"
              max="120"
              error={errors.numeroParcelas?.message}
              {...register('numeroParcelas', {
                required: 'Informe o número de parcelas',
                min: { value: 2, message: 'Mínimo de 2 parcelas' },
                max: { value: 120, message: 'Máximo de 120 parcelas' },
              })}
            />
          </div>
          {previa && (
            <p className="text-xs text-gray-500 -mt-2">
              {previa[0] === previa[1]
                ? `${watch('numeroParcelas')}x de ${formatCurrency(previa[1])}`
                : `1ª de ${formatCurrency(previa[0])} e as demais de ${formatCurrency(previa[1])}`}
            </p>
          )}
          {cards.length > 0 && (
            <Select
              label="Cartão de crédito"
              options={[
                { value: '', label: 'Não — carnê, boleto ou crediário' },
                ...cards.filter((c) => c.ativo).map((c) => ({ value: c.id, label: c.nome })),
              ]}
              {...register('cardId')}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Data da compra"
              type="date"
              error={errors.dataCompra?.message}
              {...register('dataCompra', { required: 'Informe a data da compra' })}
            />
            {!cardId && (
              <Input
                label="1º vencimento"
                type="date"
                error={errors.primeiroVencimento?.message}
                {...register('primeiroVencimento', {
                  validate: (v, form) =>
                    !!form.cardId ||
                    (!v
                      ? 'Informe o primeiro vencimento'
                      : !form.dataCompra || v >= form.dataCompra || 'Não pode ser antes da compra'),
                })}
              />
            )}
          </div>
          {!cardId && (
            <Select
              label="Conta que paga"
              options={accountOptions}
              error={errors.accountId?.message}
              {...register('accountId', {
                validate: (v, form) => !!form.cardId || !!v || 'Selecione uma conta',
              })}
            />
          )}
          <Select label="Categoria" options={categoryOptions} {...register('categoryId')} />
          <p className="text-xs text-gray-500">
            {cardId
              ? 'Cada parcela entra numa fatura, a partir da fatura da compra, e é paga junto com ela.'
              : 'Parcelas já vencidas entram como pagas; as futuras ficam agendadas e aparecem na projeção.'}
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
