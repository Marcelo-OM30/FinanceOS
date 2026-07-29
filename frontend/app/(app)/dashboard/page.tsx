'use client';
import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import type {
  DashboardSummary,
  ChartCategoryItem,
  ChartEvolutionItem,
  Projection,
} from '@/types';
import {
  HiTrendingUp,
  HiTrendingDown,
  HiScale,
  HiCurrencyDollar,
  HiBell,
} from 'react-icons/hi';

const CHART_COLORS = [
  '#0284c7',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [categories, setCategories] = useState<ChartCategoryItem[]>([]);
  const [evolution, setEvolution] = useState<ChartEvolutionItem[]>([]);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DashboardSummary>('/dashboard/summary'),
      api.get<ChartCategoryItem[]>('/dashboard/chart-categories'),
      api.get<ChartEvolutionItem[]>('/dashboard/chart-evolution?meses=6'),
      api.get<Projection>('/dashboard/projection'),
    ])
      .then(([s, c, e, p]) => {
        setSummary(s.data);
        setCategories(Array.isArray(c.data) ? c.data : []);
        setEvolution(Array.isArray(e.data) ? e.data : []);
        setProjection(p.data);
      })
      .catch(() => {
        // partial failures are acceptable
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="lg" className="text-primary-600" />
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Saldo Consolidado',
      value: summary?.saldoConsolidado ?? 0,
      icon: HiScale,
      colorText: 'text-primary-600',
      colorBg: 'bg-blue-50',
    },
    {
      label: 'Entradas do Mês',
      value: summary?.entradasMes ?? 0,
      icon: HiTrendingUp,
      colorText: 'text-green-600',
      colorBg: 'bg-green-50',
    },
    {
      label: 'Saídas do Mês',
      value: summary?.saidasMes ?? 0,
      icon: HiTrendingDown,
      colorText: 'text-red-500',
      colorBg: 'bg-red-50',
    },
    {
      label: 'Resultado do Mês',
      value: summary?.resultado ?? 0,
      icon: HiCurrencyDollar,
      colorText: (summary?.resultado ?? 0) >= 0 ? 'text-green-600' : 'text-red-500',
      colorBg: (summary?.resultado ?? 0) >= 0 ? 'bg-green-50' : 'bg-red-50',
    },
  ];

  return (
    <div className="flex-1">
      <Header
        title="Dashboard"
        subtitle="Visão geral das suas finanças"
        actions={
          summary && summary.alertasNaoLidos > 0 ? (
            <span className="flex items-center gap-1.5 text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              <HiBell className="h-4 w-4" />
              {summary.alertasNaoLidos} alerta{summary.alertasNaoLidos > 1 ? 's' : ''}
            </span>
          ) : undefined
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <Card key={card.label}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${card.colorText}`}>
                    {formatCurrency(card.value)}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${card.colorBg}`}>
                  <card.icon className={`h-6 w-6 ${card.colorText}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Expenses by Category */}
          <Card header="Despesas por Categoria (mês atual)">
            {categories.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                Nenhuma despesa registrada este mês
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={categories}
                        dataKey="total"
                        nameKey="categoria"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {categories.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 w-full space-y-2">
                  {categories.slice(0, 7).map((c, i) => (
                    <div
                      key={c.categoria}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                        <span className="text-gray-700 truncate">
                          {c.categoria}
                        </span>
                      </div>
                      <span className="text-gray-500 font-medium ml-2 flex-shrink-0">
                        {c.percentual.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Evolution */}
          <Card header="Receitas × Despesas (6 meses)">
            {evolution.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                Sem dados suficientes
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={evolution}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar
                    dataKey="receitas"
                    name="Receitas"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="despesas"
                    name="Despesas"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Projection */}
        {projection && (
          <Card>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">
                  Projeção de Saldo (fim do mês)
                </p>
                <p
                  className={`text-3xl font-bold mt-1 ${
                    projection.saldoProjetado >= 0
                      ? 'text-green-600'
                      : 'text-red-500'
                  }`}
                >
                  {formatCurrency(projection.saldoProjetado)}
                </p>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-gray-400">Gasto médio/dia</p>
                  <p className="font-semibold text-gray-700">
                    {formatCurrency(projection.taxaDiariaMedia)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Dias restantes</p>
                  <p className="font-semibold text-gray-700">
                    {projection.diasRestantesMes} dias
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Tendência</p>
                  <p
                    className={`font-semibold ${
                      projection.tendencia === 'positiva'
                        ? 'text-green-600'
                        : projection.tendencia === 'negativa'
                        ? 'text-red-500'
                        : 'text-gray-600'
                    }`}
                  >
                    {projection.tendencia === 'positiva'
                      ? '📈 Positiva'
                      : projection.tendencia === 'negativa'
                      ? '📉 Negativa'
                      : '➡️ Estável'}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
