import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MaybeFinanceAPI } from "../services/api-client.js";

const CreateTransactionSchema = z.object({
  accountId: z.string().uuid(),
  date: z.string(),
  amount: z.string(),
  name: z.string(),
  category: z.string().optional(),
  merchant: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const UpdateTransactionSchema = z.object({
  transactionId: z.string().uuid(),
  category: z.string().optional(),
  excluded: z.boolean().optional(),
  name: z.string().optional(),
  amount: z.string().optional(),
  date: z.string().optional(),
  merchant: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const DeleteTransactionSchema = z.object({
  transactionId: z.string().uuid(),
});

export function registerTransactionManagementTools(server: Server, apiClient: MaybeFinanceAPI) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "create_transaction",
          description: "Create a new manual transaction entry",
          inputSchema: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "Account ID for the transaction",
              },
              date: {
                type: "string",
                description: "Transaction date (YYYY-MM-DD or DD-MM-YYYY)",
              },
              amount: {
                type: "string",
                description: "Transaction amount (negative for income, positive for expense)",
              },
              name: {
                type: "string",
                description: "Transaction description",
              },
              category: {
                type: "string",
                description: "Category name (optional)",
              },
              merchant: {
                type: "string",
                description: "Merchant name (optional)",
              },
              notes: {
                type: "string",
                description: "Additional notes (optional)",
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Tags for organization (optional)",
              },
            },
            required: ["accountId", "date", "amount", "name"],
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
              excluded: {
                type: "boolean",
                description: "Whether to exclude from reports",
              },
              name: {
                type: "string",
                description: "New transaction name",
              },
              amount: {
                type: "string",
                description: "New amount",
              },
              date: {
                type: "string",
                description: "New date",
              },
              merchant: {
                type: "string",
                description: "New merchant",
              },
              notes: {
                type: "string",
                description: "New notes",
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "New tags",
              },
            },
            required: ["transactionId"],
          },
        },
        {
          name: "delete_transaction",
          description: "Delete a transaction",
          inputSchema: {
            type: "object",
            properties: {
              transactionId: {
                type: "string",
                description: "Transaction ID to delete",
              },
            },
            required: ["transactionId"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "create_transaction") {
      const params = CreateTransactionSchema.parse(args);
      
      try {
        // Convert date format from DD-MM-YYYY to YYYY-MM-DD if needed
        let formattedDate = params.date;
        if (params.date.match(/^\d{2}-\d{2}-\d{4}$/)) {
          const [day, month, year] = params.date.split('-');
          formattedDate = `${year}-${month}-${day}`;
        }

        const transaction = await apiClient.createTransaction({
          ...params,
          date: formattedDate,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Transaction created successfully",
                transaction: {
                  id: transaction.id,
                  name: transaction.name,
                  amount: transaction.amount,
                  date: transaction.date,
                  category: transaction.category,
                  merchant: transaction.merchant || undefined,
                },
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to create transaction: ${errorMessage}`);
      }
    }

    if (name === "update_transaction") {
      const params = UpdateTransactionSchema.parse(args);
      
      try {
        // Convert date format if provided
        const { transactionId, ...updateData } = params;
        
        if (updateData.date && updateData.date.match(/^\d{2}-\d{2}-\d{4}$/)) {
          const [day, month, year] = updateData.date.split('-');
          updateData.date = `${year}-${month}-${day}`;
        }

        const transaction = await apiClient.updateTransaction(params.transactionId, updateData);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Transaction updated successfully",
                transaction: {
                  id: transaction.id,
                  name: transaction.name,
                  amount: transaction.amount,
                  date: transaction.date,
                  category: transaction.category,
                  merchant: transaction.merchant || undefined,
                  excluded: transaction.excluded,
                },
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to update transaction: ${errorMessage}`);
      }
    }

    if (name === "delete_transaction") {
      const params = DeleteTransactionSchema.parse(args);
      
      try {
        await apiClient.deleteTransaction(params.transactionId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Transaction deleted successfully",
                transactionId: params.transactionId,
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to delete transaction: ${errorMessage}`);
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });
}