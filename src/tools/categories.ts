import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MaybeFinanceAPI, Transaction } from "../services/api-client.js";
import { parseAmount } from "../utils/parsers.js";

// const GetCategoriesSchema = z.object({});

const CategorizeTransactionsSchema = z.object({
  transactionIds: z.array(z.string().uuid()),
  category: z.string(),
});

const GetSpendingBreakdownSchema = z.object({
  days: z.number().int().positive().max(365).default(30),
  includeAssets: z.boolean().default(false),
});

// Special categories for user requirements
export const SPECIAL_CATEGORIES = {
  REQUIRED_PURCHASES: "Required Purchases",
  DISCRETIONARY: "Discretionary Spending", 
  SUBSCRIPTIONS: "Subscriptions",
  SPENDING_BUT_ASSETS: "Spending but Assets"
};

export function registerCategoryTools(server: Server, apiClient: MaybeFinanceAPI) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_categories",
          description: "Get all available categories",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "categorize_transactions",
          description: "Manually categorize one or more transactions",
          inputSchema: {
            type: "object",
            properties: {
              transactionIds: {
                type: "array",
                items: { type: "string" },
                description: "Transaction IDs to categorize",
              },
              category: {
                type: "string",
                description: "Category name to apply",
              },
            },
            required: ["transactionIds", "category"],
          },
        },
        {
          name: "get_spending_breakdown",
          description: "Get spending breakdown by category",
          inputSchema: {
            type: "object",
            properties: {
              days: {
                type: "number",
                description: "Number of days to analyze (default: 30)",
              },
              includeAssets: {
                type: "boolean",
                description: "Include 'Spending but Assets' in breakdown",
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "get_categories") {
      try {
        const categories = await apiClient.getCategories();
        
        // Add special categories
        const specialCategories = Object.values(SPECIAL_CATEGORIES).map(name => ({
          id: `special_${name.toLowerCase().replace(/\s+/g, '_')}`,
          name,
          color: getColorForSpecialCategory(name),
          isSystem: true,
          isSpecial: true,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                categories: [...categories, ...specialCategories],
                total: categories.length + specialCategories.length,
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to fetch categories: ${errorMessage}`);
      }
    }

    if (name === "categorize_transactions") {
      const params = CategorizeTransactionsSchema.parse(args);
      
      try {
        const results = await Promise.all(
          params.transactionIds.map(id => 
            apiClient.updateTransaction(id, { category: params.category })
          )
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                updated: results.length,
                category: params.category,
                transactionIds: params.transactionIds,
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to categorize transactions: ${errorMessage}`);
      }
    }

    if (name === "get_spending_breakdown") {
      const params = GetSpendingBreakdownSchema.parse(args);
      
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - params.days);
        
        const { transactions } = await apiClient.getTransactions({
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        });

        // Filter only expenses based on classification
        const expenses = transactions.filter((tx: Transaction) => 
          tx.classification === 'expense' && !tx.excluded
        );

        const breakdown: Record<string, number> = {};
        let uncategorizedTotal = 0;
        
        expenses.forEach((tx: Transaction) => {
          const category = tx.category || "Uncategorized";
          const amount = parseAmount(tx.amount);
          
          if (!params.includeAssets && category === SPECIAL_CATEGORIES.SPENDING_BUT_ASSETS) {
            return;
          }
          
          if (category === "Uncategorized") {
            uncategorizedTotal += amount;
          } else {
            breakdown[category] = (breakdown[category] || 0) + amount;
          }
        });
        
        if (uncategorizedTotal > 0) {
          breakdown["Uncategorized"] = uncategorizedTotal;
        }

        const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
        
        const formattedBreakdown = Object.entries(breakdown)
          .sort(([, a], [, b]) => b - a)
          .map(([category, amount]) => ({
            category,
            amount,
            percentage: (amount / total) * 100,
            formatted: new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'EUR',
            }).format(amount),
          }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                period: `${params.days} days`,
                total: new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(total),
                breakdown: formattedBreakdown,
                uncategorizedCount: expenses.filter((tx: Transaction) => !tx.category).length,
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
  });
}

function getColorForSpecialCategory(name: string): string {
  const colors: Record<string, string> = {
    [SPECIAL_CATEGORIES.REQUIRED_PURCHASES]: "#4CAF50",
    [SPECIAL_CATEGORIES.DISCRETIONARY]: "#FF9800",
    [SPECIAL_CATEGORIES.SUBSCRIPTIONS]: "#2196F3",
    [SPECIAL_CATEGORIES.SPENDING_BUT_ASSETS]: "#9C27B0",
  };
  return colors[name] || "#757575";
}