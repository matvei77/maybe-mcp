import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MaybeFinanceAPI, Transaction } from "../services/api-client.js";
import { parseAmount } from "../utils/parsers.js";
import { IdSchema } from "../utils/validators.js";
import { formatCurrency, formatPercentage } from "../utils/formatters.js";

// const GetCategoriesSchema = z.object({});

const CategorizeTransactionsSchema = z.object({
  transactionIds: z.array(IdSchema),
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

export async function handleCategoryTools(request: CallToolRequest, apiClient: MaybeFinanceAPI) {
    const { name, arguments: args } = request.params;

    if (name === "get_categories") {
      try {
        // Since the API doesn't have a categories endpoint, we'll return a hardcoded list
        // of common financial categories plus the special categories
        const defaultCategories = [
          { id: "cat_groceries", name: "Groceries", color: "#4CAF50", isSystem: true },
          { id: "cat_dining", name: "Dining", color: "#FF9800", isSystem: true },
          { id: "cat_transport", name: "Transportation", color: "#2196F3", isSystem: true },
          { id: "cat_utilities", name: "Utilities", color: "#9C27B0", isSystem: true },
          { id: "cat_entertainment", name: "Entertainment", color: "#E91E63", isSystem: true },
          { id: "cat_healthcare", name: "Healthcare", color: "#00BCD4", isSystem: true },
          { id: "cat_shopping", name: "Shopping", color: "#FFC107", isSystem: true },
          { id: "cat_housing", name: "Housing", color: "#795548", isSystem: true },
          { id: "cat_insurance", name: "Insurance", color: "#607D8B", isSystem: true },
          { id: "cat_education", name: "Education", color: "#3F51B5", isSystem: true },
          { id: "cat_personal", name: "Personal Care", color: "#009688", isSystem: true },
          { id: "cat_travel", name: "Travel", color: "#FF5722", isSystem: true },
          { id: "cat_savings", name: "Savings", color: "#8BC34A", isSystem: true },
          { id: "cat_income", name: "Income", color: "#4CAF50", isSystem: true },
          { id: "cat_other", name: "Other", color: "#757575", isSystem: true },
        ];
        
        // Add special categories
        const specialCategories = Object.values(SPECIAL_CATEGORIES).map(name => ({
          id: `special_${name.toLowerCase().replace(/\s+/g, '_')}`,
          name,
          color: getColorForSpecialCategory(name),
          isSystem: true,
          isSpecial: true,
        }));

        const allCategories = [...defaultCategories, ...specialCategories];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                categories: allCategories,
                total: allCategories.length,
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
            formatted: formatCurrency(amount, 'EUR'),
            formattedPercentage: formatPercentage(amount / total),
          }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                period: `${params.days} days`,
                total: formatCurrency(total, 'EUR'),
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

    if (name === "create_category") {
      const params = z.object({
        name: z.string(),
        parentCategory: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      }).parse(args);
      
      try {
        // For now, return a mock response since the API doesn't support category creation
        const newCategory = {
          id: `cat_${Date.now()}`,
          name: params.name,
          color: params.color || "#757575",
          icon: params.icon,
          parentCategory: params.parentCategory,
          isSystem: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Category created (client-side only - API doesn't support category creation)",
                category: newCategory,
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to create category: ${errorMessage}`);
      }
    }

    throw new Error(`Unknown tool: ${name}`);
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