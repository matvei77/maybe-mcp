import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MaybeFinanceAPI, Transaction } from "../services/api-client.js";
import { formatCurrency, formatPercentage } from "../utils/formatters.js";
import { PaginationSchema, IdSchema } from "../utils/validators.js";
import { parseDate, formatDateForAPI } from "../utils/date-utils.js";
import { parseAmount } from "../utils/parsers.js";

const GetTransactionsSchema = z.object({
  accountId: IdSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  category: z.string().optional(),
  merchant: z.string().optional(),
  tags: z.array(z.string()).optional(),
  excludeTransfers: z.boolean().default(false),
  includeExcluded: z.boolean().default(false),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
}).merge(PaginationSchema);

const SearchTransactionsSchema = z.object({
  query: z.string().min(1),
  accountId: IdSchema.optional(),
  category: z.string().optional(),
  merchant: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).merge(PaginationSchema);

export async function handleTransactionTools(request: CallToolRequest, apiClient: MaybeFinanceAPI) {
    const { name, arguments: args } = request.params;

    if (name === "get_transactions") {
      const params = GetTransactionsSchema.parse(args);
      
      try {
        const apiParams: any = {
          limit: params.limit,
          offset: params.offset,
        };
        
        if (params.accountId) apiParams.accountId = params.accountId;
        if (params.startDate) {
          const date = parseDate(params.startDate);
          apiParams.startDate = formatDateForAPI(date);
        }
        if (params.endDate) {
          const date = parseDate(params.endDate);
          apiParams.endDate = formatDateForAPI(date);
        }
        if (params.category) apiParams.category = params.category;
        if (params.merchant) apiParams.merchant = params.merchant;
        if (params.tags) apiParams.tags = params.tags;

        const { transactions, total } = await apiClient.getTransactions(apiParams);

        // Filter based on amount if specified
        let filteredTransactions = transactions;
        if (params.minAmount !== undefined || params.maxAmount !== undefined) {
          filteredTransactions = transactions.filter((tx: Transaction) => {
            const amount = Math.abs(parseAmount(tx.amount));
            if (params.minAmount !== undefined && amount < params.minAmount) return false;
            if (params.maxAmount !== undefined && amount > params.maxAmount) return false;
            return true;
          });
        }

        const formattedTransactions = filteredTransactions.map((tx: Transaction) => ({
          id: tx.id,
          date: tx.date,
          name: tx.name || "Unknown",
          amount: tx.amount,
          formattedAmount: formatCurrency(tx.amount, tx.currency),
          category: tx.category,
          accountId: tx.account?.id,
          excluded: tx.excluded,
          notes: tx.notes,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                transactions: formattedTransactions,
                total: total || filteredTransactions.length,
                limit: params.limit,
                offset: params.offset,
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to fetch transactions: ${errorMessage}`);
      }
    }

    if (name === "search_transactions") {
      const params = SearchTransactionsSchema.parse(args);
      
      try {
        const filters = {
          accountId: params.accountId,
          category: params.category,
          merchant: params.merchant,
          tags: params.tags,
        };
        
        const result = await apiClient.searchTransactions(params.query, filters);
        const transactions = result.transactions;

        const formattedTransactions = transactions.map((tx: Transaction) => ({
          id: tx.id,
          date: tx.date,
          name: tx.name || "Unknown",
          amount: tx.amount,
          formattedAmount: formatCurrency(tx.amount, tx.currency),
          category: tx.category,
          accountId: tx.account?.id,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query: params.query,
                results: formattedTransactions,
                total: result.total || transactions.length,
                limit: params.limit,
                offset: params.offset,
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to search transactions: ${errorMessage}`);
      }
    }

    if (name === "get_spending_breakdown") {
      const params = z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        accountId: IdSchema.optional(),
        groupBy: z.enum(["category", "merchant", "account"]).default("category"),
        excludeTransfers: z.boolean().default(true),
        includeIncome: z.boolean().default(false),
      }).merge(PaginationSchema).parse(args);
      
      try {
        const apiParams: any = {
          limit: 1000, // Get more transactions for analysis
        };
        
        if (params.accountId) apiParams.accountId = params.accountId;
        if (params.startDate) {
          const date = parseDate(params.startDate);
          apiParams.startDate = formatDateForAPI(date);
        }
        if (params.endDate) {
          const date = parseDate(params.endDate);
          apiParams.endDate = formatDateForAPI(date);
        }
        
        const { transactions } = await apiClient.getTransactions(apiParams);
        
        // Filter transactions
        let filtered = transactions;
        if (params.excludeTransfers) {
          filtered = filtered.filter((tx: Transaction) => 
            tx.classification !== 'transfer'
          );
        }
        if (!params.includeIncome) {
          filtered = filtered.filter((tx: Transaction) => 
            tx.classification === 'expense'
          );
        }
        
        // Group by specified field
        const breakdown: Record<string, { amount: number; count: number; percentage?: number }> = {};
        let total = 0;
        
        filtered.forEach((tx: Transaction) => {
          const amount = Math.abs(parseAmount(tx.amount));
          let groupKey = 'Uncategorized';
          
          switch (params.groupBy) {
            case 'category':
              groupKey = tx.category || 'Uncategorized';
              break;
            case 'merchant':
              groupKey = tx.merchant || tx.name || 'Unknown';
              break;
            case 'account':
              groupKey = tx.account?.name || 'Unknown Account';
              break;
          }
          
          if (!breakdown[groupKey]) {
            breakdown[groupKey] = { amount: 0, count: 0 };
          }
          
          breakdown[groupKey].amount += amount;
          breakdown[groupKey].count += 1;
          total += amount;
        });
        
        // Calculate percentages and sort
        const sortedBreakdown = Object.entries(breakdown)
          .map(([key, value]) => ({
            [params.groupBy]: key,
            amount: formatCurrency(value.amount, 'EUR'),
            count: value.count,
            percentage: total > 0 ? formatPercentage(value.amount / total) : '0%',
            _rawAmount: value.amount, // For sorting
          }))
          .sort((a, b) => b._rawAmount - a._rawAmount)
          .map(({ _rawAmount, ...rest }) => rest); // Remove raw amount from output
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                breakdown: sortedBreakdown.slice(0, params.limit || 20),
                summary: {
                  total: formatCurrency(total, 'EUR'),
                  categories: sortedBreakdown.length,
                  transactions: filtered.length,
                  groupBy: params.groupBy,
                  dateRange: {
                    start: params.startDate || 'All time',
                    end: params.endDate || 'Present',
                  },
                },
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to get spending breakdown: ${errorMessage}`);
      }
    }

    throw new Error(`Unknown tool: ${name}`);
}