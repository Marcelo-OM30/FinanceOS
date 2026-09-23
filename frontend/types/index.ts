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
  // Só preenchida quando o fato gerador é de outro mês que o pagamento (parcelas).
  dataCompetencia?: string | null;
  // true = realizada, false = prevista (agendada; ainda não mexeu no saldo).
  confirmada: boolean;
  category?: Category;
  account?: Account;
  // Só em transferência. Null nas transferências gravadas antes do destino existir.
  contaDestinoId?: string | null;
  contaDestino?: Account | null;
  card?: Card;
  tags: string[];
  recorrencia?: 'única' | 'semanal' | 'mensal' | 'anual';
  numeroNota?: string;
  dataCriacao: string;
}

export interface Budget {
  id: string;
  mes: number;
  ano: number;
  limiteMensal: number;
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
  dataInicio: string;
  dataFim: string;
  prioridade: string;
  status: 'ativa' | 'pausada' | 'concluída' | 'cancelada';
  percentualProgresso: number;
  diasRestantes?: number;
  emRisco: boolean;
  category?: Category;
}

export interface DashboardSummary {
  saldoConsolidado: number;
  totalEntradasMes: number;
  totalSaidasMes: number;
  resultadoMes: number;
  alertasNaoLidos: number;
}

export interface ChartCategoryItem {
  categoria: string;
  valor: number;
  percentual: number;
  cor?: string | null;
}

export interface ChartCategoriesResponse {
  data: ChartCategoryItem[];
  total: number;
}

export interface ChartEvolutionItem {
  mes: string;
  mesNumero: number;
  ano: number;
  receitas: number;
  despesas: number;
  saldo: number;
}

export interface ChartEvolutionResponse {
  data: ChartEvolutionItem[];
}

export interface Projection {
  saldoAtual: number;
  saldoProjetadoFimMes: number;
  diferenca: number;
  diasRestantes: number;
  taxaDiariaGasto: number;
  // Transações previstas até o fim do mês, inclusive as atrasadas.
  previstoEntradas: number;
  previstoSaidas: number;
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
