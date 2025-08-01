import { parse, isValid, format, parseISO } from 'date-fns';
import { enUS, nl, de, fr } from 'date-fns/locale';

/**
 * Robust date parser that handles multiple formats
 * Supports: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD, MM/DD/YYYY, and more
 */
export function parseDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('Invalid date input');
  }

  // Clean the input
  const cleaned = dateStr.trim();
  
  // Try ISO format first (most reliable)
  if (cleaned.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      const date = parseISO(cleaned);
      if (isValid(date)) return date;
    } catch {}
  }

  // Define all possible date formats
  const formats = [
    // European formats (day first)
    'dd-MM-yyyy',
    'dd/MM/yyyy',
    'dd.MM.yyyy',
    'd-M-yyyy',
    'd/M/yyyy',
    'd.M.yyyy',
    'dd MMM yyyy',
    'd MMM yyyy',
    
    // ISO formats
    'yyyy-MM-dd',
    'yyyy/MM/dd',
    'yyyy.MM.dd',
    
    // American formats (month first)
    'MM/dd/yyyy',
    'MM-dd-yyyy',
    'M/d/yyyy',
    'MMM dd, yyyy',
    
    // Short year formats
    'dd-MM-yy',
    'dd/MM/yy',
    'd/M/yy',
    
    // With time
    'yyyy-MM-dd HH:mm:ss',
    'dd-MM-yyyy HH:mm:ss',
    'dd/MM/yyyy HH:mm',
  ];

  // Try each format with different locales
  const locales = [enUS, nl, de, fr];
  
  for (const fmt of formats) {
    for (const locale of locales) {
      try {
        const date = parse(cleaned, fmt, new Date(), { locale });
        if (isValid(date)) {
          // Sanity check - date should be within reasonable range
          const year = date.getFullYear();
          if (year >= 1900 && year <= 2100) {
            return date;
          }
        }
      } catch {
        // Continue to next format
      }
    }
  }

  // Try to be smart about ambiguous dates
  const parts = cleaned.split(/[-/.\s]+/);
  if (parts.length >= 3) {
    const nums = parts.map(p => parseInt(p, 10));
    if (nums.every(n => !isNaN(n))) {
      // Guess format based on number ranges
      let day, month, year;
      
      // If one number is > 31, it's definitely the year
      const yearIndex = nums.findIndex(n => n > 31);
      if (yearIndex >= 0) {
        year = nums[yearIndex];
        const others = nums.filter((_, i) => i !== yearIndex);
        
        // If one of the others is > 12, it's the day
        if (others[0] > 12) {
          day = others[0];
          month = others[1];
        } else if (others[1] > 12) {
          day = others[1];
          month = others[0];
        } else {
          // Assume European format (day first)
          day = others[0];
          month = others[1];
        }
      } else {
        // All numbers <= 31, assume the largest is year
        const maxIndex = nums.indexOf(Math.max(...nums));
        year = nums[maxIndex];
        const others = nums.filter((_, i) => i !== maxIndex);
        day = others[0];
        month = others[1];
      }

      // Handle 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }

      try {
        const date = new Date(year, month - 1, day);
        if (isValid(date) && 
            date.getDate() === day && 
            date.getMonth() === month - 1) {
          return date;
        }
      } catch {}
    }
  }

  throw new Error(`Unable to parse date: ${dateStr}`);
}

/**
 * Format date to YYYY-MM-DD for API
 */
export function formatDateForAPI(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format date for display (configurable format)
 */
export function formatDateForDisplay(date: Date, formatStr: string = 'dd-MM-yyyy'): string {
  return format(date, formatStr);
}

/**
 * Parse and validate date range
 */
export function parseDateRange(startStr: string, endStr: string): { start: Date; end: Date } {
  const start = parseDate(startStr);
  const end = parseDate(endStr);

  if (start > end) {
    throw new Error('Start date must be before end date');
  }

  // Check if range is reasonable (not more than 5 years)
  const daysDiff = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 1825) { // 5 years
    throw new Error('Date range cannot exceed 5 years');
  }

  return { start, end };
}

/**
 * Get date N days ago
 */
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Get start of current month
 */
export function startOfCurrentMonth(): Date {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get end of current month
 */
export function endOfCurrentMonth(): Date {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}