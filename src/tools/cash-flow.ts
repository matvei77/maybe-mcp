import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MaybeFinanceAPI, Transaction } from "../services/api-client.js";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { formatCurrency } from "../utils/formatters.js";
import { parseAmount } from "../utils/parsers.js";

const GetRollingCashFlowSchema = z.object({
  days: z.number().int().positive().max(365).default(30),
  accountIds: z.array(z.string().uuid()).optional(),
  excludeTransfers: z.boolean().default(true),
  groupByCategory: z.boolean().default(false),
  groupByAccount: z.boolean().default(false),
});

const GetCashFlowTrendSchema = z.object({
  periods: z.number().int().positive().max(12).default(6),
  periodType: z.enum(["day", "week", "month"]).default("month"),
  accountIds: z.array(z.string().uuid()).optional(),
});

export function registerCashFlowTools(server: Server, apiClient: MaybeFinanceAPI) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_rolling_cash_flow",
          description: "Get cash flow (inflows/outflows) for the last N days",
          inputSchema: {
            type: "object",
            properties: {
              days: {
                type: "number",
                description: "Number of days to look back (default: 30, max: 365)",
              },
              accountIds: {
                type: "array",
                items: { type: "string" },
                description: "Filter by specific account IDs",
              },
              excludeTransfers: {
                type: "boolean",
                description: "Exclude transfers between accounts",
              },
              groupByCategory: {
                type: "boolean",
                description: "Group results by category",
              },
              groupByAccount: {
                type: "boolean",
                description: "Group results by account",
              },
            },
          },
        },
        {
          name: "get_cash_flow_trend",
          description: "Get cash flow trend over multiple periods",
          inputSchema: {
            type: "object",
            properties: {
              periods: {
                type: "number",
                description: "Number of periods to analyze (default: 6)",
              },
              periodType: {
                type: "string",
                enum: ["day", "week", "month"],
                description: "Type of period (default: month)",
              },
              accountIds: {
                type: "array",
                items: { type: "string" },
                description: "Filter by specific account IDs",
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "get_rolling_cash_flow") {
      const params = GetRollingCashFlowSchema.parse(args);
      
      const startDate = startOfDay(subDays(new Date(), params.days));
      const endDate = endOfDay(new Date());
      
      try {
        const { transactions } = await apiClient.getTransactions({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        // Parse amounts and classify based on classification field
        const inflows = transactions
          .filter((t: Transaction) => t.classification === 'income')
          .reduce((sum: number, t: Transaction) => sum + parseAmount(t.amount), 0);
          
        const outflows = transactions
          .filter((t: Transaction) => t.classification === 'expense')
          .reduce((sum: number, t: Transaction) => sum + parseAmount(t.amount), 0);
        
        const netFlow = inflows - outflows;

        const result: any = {
          period: `${params.days} days`,
          dateRange: {
            from: startDate.toISOString(),
            to: endDate.toISOString(),
          },
          summary: {
            inflows: formatCurrency(inflows),
            outflows: formatCurrency(outflows),
            netFlow: formatCurrency(netFlow),
            avgDailyInflow: formatCurrency(inflows / params.days),
            avgDailyOutflow: formatCurrency(outflows / params.days),
            avgDailyNet: formatCurrency(netFlow / params.days),
          },
          transactionCount: {
            total: transactions.length,
            inflows: transactions.filter((t: Transaction) => t.classification === 'income').length,
            outflows: transactions.filter((t: Transaction) => t.classification === 'expense').length,
          },
        };

        if (params.groupByCategory) {
          result.breakdown = { byCategory: groupByCategory(transactions) };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to calculate cash flow: ${errorMessage}`);
      }
    }

    if (name === "get_cash_flow_trend") {
      const params = GetCashFlowTrendSchema.parse(args);
      
      try {
        const periods = await calculatePeriodFlows(apiClient, params);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                periodType: params.periodType,
                periods: periods,
                summary: {
                  avgInflow: formatCurrency(
                    periods.reduce((sum, p) => sum + p.inflows, 0) / periods.length
                  ),
                  avgOutflow: formatCurrency(
                    periods.reduce((sum, p) => sum + p.outflows, 0) / periods.length
                  ),
                  trend: calculateTrend(periods),
                },
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to calculate cash flow trend: ${errorMessage}`);
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });
}

function groupByCategory(transactions: Transaction[]): Record<string, any> {
  const groups: Record<string, { inflows: number; outflows: number }> = {};
  
  transactions.forEach((tx: Transaction) => {
    const category = tx.category || "Uncategorized";
    if (!groups[category]) {
      groups[category] = { inflows: 0, outflows: 0 };
    }
    
    const amount = parseAmount(tx.amount);
    if (tx.classification === 'income') {
      groups[category].inflows += amount;
    } else if (tx.classification === 'expense') {
      groups[category].outflows += amount;
    }
  });
  
  const result: Record<string, any> = {};
  Object.entries(groups).forEach(([cat, values]) => {
    result[cat] = {
      inflows: formatCurrency(values.inflows),
      outflows: formatCurrency(values.outflows),
      net: formatCurrency(values.inflows - values.outflows),
    };
  });
  
  return result;
}

async function calculatePeriodFlows(
  apiClient: MaybeFinanceAPI,
  params: z.infer<typeof GetCashFlowTrendSchema>
): Promise<Array<any>> {
  const periods = [];
  const now = new Date();
  
  for (let i = params.periods - 1; i >= 0; i--) {
    let startDate: Date;
    let endDate: Date;
    
    switch (params.periodType) {
      case "day":
        startDate = startOfDay(subDays(now, i));
        endDate = endOfDay(subDays(now, i));
        break;
      case "week":
        startDate = startOfDay(subDays(now, (i + 1) * 7));
        endDate = endOfDay(subDays(now, i * 7));
        break;
      case "month":
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        break;
    }
    
    const { transactions } = await apiClient.getTransactions({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    
    const inflows = transactions
      .filter((t: Transaction) => t.classification === 'income')
      .reduce((sum: number, t: Transaction) => sum + parseAmount(t.amount), 0);
      
    const outflows = transactions
      .filter((t: Transaction) => t.classification === 'expense')
      .reduce((sum: number, t: Transaction) => sum + parseAmount(t.amount), 0);
    
    periods.push({
      period: format(startDate, params.periodType === "day" ? "yyyy-MM-dd" : "yyyy-MM"),
      inflows,
      outflows,
      net: inflows - outflows,
      transactionCount: transactions.length,
    });
  }
  
  return periods;
}

function calculateTrend(periods: Array<{ net: number }>): string {
  if (periods.length < 2) return "insufficient data";
  
  const firstHalf = periods.slice(0, Math.floor(periods.length / 2));
  const secondHalf = periods.slice(Math.floor(periods.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, p) => sum + p.net, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, p) => sum + p.net, 0) / secondHalf.length;
  
  const change = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
  
  if (change > 10) return "improving";
  if (change < -10) return "declining";
  return "stable";
}