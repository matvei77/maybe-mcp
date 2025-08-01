/**
 * Enhanced amount parser that handles multiple formats and currencies
 */
export function parseAmount(amount: string | number): number {
  if (typeof amount === 'number') return amount;
  
  if (!amount || typeof amount !== 'string') {
    throw new Error('Invalid amount input');
  }
  
  // Remove currency symbols and normalize
  let cleaned = amount
    .replace(/[€$£¥₹¢]/g, '')
    .replace(/\s/g, '')
    .trim();
  
  // Handle parentheses for negative (accounting format)
  const isNegative = cleaned.includes('-') || 
                     cleaned.includes('(') || 
                     cleaned.startsWith('−'); // Unicode minus
  
  // Remove negative indicators for parsing
  cleaned = cleaned.replace(/[()−-]/g, '');
  
  // Handle different decimal/thousand separators
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Determine which is decimal separator
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // European format: 1.234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Only commas - could be thousands or decimal
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length === 2) {
      // Likely decimal: 123,45
      cleaned = cleaned.replace(',', '.');
    } else {
      // Likely thousands: 1,234 or 1,234,567
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  
  // Parse the number
  const parsed = parseFloat(cleaned);
  
  if (isNaN(parsed)) {
    throw new Error(`Unable to parse amount: ${amount}`);
  }
  
  // Apply sign
  return isNegative ? -Math.abs(parsed) : parsed;
}

/**
 * Parse amount with classification context
 * For Maybe Finance: negative amounts are often income, positive are expenses
 */
export function parseAmountWithClassification(
  amount: string | number, 
  classification?: string
): number {
  const value = parseAmount(amount);
  
  // If classification is provided, ensure sign matches Maybe Finance convention
  if (classification === 'income' && value > 0) {
    return -value; // Income should be negative
  } else if (classification === 'expense' && value < 0) {
    return Math.abs(value); // Expense should be positive
  }
  
  return value;
}

/**
 * Extract account ID from transaction object
 */
export function getAccountId(transaction: any): string {
  // Handle both formats: direct accountId or nested account object
  return transaction.accountId || 
         transaction.account_id || 
         transaction.account?.id || 
         '';
}

/**
 * Parse merchant name with normalization
 */
export function parseMerchant(merchant: string | null | undefined): string {
  if (!merchant) return '';
  
  // Clean up common merchant name issues
  return merchant
    .trim()
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/[*]+$/, '') // Remove trailing asterisks
    .replace(/\d{4,}$/, '') // Remove trailing card numbers
    .replace(/^(IDEAL|PIN|SEPA)\s+/i, ''); // Remove payment method prefixes
}

/**
 * Parse transaction description
 */
export function parseDescription(description: string | null | undefined): string {
  if (!description) return 'No description';
  
  return description
    .trim()
    .replace(/\s+/g, ' ')
    .substring(0, 200); // Limit length
}