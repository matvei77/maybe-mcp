import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MaybeFinanceAPI } from "../services/api-client.js";
import { IdSchema } from "../utils/validators.js";
import { formatCurrency } from "../utils/formatters.js";

const GetAccountsSchema = z.object({
  includeBalance: z.boolean().default(true),
  groupByType: z.boolean().default(false),
});

const GetAccountBalanceSchema = z.object({
  accountId: IdSchema,
});

export function registerAccountTools(server: Server, apiClient: MaybeFinanceAPI) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_accounts",
          description: "Get list of all accounts with their balances",
          inputSchema: {
            type: "object",
            properties: {
              includeBalance: {
                type: "boolean",
                description: "Include current balance (default: true)",
              },
            },
          },
        },
        {
          name: "get_account_balance",
          description: "Get current balance for a specific account",
          inputSchema: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "Account ID",
              },
            },
            required: ["accountId"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "get_accounts") {
      const params = GetAccountsSchema.parse(args);
      
      try {
        const accounts = await apiClient.getAccounts();

        const formattedAccounts = accounts.map(account => ({
          id: account.id,
          name: account.name,
          type: account.account_type,
          classification: account.classification,
          balance: params.includeBalance ? account.balance : undefined,
          formattedBalance: params.includeBalance ? 
            formatCurrency(account.balance, account.currency) : undefined,
          currency: account.currency,
        }));
        
        // Calculate net worth if balances included
        let netWorth = null;
        if (params.includeBalance) {
          // Group accounts by currency
          const byCurrency: Record<string, number> = {};
          accounts.forEach(account => {
            const currency = account.currency || 'EUR';
            const amount = parseFloat(account.balance);
            byCurrency[currency] = (byCurrency[currency] || 0) + amount;
          });
          
          netWorth = Object.entries(byCurrency).map(([currency, total]) => ({
            currency,
            amount: total,
            formatted: formatCurrency(total, currency)
          }));
        }
        
        // Group by type if requested
        let grouped = null;
        if (params.groupByType) {
          grouped = formattedAccounts.reduce((acc, account) => {
            const type = account.type || 'Other';
            if (!acc[type]) acc[type] = [];
            acc[type].push(account);
            return acc;
          }, {} as Record<string, any[]>);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                accounts: params.groupByType ? grouped : formattedAccounts,
                summary: {
                  totalAccounts: accounts.length,
                  netWorth: netWorth,
                },
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to fetch accounts: ${errorMessage}`);
      }
    }

    if (name === "get_account_balance") {
      const params = GetAccountBalanceSchema.parse(args);
      
      try {
        const account = await apiClient.getAccount(params.accountId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                accountId: account.id,
                name: account.name,
                balance: account.balance,
                currency: account.currency,
                classification: account.classification,
                type: account.account_type,
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('404')) {
          throw new Error("Account not found");
        }
        throw new Error(`Failed to fetch account: ${errorMessage}`);
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });
}