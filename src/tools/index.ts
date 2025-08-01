import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { MaybeFinanceAPI } from "../services/api-client.js";
import { handleAccountTools } from "./accounts.js";
import { handleTransactionTools } from "./transactions.js";
import { handleTransactionManagementTools } from "./transaction-management.js";
import { handleCashFlowTools } from "./cash-flow.js";
import { handleCategoryTools } from "./categories.js";
import { handleCSVImportTools } from "./csv-import.js";
import { handleAutoCategorization } from "./auto-categorization.js";
import { ALL_TOOLS } from "./all-tools.js";

export function registerTools(server: Server, apiClient: MaybeFinanceAPI) {
  // Register the list tools handler ONCE with ALL tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: ALL_TOOLS,
    };
  });

  // Register the call tool handler that dispatches to appropriate handlers
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    // Dispatch to appropriate handler based on tool name
    if (name === "get_accounts" || name === "get_account_balance") {
      return handleAccountTools(request, apiClient);
    }
    
    if (name === "get_transactions" || name === "search_transactions" || name === "get_spending_breakdown") {
      return handleTransactionTools(request, apiClient);
    }
    
    if (name === "create_transaction" || name === "update_transaction" || 
        name === "categorize_transaction" || name === "bulk_categorize") {
      return handleTransactionManagementTools(request, apiClient);
    }
    
    if (name === "get_cash_flow" || name === "get_rolling_cash_flow" || name === "forecast_cash_flow") {
      return handleCashFlowTools(request, apiClient);
    }
    
    if (name === "get_categories" || name === "create_category") {
      return handleCategoryTools(request, apiClient);
    }
    
    if (name === "import_csv" || name === "analyze_csv") {
      return handleCSVImportTools(request, apiClient);
    }
    
    if (name === "auto_categorize_all" || name === "get_categorization_rules") {
      return handleAutoCategorization(request, apiClient);
    }

    throw new Error(`Unknown tool: ${name}`);
  });
}