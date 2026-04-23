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
import { formatCurrency, getMonthName, getCurrentMonthYear } from '@/lib/format';
import { useForm } from 'react-hook-form';
import type { Budget, Category } from '@/types';
import { HiPlus, HiTrash } from 'react-icons/hi';
import { clsx } from 'clsx';

interface BudgetForm {
  categoryId: string;
  valorLimite: string;
  mes: string;
  ano: string;
  alertaPercentual: string;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const now = getCurrentMonthYear();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BudgetForm>({
    defaultValues: {
      mes: String(now.mes),
      ano: String(now.ano),
      alertaPercentual: '80',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([
        api.get<Budget[]>('/budgets'),
        api.get<Category[]>('/categories'),
      ]);
      setBudgets(b.data);
      setCategories(c.data.filter((c) => c.tipo !== 'receita'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = () => {
    reset({
      mes: String(now.mes),
      ano: String(now.ano),
      alertaPercentual: '80',
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: BudgetForm) => {
    setSubmitting(true);
    try {
      await api.post('/budgets', {
        categoryId: data.categoryId,
        valorLimite: parseFloat(data.valorLimite),
        mes: parseInt(data.mes),
        ano: parseInt(data.ano),
        alertaPercentual: parseInt(data.alertaPercentual),
      });
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erro ao criar orçamento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este orçamento?')) return;
    await api.delete(`/budgets/${id}`);
    await load();
  };

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.nome,
  }));

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: getMonthName(i + 1),
  }));

  return (
    <div className="flex-1">
      <Header
        title="Orçamentos"
        subtitle="Controle seus gastos por categoria"
        actions={
          <Button onClick={openModal} size="sm">
            <HiPlus className="h-4 w-4" />
            Novo Orçamento
          </Button>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="text-primary-600" />
          </div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📊</p>
            <p className="font-medium">Nenhum orçamento cadastrado</p>
            <p className="text-sm mt-1">Defina limites de gastos por categoria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {budgets.map((b) => {
              const pct = Math.min(b.percentualUtilizado, 100);
              return (
                <Card key={b.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {b.category?.nome ?? 'Categoria'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {getMonthName(b.mes)} de {b.ano}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.estourado && (
                        <Badge variant="danger">Estourado</Badge>
                      )}
                      {b.emAlerta && !b.estourado && (
                        <Badge variant="warning">Em alerta</Badge>
                      )}
                      {!b.emAlerta && !b.estourado && (
                        <Badge variant="success">Normal</Badge>
                      )}
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <HiTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all',
                          b.estourado
                            ? 'bg-red-500'
                            : b.emAlerta
                            ? 'bg-amber-400'
                            : 'bg-green-500'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Gasto:{' '}
                      <span className="font-medium text-gray-900">
                        {formatCurrency(b.gastoAtual)}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      Limite:{' '}
                      <span className="font-medium text-gray-900">
                        {formatCurrency(b.valorLimite)}
                      </span>
                    </span>
                    <span
                      className={clsx(
                        'font-semibold',
                        b.estourado
                          ? 'text-red-500'
                          : b.emAlerta
                          ? 'text-amber-600'
                          : 'text-green-600'
                      )}
                    >
                      {b.percentualUtilizado.toFixed(1)}%
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo Orçamento"
      >
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
            error={errors.valorLimite?.message}
            {...register('valorLimite', { required: 'Limite é obrigatório' })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Mês"
              options={monthOptions}
              {...register('mes', { required: true })}
            />
            <Input
              label="Ano"
              type="number"
              min="2020"
              max="2030"
              {...register('ano', { required: true })}
            />
          </div>
          <Input
            label="Alerta em (% do limite)"
            type="number"
            min="1"
            max="100"
            hint="Você será alertado ao atingir este percentual"
            {...register('alertaPercentual')}
          />

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
              Criar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
