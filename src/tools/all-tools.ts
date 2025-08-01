import { ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type Tool = z.infer<typeof ToolSchema>;

export const ALL_TOOLS: Tool[] = [
  // Account Tools
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
        groupByType: {
          type: "boolean",
          description: "Group accounts by type (default: false)",
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
  
  // Transaction Tools
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
          description: "Start date (ISO format or DD-MM-YYYY)",
        },
        endDate: {
          type: "string",
          description: "End date (ISO format or DD-MM-YYYY)",
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
          description: "Exclude transfer transactions",
        },
        includeExcluded: {
          type: "boolean",
          description: "Include excluded transactions",
        },
        minAmount: {
          type: "number",
          description: "Minimum amount filter",
        },
        maxAmount: {
          type: "number",
          description: "Maximum amount filter",
        },
        limit: {
          type: "number",
          description: "Number of results per page",
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
    description: "Search transactions by text query",
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
        category: {
          type: "string",
          description: "Filter by category",
        },
        merchant: {
          type: "string",
          description: "Filter by merchant",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
        limit: {
          type: "number",
          description: "Number of results per page",
        },
        offset: {
          type: "number",
          description: "Number of results to skip",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_spending_breakdown",
    description: "Get spending breakdown by category for a time period",
    inputSchema: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date (ISO format or DD-MM-YYYY)",
        },
        endDate: {
          type: "string",
          description: "End date (ISO format or DD-MM-YYYY)",
        },
        accountId: {
          type: "string",
          description: "Filter by account ID",
        },
        groupBy: {
          type: "string",
          enum: ["category", "merchant", "account"],
          description: "Group by category, merchant, or account",
        },
        excludeTransfers: {
          type: "boolean",
          description: "Exclude transfers from breakdown",
        },
        includeIncome: {
          type: "boolean",
          description: "Include income in breakdown",
        },
      },
    },
  },
  
  // Transaction Management Tools
  {
    name: "create_transaction",
    description: "Create a new transaction",
    inputSchema: {
      type: "object",
      properties: {
        accountId: {
          type: "string",
          description: "Account ID for the transaction",
        },
        amount: {
          type: "string",
          description: "Transaction amount (negative for expenses, positive for income)",
        },
        date: {
          type: "string",
          description: "Transaction date (ISO format or DD-MM-YYYY)",
        },
        description: {
          type: "string",
          description: "Transaction description",
        },
        category: {
          type: "string",
          description: "Category name",
        },
        merchant: {
          type: "string",
          description: "Merchant name",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Transaction tags",
        },
        notes: {
          type: "string",
          description: "Additional notes",
        },
      },
      required: ["accountId", "amount", "date", "description"],
    },
  },
  {
    name: "update_transaction",
    description: "Update an existing transaction",
    inputSchema: {
      type: "object",
      properties: {
        transactionId: {
          type: "string",
          description: "Transaction ID to update",
        },
        category: {
          type: "string",
          description: "New category",
        },
        merchant: {
          type: "string",
          description: "New merchant name",
        },
        description: {
          type: "string",
          description: "New description",
        },
        notes: {
          type: "string",
          description: "New notes",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "New tags (replaces existing)",
        },
        excludeFromReports: {
          type: "boolean",
          description: "Exclude from reports",
        },
      },
      required: ["transactionId"],
    },
  },
  {
    name: "categorize_transaction",
    description: "Quick categorization of a transaction",
    inputSchema: {
      type: "object",
      properties: {
        transactionId: {
          type: "string",
          description: "Transaction ID to categorize",
        },
        category: {
          type: "string",
          description: "Category name",
        },
      },
      required: ["transactionId", "category"],
    },
  },
  {
    name: "bulk_categorize",
    description: "Categorize multiple transactions at once",
    inputSchema: {
      type: "object",
      properties: {
        transactionIds: {
          type: "array",
          items: { type: "string" },
          description: "List of transaction IDs",
        },
        category: {
          type: "string",
          description: "Category to apply to all",
        },
      },
      required: ["transactionIds", "category"],
    },
  },
  
  // Cash Flow Tools
  {
    name: "get_cash_flow",
    description: "Get cash flow analysis for a period",
    inputSchema: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date (ISO format or DD-MM-YYYY)",
        },
        endDate: {
          type: "string",
          description: "End date (ISO format or DD-MM-YYYY)",
        },
        accountId: {
          type: "string",
          description: "Filter by account ID",
        },
        frequency: {
          type: "string",
          enum: ["daily", "weekly", "monthly"],
          description: "Aggregation frequency",
        },
      },
    },
  },
  {
    name: "get_rolling_cash_flow",
    description: "Get rolling cash flow analysis",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["7d", "30d", "90d", "365d"],
          description: "Rolling period",
        },
        accountId: {
          type: "string",
          description: "Filter by account ID",
        },
      },
    },
  },
  {
    name: "forecast_cash_flow",
    description: "Forecast future cash flow based on historical data",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to forecast",
        },
        accountId: {
          type: "string",
          description: "Filter by account ID",
        },
        includeRecurring: {
          type: "boolean",
          description: "Include detected recurring transactions",
        },
      },
      required: ["days"],
    },
  },
  
  // Category Tools
  {
    name: "get_categories",
    description: "Get all available categories",
    inputSchema: {
      type: "object",
      properties: {
        includeUsageStats: {
          type: "boolean",
          description: "Include usage statistics",
        },
      },
    },
  },
  {
    name: "create_category",
    description: "Create a new category",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Category name",
        },
        parentCategory: {
          type: "string",
          description: "Parent category name for subcategory",
        },
        color: {
          type: "string",
          description: "Category color (hex code)",
        },
        icon: {
          type: "string",
          description: "Category icon name",
        },
      },
      required: ["name"],
    },
  },
  
  // CSV Import Tools
  {
    name: "import_csv",
    description: "Import transactions from CSV file",
    inputSchema: {
      type: "object",
      properties: {
        accountId: {
          type: "string",
          description: "Account ID to import into",
        },
        csvContent: {
          type: "string",
          description: "CSV file content",
        },
        dateColumn: {
          type: "string",
          description: "Column name for date",
        },
        amountColumn: {
          type: "string",
          description: "Column name for amount",
        },
        descriptionColumn: {
          type: "string",
          description: "Column name for description",
        },
        skipDuplicates: {
          type: "boolean",
          description: "Skip duplicate transactions",
        },
        autoCategorize: {
          type: "boolean",
          description: "Auto-categorize imported transactions",
        },
      },
      required: ["accountId", "csvContent"],
    },
  },
  {
    name: "analyze_csv",
    description: "Analyze CSV structure before import",
    inputSchema: {
      type: "object",
      properties: {
        csvContent: {
          type: "string",
          description: "CSV file content to analyze",
        },
      },
      required: ["csvContent"],
    },
  },
  
  // Auto Categorization Tools
  {
    name: "auto_categorize_all",
    description: "Auto-categorize all uncategorized transactions",
    inputSchema: {
      type: "object",
      properties: {
        accountId: {
          type: "string",
          description: "Filter by account ID",
        },
        startDate: {
          type: "string",
          description: "Start date for categorization",
        },
        endDate: {
          type: "string",
          description: "End date for categorization",
        },
        dryRun: {
          type: "boolean",
          description: "Preview without applying changes",
        },
      },
    },
  },
  {
    name: "get_categorization_rules",
    description: "Get current categorization rules and patterns",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];