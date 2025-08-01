import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MaybeFinanceAPI } from "../services/api-client.js";
import { CategorizationEngine, SPECIAL_CATEGORIES } from "../services/categorization-engine.js";
import { parseDate, formatDateForAPI } from "../utils/date-utils.js";
import { formatCurrency } from "../utils/formatters.js";

const AutoCategorizeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  onlyUncategorized: z.boolean().default(true),
  dryRun: z.boolean().default(false),
  limit: z.number().int().positive().max(1000).default(100),
});

const DetectSubscriptionsSchema = z.object({
  lookbackDays: z.number().int().positive().max(365).default(90),
  accountIds: z.array(z.string()).optional(),
  includeExpected: z.boolean().default(true),
});

const ManageCategoryRulesSchema = z.object({
  action: z.enum(['list', 'add', 'remove']),
  ruleId: z.string().optional(),
  rule: z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    priority: z.number(),
    conditions: z.object({
      merchantPatterns: z.array(z.string()).optional(),
      descriptionPatterns: z.array(z.string()).optional(),
      amountRange: z.object({
        min: z.number().optional(),
        max: z.number().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
});

export async function handleAutoCategorization(request: CallToolRequest, apiClient: MaybeFinanceAPI) {
  const engine = new CategorizationEngine();
    const { name, arguments: args } = request.params;

    if (name === "auto_categorize_all") {
      const params = AutoCategorizeSchema.parse(args);
      
      try {
        // Build query parameters
        const queryParams: any = {
          limit: params.limit,
        };
        
        if (params.startDate) {
          const date = parseDate(params.startDate);
          queryParams.startDate = formatDateForAPI(date);
        }
        if (params.endDate) {
          const date = parseDate(params.endDate);
          queryParams.endDate = formatDateForAPI(date);
        }

        // Get transactions
        const { transactions } = await apiClient.getTransactions(queryParams);
        
        // Filter
        let toProcess = transactions;
        if (params.onlyUncategorized) {
          toProcess = transactions.filter(tx => !tx.category);
        }
        if (params.accountIds?.length) {
          toProcess = toProcess.filter(tx => 
            params.accountIds!.includes(tx.account?.id || '')
          );
        }

        const results = {
          total: toProcess.length,
          categorized: 0,
          byCategory: {} as Record<string, number>,
          preview: params.dryRun ? [] as any[] : undefined,
          changes: [] as any[],
        };

        // Process each transaction
        for (const transaction of toProcess) {
          const suggestedCategory = await engine.categorize(transaction);
          
          if (suggestedCategory && suggestedCategory !== transaction.category) {
            results.categorized++;
            results.byCategory[suggestedCategory] = (results.byCategory[suggestedCategory] || 0) + 1;
            
            const change = {
              id: transaction.id,
              name: transaction.name,
              amount: formatCurrency(transaction.amount, transaction.currency),
              date: transaction.date,
              oldCategory: transaction.category || 'Uncategorized',
              newCategory: suggestedCategory,
            };
            
            if (params.dryRun) {
              results.preview!.push(change);
            } else {
              await apiClient.updateTransaction(transaction.id, {
                category: suggestedCategory,
              });
              results.changes.push(change);
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                summary: {
                  processed: toProcess.length,
                  categorized: results.categorized,
                  unchanged: toProcess.length - results.categorized,
                },
                byCategory: results.byCategory,
                specialCategories: {
                  [SPECIAL_CATEGORIES.REQUIRED_PURCHASES]: results.byCategory[SPECIAL_CATEGORIES.REQUIRED_PURCHASES] || 0,
                  [SPECIAL_CATEGORIES.DISCRETIONARY]: results.byCategory[SPECIAL_CATEGORIES.DISCRETIONARY] || 0,
                  [SPECIAL_CATEGORIES.SUBSCRIPTIONS]: results.byCategory[SPECIAL_CATEGORIES.SUBSCRIPTIONS] || 0,
                  [SPECIAL_CATEGORIES.SPENDING_BUT_ASSETS]: results.byCategory[SPECIAL_CATEGORIES.SPENDING_BUT_ASSETS] || 0,
                },
                preview: params.dryRun ? results.preview : undefined,
                changes: !params.dryRun ? results.changes : undefined,
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to auto-categorize: ${errorMessage}`);
      }
    }

    if (name === "detect_subscriptions") {
      const params = DetectSubscriptionsSchema.parse(args);
      
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - params.lookbackDays);
        
        const queryParams: any = {
          startDate: formatDateForAPI(startDate),
          endDate: formatDateForAPI(new Date()),
          limit: 1000, // Get many transactions for pattern analysis
        };

        const { transactions } = await apiClient.getTransactions(queryParams);
        
        // Filter by accounts if specified
        let filtered = transactions;
        if (params.accountIds?.length) {
          filtered = transactions.filter(tx => 
            params.accountIds!.includes(tx.account?.id || '')
          );
        }

        // Detect subscriptions
        const subscriptions = await engine.detectSubscriptions(filtered);
        
        // Format results
        const formattedSubscriptions = subscriptions.map(sub => ({
          merchant: sub.merchant,
          amount: formatCurrency(sub.amount, 'EUR'),
          frequency: sub.frequency,
          confidence: `${Math.round(sub.confidence * 100)}%`,
          lastPayment: sub.lastDate.toISOString().split('T')[0],
          nextExpected: params.includeExpected ? 
            sub.nextExpectedDate.toISOString().split('T')[0] : undefined,
          occurrences: sub.transactions.length,
          totalSpent: formatCurrency(
            sub.amount * sub.transactions.length, 
            'EUR'
          ),
          yearlyEstimate: formatCurrency(
            sub.frequency === 'monthly' ? sub.amount * 12 :
            sub.frequency === 'weekly' ? sub.amount * 52 :
            sub.amount, 
            'EUR'
          ),
        }));

        // Calculate totals
        const totalMonthly = subscriptions
          .filter(s => s.frequency === 'monthly')
          .reduce((sum, s) => sum + s.amount, 0);
        const totalYearly = subscriptions.reduce((sum, s) => {
          if (s.frequency === 'monthly') return sum + (s.amount * 12);
          if (s.frequency === 'weekly') return sum + (s.amount * 52);
          return sum + s.amount;
        }, 0);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                summary: {
                  subscriptionsFound: subscriptions.length,
                  monthlyTotal: formatCurrency(totalMonthly, 'EUR'),
                  yearlyTotal: formatCurrency(totalYearly, 'EUR'),
                },
                subscriptions: formattedSubscriptions,
                insights: [
                  subscriptions.length > 10 ? 
                    "💡 You have many subscriptions - consider reviewing if you use them all" : null,
                  totalMonthly > 100 ?
                    `💸 Your monthly subscriptions total ${formatCurrency(totalMonthly, 'EUR')} - that's ${formatCurrency(totalYearly, 'EUR')} per year!` : null,
                ].filter(Boolean),
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to detect subscriptions: ${errorMessage}`);
      }
    }

    if (name === "get_categorization_rules") {
      // Default to 'list' action if not specified
      const params = ManageCategoryRulesSchema.parse({ action: 'list', ...args });
      
      try {
        if (params.action === 'list' || !params.action) {
          const rules = engine.getRules();
          const formattedRules = rules.map(rule => ({
            id: rule.id,
            name: rule.name,
            category: rule.category,
            priority: rule.priority,
            conditions: {
              merchantPatterns: rule.conditions.merchantPatterns?.map(r => r.source),
              descriptionPatterns: rule.conditions.descriptionPatterns?.map(r => r.source),
              amountRange: rule.conditions.amountRange,
              dayOfWeek: rule.conditions.dayOfWeek,
              dayOfMonth: rule.conditions.dayOfMonth,
              isRecurring: rule.conditions.isRecurring,
            },
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  totalRules: rules.length,
                  rules: formattedRules,
                  categories: Object.values(SPECIAL_CATEGORIES),
                }, null, 2),
              },
            ],
          };
        }

        if (params.action === 'add' && params.rule) {
          const newRule = {
            ...params.rule,
            conditions: {
              ...params.rule.conditions,
              merchantPatterns: params.rule.conditions?.merchantPatterns?.map(p => new RegExp(p, 'i')),
              descriptionPatterns: params.rule.conditions?.descriptionPatterns?.map(p => new RegExp(p, 'i')),
            },
          };
          
          engine.addRule(newRule as any);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: `Rule '${params.rule.name}' added successfully`,
                  rule: params.rule,
                }, null, 2),
              },
            ],
          };
        }

        if (params.action === 'remove' && params.ruleId) {
          const removed = engine.removeRule(params.ruleId);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: removed,
                  message: removed ? 
                    `Rule '${params.ruleId}' removed successfully` :
                    `Rule '${params.ruleId}' not found`,
                }, null, 2),
              },
            ],
          };
        }

        throw new Error('Invalid action or missing parameters');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to manage rules: ${errorMessage}`);
      }
    }

    throw new Error(`Unknown tool: ${name}`);
}