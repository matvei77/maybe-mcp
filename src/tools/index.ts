import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { MaybeFinanceAPI } from "../services/api-client.js";
import { registerAccountTools } from "./accounts.js";
import { registerTransactionTools } from "./transactions.js";
import { registerTransactionManagementTools } from "./transaction-management.js";
import { registerCashFlowTools } from "./cash-flow.js";
import { registerCategoryTools } from "./categories.js";
import { registerCSVImportTools } from "./csv-import.js";
import { registerAutoCategorization } from "./auto-categorization.js";

export function registerTools(server: Server, apiClient: MaybeFinanceAPI) {
  registerAccountTools(server, apiClient);
  registerTransactionTools(server, apiClient);
  registerTransactionManagementTools(server, apiClient);
  registerCashFlowTools(server, apiClient);
  registerCategoryTools(server, apiClient);
  registerCSVImportTools(server, apiClient);
  registerAutoCategorization(server, apiClient);
}