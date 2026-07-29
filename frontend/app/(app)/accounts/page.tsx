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
import { formatCurrency } from '@/lib/format';
import { useForm } from 'react-hook-form';
import type { Account } from '@/types';
import { HiPlus, HiPencil, HiTrash } from 'react-icons/hi';

interface AccountForm {
  nome: string;
  tipo: string;
  banco: string;
  saldoInicial: string;
  moeda: string;
  cor: string;
}

const tipoOptions = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'carteira', label: 'Carteira' },
];

const tipoIcons: Record<string, string> = {
  corrente: '🏦',
  poupanca: '🐷',
  investimento: '📈',
  carteira: '👛',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountForm>({
    defaultValues: { tipo: 'corrente', moeda: 'BRL', cor: '#0284c7' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Account[]>('/accounts');
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    reset({ tipo: 'corrente', moeda: 'BRL', cor: '#0284c7', saldoInicial: '0' });
    setModalOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    reset({
      nome: acc.nome,
      tipo: acc.tipo,
      banco: acc.banco ?? '',
      saldoInicial: String(acc.saldoInicial),
      moeda: acc.moeda,
      cor: acc.cor ?? '#0284c7',
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: AccountForm) => {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        saldoInicial: parseFloat(data.saldoInicial),
        banco: data.banco || undefined,
      };
      if (editing) {
        await api.patch(`/accounts/${editing.id}`, payload);
      } else {
        await api.post('/accounts', payload);
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erro ao salvar conta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta conta?')) return;
    await api.delete(`/accounts/${id}`);
    await load();
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.saldoAtual, 0);

  return (
    <div className="flex-1">
      <Header
        title="Contas"
        subtitle="Gerencie suas contas bancárias"
        actions={
          <Button onClick={openCreate} size="sm">
            <HiPlus className="h-4 w-4" />
            Nova Conta
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Total balance */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Saldo Total Consolidado</p>
              <p
                className={`text-3xl font-bold mt-1 ${
                  totalBalance >= 0 ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <span className="text-4xl">🏦</span>
          </div>
        </Card>

        {/* Accounts grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="text-primary-600" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏦</p>
            <p className="font-medium">Nenhuma conta cadastrada</p>
            <p className="text-sm mt-1">Adicione suas contas bancárias</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <Card key={acc.id}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: acc.cor ? `${acc.cor}20` : '#e0f2fe' }}
                    >
                      {tipoIcons[acc.tipo] ?? '🏦'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{acc.nome}</p>
                      {acc.banco && (
                        <p className="text-xs text-gray-400">{acc.banco}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(acc)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <HiPencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <HiTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Saldo atual</p>
                    <p
                      className={`text-xl font-bold ${
                        acc.saldoAtual >= 0 ? 'text-gray-900' : 'text-red-500'
                      }`}
                    >
                      {formatCurrency(acc.saldoAtual)}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge variant="info">
                      {tipoOptions.find((t) => t.value === acc.tipo)?.label ?? acc.tipo}
                    </Badge>
                    {!acc.ativo && <Badge variant="default">Inativa</Badge>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Conta' : 'Nova Conta'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nome da conta"
            placeholder="Ex: Nubank, Itaú"
            error={errors.nome?.message}
            {...register('nome', { required: 'Nome é obrigatório' })}
          />
          <Select
            label="Tipo"
            options={tipoOptions}
            {...register('tipo', { required: true })}
          />
          <Input
            label="Banco (opcional)"
            placeholder="Ex: Nubank"
            {...register('banco')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Saldo inicial (R$)"
              type="number"
              step="0.01"
              placeholder="0,00"
              error={errors.saldoInicial?.message}
              {...register('saldoInicial', { required: true })}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cor
              </label>
              <input
                type="color"
                className="h-10 w-full rounded-lg border border-gray-300 cursor-pointer"
                {...register('cor')}
              />
            </div>
          </div>

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
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
