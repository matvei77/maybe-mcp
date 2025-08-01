import { z } from "zod";

// Flexible ID validation - accepts various ID formats, not just UUID
export const IdSchema = z.string().min(1).regex(/^[a-zA-Z0-9-_]+$/, {
  message: "Invalid ID format"
});

export const DateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const PaginationSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export const AmountRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
}).refine(data => {
  if (data.min !== undefined && data.max !== undefined) {
    return data.min <= data.max;
  }
  return true;
}, {
  message: "Min amount must be less than or equal to max amount"
});

export function validateDateRange(start: Date, end: Date): void {
  const maxRange = 365 * 5; // 5 years
  const daysDiff = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff > maxRange) {
    throw new Error(`Date range cannot exceed ${maxRange} days`);
  }
  
  if (start > end) {
    throw new Error("Start date must be before end date");
  }
}

export function validateAmount(amount: number): void {
  if (!isFinite(amount)) {
    throw new Error("Amount must be a finite number");
  }
  
  // Check for reasonable amount range (up to 1 million)
  if (Math.abs(amount) > 1000000) {
    throw new Error("Amount seems unreasonably large");
  }
}

export function validateCurrency(currency: string): void {
  const validCurrencies = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];
  if (!validCurrencies.includes(currency.toUpperCase())) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
}