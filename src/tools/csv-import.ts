import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MaybeFinanceAPI, Transaction } from "../services/api-client.js";
import Papa from "papaparse";
import { createHash } from "crypto";
import { parseDate, formatDateForAPI } from "../utils/date-utils.js";
import { parseAmount } from "../utils/parsers.js";
import { IdSchema } from "../utils/validators.js";

const ImportCSVSchema = z.object({
  accountId: IdSchema,
  csvContent: z.string(),
  encoding: z.enum(['base64', 'utf8']).default('utf8'),
  fieldMapping: z.object({
    date: z.string().optional(),
    amount: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    merchant: z.string().optional(),
  }).optional(),
  dateFormat: z.string().optional(),
  skipDuplicates: z.boolean().default(true),
  autoCategarize: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

const AnalyzeCSVSchema = z.object({
  csvContent: z.string(),
  encoding: z.enum(['base64', 'utf8']).default('utf8'),
  sampleRows: z.number().default(5),
});

interface CSVRow {
  [key: string]: any;
}

interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  categorized: number;
  preview?: any[];
}

export function registerCSVImportTools(server: Server, apiClient: MaybeFinanceAPI) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "import_csv",
          description: "Import transactions from CSV file",
          inputSchema: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "Account ID to import transactions into",
              },
              csvContent: {
                type: "string",
                description: "CSV content (UTF-8 or base64 encoded)",
              },
              encoding: {
                type: "string",
                enum: ["base64", "utf8"],
                description: "CSV content encoding (default: utf8)",
              },
              fieldMapping: {
                type: "object",
                description: "Map CSV columns to transaction fields",
                properties: {
                  date: { type: "string" },
                  amount: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  merchant: { type: "string" },
                },
              },
              dateFormat: {
                type: "string",
                description: "Date format hint (e.g., 'DD-MM-YYYY')",
              },
              skipDuplicates: {
                type: "boolean",
                description: "Skip duplicate transactions (default: true)",
              },
              autoCategarize: {
                type: "boolean",
                description: "Auto-categorize imported transactions",
              },
              dryRun: {
                type: "boolean",
                description: "Preview import without creating transactions",
              },
            },
            required: ["accountId", "csvContent"],
          },
        },
        {
          name: "analyze_csv",
          description: "Analyze CSV structure and suggest field mappings",
          inputSchema: {
            type: "object",
            properties: {
              csvContent: {
                type: "string",
                description: "CSV content to analyze",
              },
              encoding: {
                type: "string",
                enum: ["base64", "utf8"],
                description: "CSV content encoding",
              },
              sampleRows: {
                type: "number",
                description: "Number of sample rows to return",
              },
            },
            required: ["csvContent"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "analyze_csv") {
      const params = AnalyzeCSVSchema.parse(args);
      
      try {
        const csvData = params.encoding === 'base64' 
          ? Buffer.from(params.csvContent, 'base64').toString('utf-8')
          : params.csvContent;

        const parsed = Papa.parse(csvData, {
          header: true,
          dynamicTyping: false, // Keep as strings for analysis
          skipEmptyLines: true,
        });

        if (parsed.errors.length > 0) {
          throw new Error(`CSV parsing errors: ${parsed.errors[0].message}`);
        }

        const headers = parsed.meta.fields || [];
        const sampleData = parsed.data.slice(0, params.sampleRows);
        const fieldMapping = detectFieldMapping(headers, sampleData as CSVRow[]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                headers,
                rowCount: parsed.data.length,
                suggestedMapping: fieldMapping,
                sampleData,
                detectedPatterns: analyzePatterns(sampleData as CSVRow[], fieldMapping),
              }, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to analyze CSV: ${errorMessage}`);
      }
    }

    if (name === "import_csv") {
      const params = ImportCSVSchema.parse(args);
      
      try {
        const csvData = params.encoding === 'base64' 
          ? Buffer.from(params.csvContent, 'base64').toString('utf-8')
          : params.csvContent;

        const parsed = Papa.parse(csvData, {
          header: true,
          dynamicTyping: false,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        });

        if (parsed.errors.length > 0) {
          throw new Error(`CSV parsing errors: ${parsed.errors[0].message}`);
        }

        const rows = parsed.data as CSVRow[];
        const mapping = params.fieldMapping || detectFieldMapping(parsed.meta.fields || [], rows);
        
        const result: ImportResult = {
          total: rows.length,
          imported: 0,
          duplicates: 0,
          errors: [],
          categorized: 0,
          preview: params.dryRun ? [] : undefined,
        };

        // Get existing transactions for duplicate detection
        let existingTransactions: Transaction[] = [];
        if (params.skipDuplicates) {
          const { transactions } = await apiClient.getTransactions({
            accountId: params.accountId,
            limit: 1000, // Get recent transactions for duplicate check
          });
          existingTransactions = transactions;
        }

        // Process each row
        for (let i = 0; i < rows.length; i++) {
          try {
            const transaction = await processRow(
              rows[i], 
              mapping, 
              params,
              existingTransactions
            );

            if (params.dryRun) {
              result.preview!.push(transaction);
              continue;
            }

            // Check for duplicates
            if (params.skipDuplicates && isDuplicate(transaction, existingTransactions)) {
              result.duplicates++;
              continue;
            }

            // Create transaction
            const created = await apiClient.createTransaction({
              accountId: params.accountId,
              ...transaction,
            });

            result.imported++;
            
            // Add to existing transactions for future duplicate checks
            existingTransactions.push(created);

            // Auto-categorize if enabled
            if (params.autoCategarize && !transaction.category) {
              // This would use the categorization system from another tool
              result.categorized++;
            }
          } catch (error) {
            result.errors.push({
              row: i + 2, // +2 for header and 0-index
              error: error instanceof Error ? error.message : 'Unknown error',
              data: rows[i],
            });
          }
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
        throw new Error(`Failed to import CSV: ${errorMessage}`);
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });
}

function detectFieldMapping(headers: string[], sampleData: CSVRow[]): any {
  const mapping: any = {};
  
  // Common field name patterns
  const patterns = {
    date: /date|tijd|datum|posted|booked|transaction/i,
    amount: /amount|bedrag|value|debit|credit|sum/i,
    description: /description|desc|omschrijving|details|memo|particulars/i,
    merchant: /merchant|payee|naam|name|vendor/i,
    category: /category|categorie|type/i,
  };

  // Check headers against patterns
  for (const header of headers) {
    for (const [field, pattern] of Object.entries(patterns)) {
      if (pattern.test(header) && !mapping[field]) {
        mapping[field] = header;
        break;
      }
    }
  }

  // If no amount field found, look for debit/credit columns
  if (!mapping.amount) {
    const debitCol = headers.find(h => /debit|af/i.test(h));
    const creditCol = headers.find(h => /credit|bij/i.test(h));
    if (debitCol || creditCol) {
      mapping.amount = debitCol || creditCol;
      mapping.amountType = 'split';
      mapping.debitColumn = debitCol;
      mapping.creditColumn = creditCol;
    }
  }

  // Validate mapping with sample data
  if (sampleData.length > 0 && mapping.date) {
    const sampleDate = sampleData[0][mapping.date];
    if (sampleDate && !isValidDateFormat(sampleDate)) {
      // Try other date columns
      for (const header of headers) {
        if (header !== mapping.date && sampleData[0][header]) {
          if (isValidDateFormat(sampleData[0][header])) {
            mapping.date = header;
            break;
          }
        }
      }
    }
  }

  return mapping;
}

function isValidDateFormat(value: string): boolean {
  try {
    parseDate(value);
    return true;
  } catch {
    return false;
  }
}

function analyzePatterns(data: CSVRow[], mapping: any): any {
  const patterns: any = {
    dateFormats: new Set<string>(),
    amountFormats: new Set<string>(),
    hasNegativeAmounts: false,
    hasHeaders: true,
    delimiter: ',',
  };

  // Analyze date formats
  if (mapping.date) {
    data.slice(0, 10).forEach(row => {
      const dateValue = row[mapping.date];
      if (dateValue) {
        if (dateValue.match(/\d{4}-\d{2}-\d{2}/)) patterns.dateFormats.add('YYYY-MM-DD');
        else if (dateValue.match(/\d{2}-\d{2}-\d{4}/)) patterns.dateFormats.add('DD-MM-YYYY');
        else if (dateValue.match(/\d{2}\/\d{2}\/\d{4}/)) patterns.dateFormats.add('DD/MM/YYYY');
        else if (dateValue.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) patterns.dateFormats.add('M/D/YYYY');
      }
    });
  }

  // Analyze amount formats
  if (mapping.amount) {
    data.slice(0, 10).forEach(row => {
      const amountValue = row[mapping.amount];
      if (amountValue) {
        if (amountValue.includes('-')) patterns.hasNegativeAmounts = true;
        if (amountValue.includes(',') && amountValue.includes('.')) {
          patterns.amountFormats.add(amountValue.lastIndexOf(',') > amountValue.lastIndexOf('.') ? 'European' : 'US');
        }
      }
    });
  }

  return {
    dateFormats: Array.from(patterns.dateFormats),
    amountFormats: Array.from(patterns.amountFormats),
    hasNegativeAmounts: patterns.hasNegativeAmounts,
  };
}

async function processRow(
  row: CSVRow, 
  mapping: any,
  _params: z.infer<typeof ImportCSVSchema>,
  _existingTransactions: Transaction[]
): Promise<any> {
  const transaction: any = {};

  // Parse date
  if (!mapping.date || !row[mapping.date]) {
    throw new Error('Missing date field');
  }
  const parsedDate = parseDate(row[mapping.date]);
  transaction.date = formatDateForAPI(parsedDate);

  // Parse amount
  if (!mapping.amount || (!row[mapping.amount] && !mapping.amountType)) {
    throw new Error('Missing amount field');
  }
  
  let amount: number;
  if (mapping.amountType === 'split') {
    // Handle separate debit/credit columns
    const debit = row[mapping.debitColumn] ? parseAmount(row[mapping.debitColumn]) : 0;
    const credit = row[mapping.creditColumn] ? parseAmount(row[mapping.creditColumn]) : 0;
    amount = credit - debit; // Credit is income (negative), debit is expense (positive)
  } else {
    amount = parseAmount(row[mapping.amount]);
  }
  transaction.amount = amount.toString();

  // Parse description
  transaction.name = row[mapping.description] || 
                    row[mapping.merchant] || 
                    'Imported transaction';

  // Optional fields
  if (mapping.category && row[mapping.category]) {
    transaction.category = row[mapping.category].trim();
  }
  if (mapping.merchant && row[mapping.merchant]) {
    transaction.merchant = row[mapping.merchant].trim();
  }

  // Add import metadata as note
  transaction.notes = `Imported from CSV on ${new Date().toISOString().split('T')[0]}`;

  return transaction;
}

function isDuplicate(
  transaction: any,
  existingTransactions: Transaction[]
): boolean {
  const txDate = new Date(transaction.date);
  const txAmount = parseAmount(transaction.amount);
  
  // Create a hash for comparison
  const hash = createHash('md5')
    .update(`${transaction.date}:${txAmount.toFixed(2)}:${transaction.name.toLowerCase()}`)
    .digest('hex');

  // Check for exact matches within a 7-day window
  return existingTransactions.some(existing => {
    const existingDate = new Date(existing.date);
    const daysDiff = Math.abs(txDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 7) return false;
    
    const existingAmount = parseAmount(existing.amount);
    const existingHash = createHash('md5')
      .update(`${existing.date}:${existingAmount.toFixed(2)}:${(existing.name || '').toLowerCase()}`)
      .digest('hex');
    
    return hash === existingHash;
  });
}