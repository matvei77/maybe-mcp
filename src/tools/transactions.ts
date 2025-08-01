import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MaybeFinanceAPI, Transaction } from "../services/api-client.js";
import { formatCurrency, formatDate } from "../utils/formatters.js";
import { PaginationSchema, IdSchema } from "../utils/validators.js";
import { parseDate, formatDateForAPI } from "../utils/date-utils.js";
import { parseAmount, getAccountId } from "../utils/parsers.js";

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

export function registerTransactionTools(server: Server, apiClient: MaybeFinanceAPI) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_transactions",
          description: "Get transactions with various filters",
          inputSchema: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "Filter by account ID",
              },
              startDate: {
                type: "string",
                description: "Start date (ISO format)",
              },
              endDate: {
                type: "string",
                description: "End date (ISO format)",
              },
              category: {
                type: "string",
                description: "Filter by category",
              },
              merchant: {
                type: "string",
                description: "Filter by merchant name",
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Filter by tags",
              },
              excludeTransfers: {
                type: "boolean",
                description: "Exclude transfers between accounts",
              },
              includeExcluded: {
                type: "boolean",
                description: "Include excluded transactions",
              },
              minAmount: {
                type: "number",
                description: "Minimum transaction amount",
              },
              maxAmount: {
                type: "number",
                description: "Maximum transaction amount",
              },
              limit: {
                type: "number",
                description: "Number of results to return (max 100)",
              },
              offset: {
                type: "number",
                description: "Number of results to skip",
              },
            },
          },
        },
        {
          name: "search_transactions",
          description: "Search transactions by name/description",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query",
              },
              accountId: {
                type: "string",
                description: "Filter by account ID",
              },
              limit: {
                type: "number",
                description: "Number of results to return",
              },
              offset: {
                type: "number",
                description: "Number of results to skip",
              },
            },
            required: ["query"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
            const amount = Math.abs(parseFloat(tx.amount));
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

    throw new Error(`Unknown tool: ${name}`);
  });
}