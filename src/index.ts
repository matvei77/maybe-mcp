import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MaybeFinanceAPI } from "./services/api-client.js";
import { registerTools } from "./tools/index.js";

const server = new Server(
  {
    name: "maybe-finance-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize API client
const apiBaseUrl = process.env.API_BASE_URL || "https://maybe.lapushinskii.com/api/v1";
const apiKey = process.env.API_KEY || "";

if (!apiKey) {
  console.error("Error: API_KEY environment variable is required");
  process.exit(1);
}

const apiClient = new MaybeFinanceAPI(apiBaseUrl, apiKey);

registerTools(server, apiClient);

server.onerror = (error) => {
  console.error("[MCP Error]", error);
};

process.on('SIGINT', async () => {
  process.exit(0);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Maybe Finance MCP Server started");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});