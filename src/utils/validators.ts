import { z } from "zod";

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const PaginationSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export function validateDateRange(start: Date, end: Date): void {
  const maxRange = 365; 
  const daysDiff = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff > maxRange) {
    throw new Error(`Date range cannot exceed ${maxRange} days`);
  }
  
  if (start > end) {
    throw new Error("Start date must be before end date");
  }
}