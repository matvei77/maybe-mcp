import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MaybeFinanceAPI } from "../services/api-client.js";

const GetAccountsSchema = z.object({
  includeBalance: z.boolean().default(true),
});

const GetAccountBalanceSchema = z.object({
  accountId: z.string().uuid(),
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
          currency: account.currency,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(formattedAccounts, null, 2),
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