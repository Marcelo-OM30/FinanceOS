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
import { useForm } from 'react-hook-form';
import type { Category } from '@/types';
import { HiPlus, HiPencil, HiTrash } from 'react-icons/hi';

interface CategoryForm {
  nome: string;
  tipo: string;
  cor: string;
  icone: string;
}

const tipoLabels: Record<string, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  ambos: 'Ambos',
};

const tipoVariants: Record<string, 'success' | 'danger' | 'info'> = {
  receita: 'success',
  despesa: 'danger',
  ambos: 'info',
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryForm>({
    defaultValues: { tipo: 'despesa', cor: '#0284c7' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Category[]>('/categories');
      setCategories(Array.isArray(res.data) ? res.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    reset({ tipo: 'despesa', cor: '#0284c7' });
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    if (!cat.userId) return; // system categories are read-only
    setEditing(cat);
    reset({
      nome: cat.nome,
      tipo: cat.tipo,
      cor: cat.cor ?? '#0284c7',
      icone: cat.icone ?? '',
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: CategoryForm) => {
    setSubmitting(true);
    try {
      const payload = {
        nome: data.nome,
        tipo: data.tipo,
        cor: data.cor,
        icone: data.icone || undefined,
      };
      if (editing) {
        await api.patch(`/categories/${editing.id}`, payload);
      } else {
        await api.post('/categories', payload);
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erro ao salvar categoria');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta categoria?')) return;
    try {
      await api.delete(`/categories/${id}`);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erro ao excluir');
    }
  };

  const systemCategories = categories.filter((c) => !c.userId);
  const userCategories = categories.filter((c) => !!c.userId);

  return (
    <div className="flex-1">
      <Header
        title="Categorias"
        subtitle="Organize suas transações"
        actions={
          <Button onClick={openCreate} size="sm">
            <HiPlus className="h-4 w-4" />
            Nova Categoria
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="text-primary-600" />
          </div>
        ) : (
          <>
            {/* User categories */}
            {userCategories.length > 0 && (
              <Card header="Minhas Categorias">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {userCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                          style={{
                            background: cat.cor ? `${cat.cor}25` : '#e0f2fe',
                          }}
                        >
                          {cat.icone ?? '🏷️'}
                        </div>
                        <span className="font-medium text-gray-800 text-sm">
                          {cat.nome}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={tipoVariants[cat.tipo] ?? 'default'}>
                          {tipoLabels[cat.tipo]}
                        </Badge>
                        <button
                          onClick={() => openEdit(cat)}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                        >
                          <HiPencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          <HiTrash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* System categories */}
            {systemCategories.length > 0 && (
              <Card header="Categorias do Sistema (somente leitura)">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {systemCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                        style={{
                          background: cat.cor ? `${cat.cor}25` : '#f1f5f9',
                        }}
                      >
                        {cat.icone ?? '🏷️'}
                      </div>
                      <span className="text-sm text-gray-700 font-medium flex-1">
                        {cat.nome}
                      </span>
                      <Badge variant={tipoVariants[cat.tipo] ?? 'default'}>
                        {tipoLabels[cat.tipo]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {categories.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">🏷️</p>
                <p className="font-medium">Nenhuma categoria</p>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Categoria' : 'Nova Categoria'}
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nome"
            placeholder="Ex: Alimentação"
            error={errors.nome?.message}
            {...register('nome', { required: 'Nome é obrigatório' })}
          />
          <Select
            label="Tipo"
            options={[
              { value: 'despesa', label: 'Despesa' },
              { value: 'receita', label: 'Receita' },
              { value: 'ambos', label: 'Ambos' },
            ]}
            {...register('tipo', { required: true })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Emoji/Ícone"
              placeholder="🏷️"
              maxLength={2}
              {...register('icone')}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
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
