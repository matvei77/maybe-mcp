import axios, { AxiosInstance, AxiosError } from 'axios';
import { z } from 'zod';

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
  private client: AxiosInstance;

  constructor(baseURL: string, apiKey: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const data = error.response.data as any;
          const message = data?.message || error.message;
          throw new Error(`API Error ${error.response.status}: ${message}`);
        } else if (error.request) {
          throw new Error('No response from API server');
        } else {
          throw new Error(`Request failed: ${error.message}`);
        }
      }
    );
  }

  // Account endpoints
  async getAccounts(): Promise<Account[]> {
    const response = await this.client.get('/accounts');
    const data = response.data.accounts || response.data;
    return z.array(AccountSchema).parse(data);
  }

  async getAccount(id: string): Promise<Account> {
    const response = await this.client.get(`/accounts/${id}`);
    return AccountSchema.parse(response.data);
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
    const response = await this.client.get('/transactions', { params });
    return {
      transactions: z.array(TransactionSchema).parse(response.data.transactions || response.data),
      total: response.data.total || response.data.length || 0,
    };
  }

  async searchTransactions(query: string, filters?: {
    accountId?: string;
    category?: string;
    merchant?: string;
    tags?: string[];
  }): Promise<{ transactions: Transaction[]; total: number }> {
    const response = await this.client.get('/transactions', {
      params: { search: query, ...filters },
    });
    return {
      transactions: z.array(TransactionSchema).parse(response.data.transactions || response.data),
      total: response.data.total || response.data.length || 0,
    };
  }

  async getTransaction(id: string): Promise<Transaction> {
    const response = await this.client.get(`/transactions/${id}`);
    return TransactionSchema.parse(response.data);
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
    const response = await this.client.post('/transactions', { transaction: data });
    return TransactionSchema.parse(response.data);
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
    const response = await this.client.put(`/transactions/${id}`, { transaction: data });
    return TransactionSchema.parse(response.data);
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.client.delete(`/transactions/${id}`);
  }

  // Category endpoints
  async getCategories(): Promise<Category[]> {
    const response = await this.client.get('/categories');
    return z.array(CategorySchema).parse(response.data);
  }

  // AI Chat endpoints
  async getChats(page: number = 1): Promise<{ chats: any[]; pagination: any }> {
    const response = await this.client.get('/chats', { params: { page } });
    return response.data;
  }

  async createChat(title?: string, initialMessage?: string): Promise<any> {
    const response = await this.client.post('/chats', {
      chat: { title },
      message: initialMessage ? { content: initialMessage } : undefined,
    });
    return response.data;
  }

  async sendChatMessage(chatId: string, content: string): Promise<any> {
    const response = await this.client.post(`/chats/${chatId}/messages`, {
      message: { content },
    });
    return response.data;
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.client.delete(`/chats/${chatId}`);
  }

  // Usage tracking
  async getUsage(): Promise<any> {
    const response = await this.client.get('/usage');
    return response.data;
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