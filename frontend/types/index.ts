export interface User {
  id: string;
  email: string;
  nome: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Account {
  id: string;
  nome: string;
  tipo: 'corrente' | 'poupanca' | 'investimento' | 'carteira';
  banco?: string;
  saldoAtual: number;
  saldoInicial: number;
  moeda: string;
  ativo: boolean;
  cor?: string;
}

export interface Card {
  id: string;
  nome: string;
  bandeira: string;
  ultimosDigitos: string;
  tipo: 'credito' | 'debito';
  limite?: number;
  vencimento?: number;
  accountId: string;
  ativo: boolean;
}

export interface Category {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa' | 'ambos';
  cor?: string;
  icone?: string;
  userId?: string | null;
}

export interface Transaction {
  id: string;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa' | 'transferência';
  data: string;
  category?: Category;
  account?: Account;
  card?: Card;
  tags: string[];
  recorrente: boolean;
  notaFiscal?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  mes: number;
  ano: number;
  valorLimite: number;
  gastoAtual: number;
  alertaPercentual: number;
  percentualUtilizado: number;
  emAlerta: boolean;
  estourado: boolean;
  category?: Category;
}

export interface Goal {
  id: string;
  nome: string;
  descricao?: string;
  valorAlvo: number;
  valorAtual: number;
  dataAlvo?: string;
  status: 'ativa' | 'pausada' | 'concluída' | 'cancelada';
  cor?: string;
  percentualProgresso: number;
  diasRestantes?: number;
  emRisco: boolean;
  category?: Category;
}

export interface DashboardSummary {
  saldoConsolidado: number;
  entradasMes: number;
  saidasMes: number;
  resultado: number;
  alertasNaoLidos: number;
}

export interface ChartCategoryItem {
  categoria: string;
  total: number;
  percentual: number;
  cor?: string;
}

export interface ChartEvolutionItem {
  mes: string;
  receitas: number;
  despesas: number;
}

export interface Projection {
  saldoProjetado: number;
  taxaDiariaMedia: number;
  diasRestantesMes: number;
  tendencia: 'positiva' | 'negativa' | 'estavel';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Alert {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lido: boolean;
  createdAt: string;
}
