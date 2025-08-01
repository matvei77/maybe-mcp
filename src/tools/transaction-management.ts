import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MaybeFinanceAPI } from "../services/api-client.js";
import { IdSchema } from "../utils/validators.js";
import { parseDate, formatDateForAPI } from "../utils/date-utils.js";
import { parseAmount } from "../utils/parsers.js";

const CreateTransactionSchema = z.object({
  accountId: IdSchema,
  date: z.string(),
  amount: z.string(),
  name: z.string(),
  category: z.string().optional(),
  merchant: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const UpdateTransactionSchema = z.object({
  transactionId: IdSchema,
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
  transactionId: IdSchema,
});

export async function handleTransactionManagementTools(request: CallToolRequest, apiClient: MaybeFinanceAPI) {
    const { name, arguments: args } = request.params;

    if (name === "create_transaction") {
      const params = CreateTransactionSchema.parse(args);
      
      try {
        // Parse date using robust date parser
        const parsedDate = parseDate(params.date);
        const formattedDate = formatDateForAPI(parsedDate);
        
        // Validate amount
        const parsedAmount = parseAmount(params.amount);

        const transaction = await apiClient.createTransaction({
          ...params,
          date: formattedDate,
          amount: parsedAmount.toString(),
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
        
        if (updateData.date) {
          const parsedDate = parseDate(updateData.date);
          updateData.date = formatDateForAPI(parsedDate);
        }
        
        if (updateData.amount) {
          const parsedAmount = parseAmount(updateData.amount);
          updateData.amount = parsedAmount.toString();
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

    if (name === "categorize_transaction") {
      const params = z.object({
        transactionId: IdSchema,
        category: z.string(),
      }).parse(args);
      
      try {
        const transaction = await apiClient.updateTransaction(params.transactionId, {
          category: params.category,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Transaction categorized successfully",
                transaction: {
                  id: transaction.id,
                  name: transaction.name,
                  category: transaction.category,
                },
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to categorize transaction: ${errorMessage}`);
      }
    }

    if (name === "bulk_categorize") {
      const params = z.object({
        transactionIds: z.array(IdSchema),
        category: z.string(),
      }).parse(args);
      
      try {
        const results = await Promise.all(
          params.transactionIds.map(id => 
            apiClient.updateTransaction(id, { category: params.category })
              .then(() => ({ id, success: true }))
              .catch((error) => ({ id, success: false, error: error.message }))
          )
        );

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                summary: {
                  total: params.transactionIds.length,
                  successful,
                  failed: failed.length,
                },
                results,
                category: params.category,
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to bulk categorize: ${errorMessage}`);
      }
    }

    throw new Error(`Unknown tool: ${name}`);
}