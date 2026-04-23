export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  return new Intl.DateTimeFormat('pt-BR').format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatPercent(value: number): string {
  return `${Math.min(value, 100).toFixed(1)}%`;
}

export function getMonthName(month: number): string {
  const date = new Date(2024, month - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date);
}

export function getCurrentMonthYear(): { mes: number; ano: number } {
  const now = new Date();
  return { mes: now.getMonth() + 1, ano: now.getFullYear() };
}
