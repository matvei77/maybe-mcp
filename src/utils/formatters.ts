import { parseAmount } from './parsers.js';

/**
 * Format currency with proper locale based on currency code
 */
export function formatCurrency(amount: number | string, currency: string = 'EUR'): string {
  const value = typeof amount === 'number' ? amount : parseAmount(amount);
  
  // Choose locale based on currency
  const localeMap: Record<string, string> = {
    'EUR': 'nl-NL', // Netherlands format for EUR
    'USD': 'en-US',
    'GBP': 'en-GB',
    'CHF': 'de-CH',
    'JPY': 'ja-JP',
    'CAD': 'en-CA',
    'AUD': 'en-AU'
  };
  
  const locale = localeMap[currency.toUpperCase()] || 'en-US';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

/**
 * Format currency with sign indicator
 */
export function formatCurrencyWithSign(amount: number | string, currency: string = 'EUR'): string {
  const value = typeof amount === 'number' ? amount : parseAmount(amount);
  const formatted = formatCurrency(value, currency);
  
  if (value < 0) {
    return `−${formatted}`; // Unicode minus for better display
  } else if (value > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

/**
 * Format date in various formats
 */
export function formatDate(date: Date, format: 'iso' | 'display' | 'api' = 'display'): string {
  switch (format) {
    case 'iso':
      return date.toISOString();
    case 'api':
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    case 'display':
    default:
      // Use Dutch format for display (DD-MM-YYYY)
      return new Intl.DateTimeFormat('nl-NL').format(date);
  }
}

/**
 * Format percentage with customizable precision
 */
export function formatPercentage(value: number, precision: number = 2): string {
  return `${(value * 100).toFixed(precision)}%`;
}

/**
 * Format large numbers with abbreviations
 */
export function formatCompactNumber(value: number): string {
  const formatter = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1
  });
  return formatter.format(value);
}

/**
 * Format transaction for display
 */
export function formatTransaction(transaction: any): string {
  const date = formatDate(new Date(transaction.date));
  const amount = formatCurrencyWithSign(transaction.amount, transaction.currency);
  const description = transaction.name || 'No description';
  const category = transaction.category || 'Uncategorized';
  
  return `${date} | ${amount} | ${description} | ${category}`;
}