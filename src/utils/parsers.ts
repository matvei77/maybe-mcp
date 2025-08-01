export function parseAmount(amount: string): number {
  // Remove currency symbols and spaces
  const cleaned = amount.replace(/[€$£¥₹\s]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export function getAccountId(transaction: any): string {
  // Handle both formats: direct accountId or nested account object
  return transaction.accountId || transaction.account?.id || '';
}