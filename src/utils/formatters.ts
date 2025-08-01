export function formatCurrency(amount: number | string, currency: string = 'EUR'): string {
  const value = typeof amount === 'number' ? amount : parseFloat(amount);
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}