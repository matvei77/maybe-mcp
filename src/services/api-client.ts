import { z } from 'zod';
import { EnhancedMaybeFinanceAPI } from './enhanced-api-client.js';

// API Response schemas
export const AccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  balance: z.string(),
  currency: z.string().default('EUR'),
  classification: z.string(),
  account_type: z.string(),
});

export const TransactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string().nullable(),
  amount: z.string(),
  currency: z.string().default('EUR'),
  classification: z.string().optional(),
  category: z.string().nullable(),
  merchant: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  excluded: z.boolean().optional().default(false),
  notes: z.string().nullable().optional(),
  account: z.object({
    id: z.string(),
    name: z.string(),
    account_type: z.string(),
  }).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CategorySchema = z.object({
  id: z.string().uuid(),
  familyId: z.string().uuid(),
  name: z.string(),
  color: z.string().nullable(),
  isSystem: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Account = z.infer<typeof AccountSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Category = z.infer<typeof CategorySchema>;

export class MaybeFinanceAPI {
  private client: EnhancedMaybeFinanceAPI;

  constructor(baseURL: string, apiKey: string) {
    this.client = new EnhancedMaybeFinanceAPI(baseURL, apiKey, {
      rateLimitPerMinute: 100,
      cacheTTLSeconds: 300,
      timeout: 30000,
    });
  }

  // Account endpoints
  async getAccounts(): Promise<Account[]> {
    const data = await this.client.get<any>('/accounts');
    const accounts = data.accounts || data;
    return z.array(AccountSchema).parse(accounts);
  }

  async getAccount(id: string): Promise<Account> {
    const data = await this.client.get<any>(`/accounts/${id}`);
    return AccountSchema.parse(data);
  }

  // Transaction endpoints
  async getTransactions(params?: {
    accountId?: string;
    startDate?: string;
    endDate?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: Transaction[]; total: number }> {
    const data = await this.client.get<any>('/transactions', { params });
    return {
      transactions: z.array(TransactionSchema).parse(data.transactions || data),
      total: data.total || data.length || 0,
    };
  }

  async searchTransactions(query: string, filters?: {
    accountId?: string;
    category?: string;
    merchant?: string;
    tags?: string[];
  }): Promise<{ transactions: Transaction[]; total: number }> {
    const data = await this.client.get<any>('/transactions', {
      params: { search: query, ...filters },
    });
    return {
      transactions: z.array(TransactionSchema).parse(data.transactions || data),
      total: data.total || data.length || 0,
    };
  }

  async getTransaction(id: string): Promise<Transaction> {
    const data = await this.client.get<any>(`/transactions/${id}`);
    return TransactionSchema.parse(data);
  }

  async createTransaction(data: {
    accountId: string;
    date: string;
    amount: string;
    name: string;
    category?: string;
    merchant?: string;
    notes?: string;
    tags?: string[];
  }): Promise<Transaction> {
    // Convert accountId to account_id for the API
    const { accountId, ...transactionData } = data;
    const apiData = {
      transaction: {
        ...transactionData,
        account_id: accountId, // Use snake_case for API
      }
    };
    const result = await this.client.post<any>('/transactions', apiData);
    return TransactionSchema.parse(result);
  }

  async updateTransaction(id: string, data: {
    category?: string;
    excluded?: boolean;
    name?: string;
    amount?: string;
    date?: string;
    merchant?: string;
    notes?: string;
    tags?: string[];
  }): Promise<Transaction> {
    const result = await this.client.put<any>(`/transactions/${id}`, { transaction: data });
    return TransactionSchema.parse(result);
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.client.delete<void>(`/transactions/${id}`);
  }

  // Category endpoints
  async getCategories(): Promise<Category[]> {
    const data = await this.client.get<any>('/categories');
    return z.array(CategorySchema).parse(data);
  }

  // AI Chat endpoints
  async getChats(page: number = 1): Promise<{ chats: any[]; pagination: any }> {
    return await this.client.get<any>('/chats', { params: { page } });
  }

  async createChat(title?: string, initialMessage?: string): Promise<any> {
    return await this.client.post<any>('/chats', {
      chat: { title },
      message: initialMessage ? { content: initialMessage } : undefined,
    });
  }

  async sendChatMessage(chatId: string, content: string): Promise<any> {
    return await this.client.post<any>(`/chats/${chatId}/messages`, {
      message: { content },
    });
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.client.delete<void>(`/chats/${chatId}`);
  }

  // Usage tracking
  async getUsage(): Promise<any> {
    return await this.client.get<any>('/usage');
  }

  // Analytics endpoints (may need custom implementation on server)
  async getCashFlow(days: number, accountIds?: string[]): Promise<any> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const params: any = { startDate, endDate };
    if (accountIds && accountIds.length > 0) {
      params.accountIds = accountIds.join(',');
    }

    const { transactions } = await this.getTransactions(params);
    
    // Calculate cash flow from transactions
    const inflows = transactions
      .filter(t => t.classification === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount.replace(/[€$£¥₹\s]/g, '').replace(',', '.')), 0);
      
    const outflows = transactions
      .filter(t => t.classification === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount.replace(/[€$£¥₹\s]/g, '').replace(',', '.')), 0);

    return {
      period: `${days} days`,
      inflows,
      outflows,
      netFlow: inflows - outflows,
      transactions,
    };
  }
}