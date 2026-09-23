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
import type { Account, Card as CreditCard, CardInvoice } from '@/types';
import { HiPlus, HiTrash, HiChevronDown, HiChevronUp } from 'react-icons/hi';

interface CardForm {
  nome: string;
  accountId: string;
  ultimosDigitos: string;
  bandeira: string;
  limite: string;
  dataFechamentoFatura: string;
  vencimentoFatura: string;
}

interface PagamentoForm {
  accountId: string;
  data: string;
}

const statusFatura: Record<CardInvoice['status'], { label: string; variant: 'info' | 'warning' | 'success' }> = {
  aberta: { label: 'Aberta', variant: 'info' },
  fechada: { label: 'Fechada', variant: 'warning' },
  paga: { label: 'Paga', variant: 'success' },
};

const bandeiras = ['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outro'];

function mensagemDeErro(err: unknown, padrao: string): string {
  const e = err as { response?: { data?: { message?: string | string[] } } };
  const msg = e.response?.data?.message;
  return Array.isArray(msg) ? msg.join('\n') : msg ?? padrao;
}

export default function CardsPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [faturas, setFaturas] = useState<CardInvoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCartao, setModalCartao] = useState(false);
  const [faturaPagando, setFaturaPagando] = useState<CardInvoice | null>(null);
  const [aberta, setAberta] = useState<CardInvoice | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cartaoForm = useForm<CardForm>();
  const pagamentoForm = useForm<PagamentoForm>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, f, a] = await Promise.all([
        api.get<CreditCard[]>('/cards'),
        api.get<{ data: CardInvoice[] }>('/card-invoices'),
        api.get<Account[]>('/accounts'),
      ]);
      setCards(Array.isArray(c.data) ? c.data.filter((card) => card.tipo === 'crédito') : []);
      setFaturas(Array.isArray(f.data?.data) ? f.data.data : []);
      setAccounts(Array.isArray(a.data) ? a.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const abrirNovoCartao = () => {
    cartaoForm.reset({ bandeira: '', dataFechamentoFatura: '', vencimentoFatura: '' });
    setModalCartao(true);
  };

  const salvarCartao = async (data: CardForm) => {
    setSubmitting(true);
    try {
      // Campo a campo: o backend recusa qualquer propriedade que não conheça.
      await api.post('/cards', {
        nome: data.nome,
        accountId: data.accountId,
        tipo: 'crédito',
        ultimosDigitos: data.ultimosDigitos || undefined,
        bandeira: data.bandeira || undefined,
        limite: data.limite ? parseFloat(data.limite) : undefined,
        dataFechamentoFatura: parseInt(data.dataFechamentoFatura, 10),
        vencimentoFatura: parseInt(data.vencimentoFatura, 10),
      });
      setModalCartao(false);
      await load();
    } catch (err) {
      alert(mensagemDeErro(err, 'Erro ao salvar cartão'));
    } finally {
      setSubmitting(false);
    }
  };

  const excluirCartao = async (card: CreditCard) => {
    if (!confirm(`Excluir o cartão ${card.nome}?`)) return;
    try {
      await api.delete(`/cards/${card.id}`);
    } catch (err) {
      const msg = mensagemDeErro(err, 'Erro ao excluir cartão');
      if (!confirm(`${msg}.\n\nDesativar o cartão? Ele some da lista de compras, mas o histórico fica.`)) return;
      await api.patch(`/cards/${card.id}`, { ativo: false });
    }
    await load();
  };

  const abrirPagamento = (fatura: CardInvoice, card: CreditCard) => {
    pagamentoForm.reset({ accountId: card.accountId, data: todayISO() });
    setFaturaPagando(fatura);
  };

  const pagar = async (data: PagamentoForm) => {
    if (!faturaPagando) return;
    setSubmitting(true);
    try {
      await api.post(`/card-invoices/${faturaPagando.id}/pagar`, {
        accountId: data.accountId,
        data: data.data,
      });
      setFaturaPagando(null);
      setAberta(null);
      await load();
    } catch (err) {
      alert(mensagemDeErro(err, 'Erro ao pagar fatura'));
    } finally {
      setSubmitting(false);
    }
  };

  const desfazerPagamento = async (fatura: CardInvoice) => {
    if (!confirm('Desfazer o pagamento? O valor volta para a conta e as compras voltam a ficar em aberto.')) return;
    try {
      await api.post(`/card-invoices/${fatura.id}/desfazer-pagamento`);
      setAberta(null);
      await load();
    } catch (err) {
      alert(mensagemDeErro(err, 'Erro ao desfazer pagamento'));
    }
  };

  const alternarDetalhe = async (fatura: CardInvoice) => {
    if (aberta?.id === fatura.id) {
      setAberta(null);
      return;
    }
    const res = await api.get<CardInvoice>(`/card-invoices/${fatura.id}`);
    setAberta(res.data);
  };

  const accountOptions = [
    { value: '', label: 'Selecione uma conta' },
    ...accounts.map((a) => ({ value: a.id, label: a.nome })),
  ];

  return (
    <div className="flex-1">
      <Header
        title="Cartões"
        subtitle="Cartões de crédito e suas faturas"
        actions={
          <Button onClick={abrirNovoCartao} size="sm">
            <HiPlus className="h-4 w-4" />
            Novo Cartão
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="text-primary-600" />
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">💳</p>
            <p className="font-medium">Nenhum cartão de crédito cadastrado</p>
            <p className="text-sm mt-1">
              Compras no cartão entram na fatura e só saem da conta quando você paga
            </p>
          </div>
        ) : (
          cards.map((card) => {
            const doCartao = faturas.filter((f) => f.cardId === card.id);
            const emAberto = doCartao
              .filter((f) => f.status !== 'paga')
              .reduce((acc, f) => acc + Number(f.valorTotal), 0);
            const limite = card.limite ? Number(card.limite) : null;
            return (
              <Card key={card.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {card.nome}
                      {card.ultimosDigitos && (
                        <span className="text-gray-400 font-normal"> •••• {card.ultimosDigitos}</span>
                      )}
                      {!card.ativo && (
                        <span className="ml-2 align-middle">
                          <Badge variant="default">Desativado</Badge>
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Fecha dia {card.dataFechamentoFatura ?? '—'} · vence dia {card.vencimentoFatura ?? '—'} ·{' '}
                      paga pela {accounts.find((a) => a.id === card.accountId)?.nome ?? 'conta'}
                    </p>
                  </div>
                  <button
                    onClick={() => excluirCartao(card)}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    title="Excluir cartão"
                  >
                    <HiTrash className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-sm text-gray-500 mt-3">
                  Em aberto:{' '}
                  <span className="font-semibold text-gray-900">{formatCurrency(emAberto)}</span>
                  {limite !== null && <> de {formatCurrency(limite)} de limite</>}
                </p>

                {doCartao.length === 0 ? (
                  <p className="text-sm text-gray-400 mt-3">Nenhuma fatura ainda.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
                    {doCartao.map((f) => {
                      const badge = statusFatura[f.status];
                      const detalhe = aberta?.id === f.id ? aberta : null;
                      return (
                        <li key={f.id} className="py-2.5">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <button
                              onClick={() => alternarDetalhe(f)}
                              className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-primary-600"
                            >
                              {detalhe ? <HiChevronUp className="h-4 w-4" /> : <HiChevronDown className="h-4 w-4" />}
                              {String(f.mes).padStart(2, '0')}/{f.ano}
                            </button>
                            <span className="text-xs text-gray-400">vence {formatDate(f.dataVencimento)}</span>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                            <span className="ml-auto font-semibold text-gray-900">
                              {formatCurrency(Number(f.valorTotal))}
                            </span>
                            {f.status === 'paga' ? (
                              <Button variant="secondary" size="sm" onClick={() => desfazerPagamento(f)}>
                                Desfazer
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => abrirPagamento(f, card)}>
                                Pagar
                              </Button>
                            )}
                          </div>
                          {detalhe && (
                            <ul className="mt-2 ml-5 space-y-1 text-sm">
                              {(detalhe.transacoes ?? []).map((t) => (
                                <li key={t.id} className="flex justify-between gap-3 text-gray-600">
                                  <span className="truncate">
                                    <span className="text-gray-400">
                                      {formatDate(t.dataCompetencia ?? t.data)}
                                    </span>{' '}
                                    {t.descricao}
                                  </span>
                                  <span className="whitespace-nowrap">{formatCurrency(Number(t.valor))}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })
        )}
      </div>

      <Modal isOpen={modalCartao} onClose={() => setModalCartao(false)} title="Novo Cartão de Crédito">
        <form onSubmit={cartaoForm.handleSubmit(salvarCartao)} className="space-y-4">
          <Input
            label="Nome"
            placeholder="Ex: Nubank"
            error={cartaoForm.formState.errors.nome?.message}
            {...cartaoForm.register('nome', { required: 'Nome é obrigatório' })}
          />
          <Select
            label="Conta que paga a fatura"
            options={accountOptions}
            error={cartaoForm.formState.errors.accountId?.message}
            {...cartaoForm.register('accountId', { required: 'Selecione uma conta' })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Fecha no dia"
              type="number"
              min="1"
              max="28"
              error={cartaoForm.formState.errors.dataFechamentoFatura?.message}
              {...cartaoForm.register('dataFechamentoFatura', {
                required: 'Informe o dia',
                min: { value: 1, message: 'Entre 1 e 28' },
                max: { value: 28, message: 'Entre 1 e 28' },
              })}
            />
            <Input
              label="Vence no dia"
              type="number"
              min="1"
              max="28"
              error={cartaoForm.formState.errors.vencimentoFatura?.message}
              {...cartaoForm.register('vencimentoFatura', {
                required: 'Informe o dia',
                min: { value: 1, message: 'Entre 1 e 28' },
                max: { value: 28, message: 'Entre 1 e 28' },
              })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Últimos 4 dígitos (opcional)"
              inputMode="numeric"
              maxLength={4}
              error={cartaoForm.formState.errors.ultimosDigitos?.message}
              {...cartaoForm.register('ultimosDigitos', {
                pattern: { value: /^\d{4}$/, message: 'Exatamente 4 dígitos' },
              })}
            />
            <Input
              label="Limite (opcional)"
              type="number"
              step="0.01"
              min="0"
              {...cartaoForm.register('limite')}
            />
          </div>
          <Select
            label="Bandeira (opcional)"
            options={[{ value: '', label: '—' }, ...bandeiras.map((b) => ({ value: b, label: b }))]}
            {...cartaoForm.register('bandeira')}
          />
          <p className="text-xs text-gray-500">
            Não guardamos o número do cartão, só os 4 últimos dígitos, para você identificá-lo.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setModalCartao(false)}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth loading={submitting}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!faturaPagando}
        onClose={() => setFaturaPagando(null)}
        title={
          faturaPagando
            ? `Pagar fatura ${String(faturaPagando.mes).padStart(2, '0')}/${faturaPagando.ano}`
            : 'Pagar fatura'
        }
      >
        <form onSubmit={pagamentoForm.handleSubmit(pagar)} className="space-y-4">
          <p className="text-sm text-gray-600">
            Valor:{' '}
            <span className="font-semibold text-gray-900">
              {formatCurrency(Number(faturaPagando?.valorTotal ?? 0))}
            </span>{' '}
            — sempre o total da fatura.
          </p>
          <Select
            label="Pagar com a conta"
            options={accountOptions}
            error={pagamentoForm.formState.errors.accountId?.message}
            {...pagamentoForm.register('accountId', { required: 'Selecione uma conta' })}
          />
          <Input
            label="Data do pagamento"
            type="date"
            {...pagamentoForm.register('data', { required: true })}
          />
          <p className="text-xs text-gray-500">
            O valor sai da conta e as compras da fatura passam a contar como realizadas.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setFaturaPagando(null)}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth loading={submitting}>
              Pagar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
