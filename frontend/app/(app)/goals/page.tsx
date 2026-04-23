'use client';
import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useForm } from 'react-hook-form';
import type { Goal } from '@/types';
import { HiPlus, HiTrash, HiPlusCircle } from 'react-icons/hi';
import { clsx } from 'clsx';

interface GoalForm {
  nome: string;
  descricao: string;
  valorAlvo: string;
  valorAtual: string;
  dataAlvo: string;
  cor: string;
}

interface ProgressForm {
  valor: string;
  descricao: string;
}

const statusColors: Record<string, 'success' | 'info' | 'warning' | 'default' | 'danger'> = {
  ativa: 'info',
  concluída: 'success',
  pausada: 'warning',
  cancelada: 'danger',
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [progressModal, setProgressModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const goalForm = useForm<GoalForm>({
    defaultValues: { cor: '#0284c7', valorAtual: '0' },
  });
  const progressForm = useForm<ProgressForm>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Goal[]>('/goals');
      setGoals(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSubmitGoal = async (data: GoalForm) => {
    setSubmitting(true);
    try {
      await api.post('/goals', {
        nome: data.nome,
        descricao: data.descricao || undefined,
        valorAlvo: parseFloat(data.valorAlvo),
        valorAtual: parseFloat(data.valorAtual || '0'),
        dataAlvo: data.dataAlvo || undefined,
        cor: data.cor,
      });
      setModalOpen(false);
      goalForm.reset({ cor: '#0284c7', valorAtual: '0' });
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erro ao criar meta');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitProgress = async (data: ProgressForm) => {
    if (!progressModal) return;
    setSubmitting(true);
    try {
      await api.post(`/goals/${progressModal}/progress`, {
        valor: parseFloat(data.valor),
        descricao: data.descricao || undefined,
      });
      setProgressModal(null);
      progressForm.reset();
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erro ao registrar progresso');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta meta?')) return;
    await api.delete(`/goals/${id}`);
    await load();
  };

  return (
    <div className="flex-1">
      <Header
        title="Metas"
        subtitle="Acompanhe suas metas de economia"
        actions={
          <Button onClick={() => setModalOpen(true)} size="sm">
            <HiPlus className="h-4 w-4" />
            Nova Meta
          </Button>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="text-primary-600" />
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🎯</p>
            <p className="font-medium">Nenhuma meta cadastrada</p>
            <p className="text-sm mt-1">Defina objetivos de economia</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {goals.map((g) => {
              const pct = Math.min(g.percentualProgresso, 100);
              return (
                <Card key={g.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ background: g.cor ? `${g.cor}25` : '#e0f2fe' }}
                      >
                        🎯
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{g.nome}</p>
                        {g.dataAlvo && (
                          <p className="text-xs text-gray-400">
                            Prazo: {formatDate(g.dataAlvo)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={statusColors[g.status] ?? 'default'}>
                        {g.status}
                      </Badge>
                      {g.emRisco && (
                        <Badge variant="danger">Em risco</Badge>
                      )}
                      <button
                        onClick={() => { setProgressModal(g.id); progressForm.reset(); }}
                        className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                        title="Registrar progresso"
                      >
                        <HiPlusCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(g.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <HiTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all',
                          g.status === 'concluída'
                            ? 'bg-green-500'
                            : g.emRisco
                            ? 'bg-amber-400'
                            : 'bg-primary-500'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {pct.toFixed(1)}%
                    </p>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Atual:{' '}
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(g.valorAtual)}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      Meta:{' '}
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(g.valorAlvo)}
                      </span>
                    </span>
                    {g.diasRestantes !== undefined && g.diasRestantes >= 0 && (
                      <span className="text-gray-400 text-xs self-end">
                        {g.diasRestantes} dias
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* New Goal Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova Meta"
      >
        <form
          onSubmit={goalForm.handleSubmit(onSubmitGoal)}
          className="space-y-4"
        >
          <Input
            label="Nome da meta"
            placeholder="Ex: Reserva de emergência"
            error={goalForm.formState.errors.nome?.message}
            {...goalForm.register('nome', { required: 'Nome é obrigatório' })}
          />
          <Input
            label="Descrição (opcional)"
            placeholder="Detalhes sobre a meta"
            {...goalForm.register('descricao')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor alvo (R$)"
              type="number"
              step="0.01"
              min="0.01"
              error={goalForm.formState.errors.valorAlvo?.message}
              {...goalForm.register('valorAlvo', { required: 'Valor é obrigatório' })}
            />
            <Input
              label="Valor inicial (R$)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              {...goalForm.register('valorAtual')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Prazo (opcional)"
              type="date"
              {...goalForm.register('dataAlvo')}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
              <input
                type="color"
                className="h-10 w-full rounded-lg border border-gray-300 cursor-pointer"
                {...goalForm.register('cor')}
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
              Criar Meta
            </Button>
          </div>
        </form>
      </Modal>

      {/* Progress Modal */}
      <Modal
        isOpen={!!progressModal}
        onClose={() => setProgressModal(null)}
        title="Registrar Progresso"
        size="sm"
      >
        <form
          onSubmit={progressForm.handleSubmit(onSubmitProgress)}
          className="space-y-4"
        >
          <Input
            label="Valor depositado (R$)"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            error={progressForm.formState.errors.valor?.message}
            {...progressForm.register('valor', {
              required: 'Informe o valor',
              min: { value: 0.01, message: 'Valor deve ser positivo' },
            })}
          />
          <Input
            label="Descrição (opcional)"
            placeholder="Ex: Salário de abril"
            {...progressForm.register('descricao')}
          />
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setProgressModal(null)}
            >
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
