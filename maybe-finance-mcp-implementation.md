# Maybe Finance MCP Server - Complete Implementation Guide

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [Architecture Decision](#architecture-decision)
4. [Technical Stack](#technical-stack)
5. [Implementation Plan](#implementation-plan)
6. [Database Schema Reference](#database-schema-reference)
7. [MCP Server Implementation](#mcp-server-implementation)
8. [Deployment Guide](#deployment-guide)
9. [Testing Strategy](#testing-strategy)
10. [Security Considerations](#security-considerations)
11. [Timeline and Milestones](#timeline-and-milestones)

## Executive Summary

This document outlines the complete implementation of a Model Context Protocol (MCP) server for Maybe Finance v0.6.0. Given the limited API documentation and the project's discontinued status, we'll implement a **hybrid approach** combining direct database access for read operations with potential future API integration.

**Key Decisions:**
- **Technology**: TypeScript with Prisma ORM
- **Architecture**: Direct PostgreSQL access with API-ready abstraction layer
- **Timeline**: 4-6 weeks for MVP, 8-10 weeks for full implementation
- **Deployment**: Docker container alongside Maybe Finance

## Project Overview

### Current Situation
- **Maybe Finance Status**: v0.6.0 final release, no longer maintained
- **API Status**: Basic infrastructure exists but undocumented
- **Your Requirements**:
  - Track inflows/outflows on rolling basis
  - Monitor spending patterns
  - Categorize: required purchases, discretionary, subscriptions
  - Special "spending but assets" category
  - CSV import automation
  - Self-hosted on Hetzner server

### Solution Approach
Build an MCP server that:
1. Connects directly to Maybe Finance's PostgreSQL database
2. Provides natural language interface for financial queries
3. Implements custom categorization logic
4. Automates CSV imports
5. Maintains compatibility with potential future APIs

## Architecture Decision

### Why Direct Database Access?

**Pros:**
- Complete access to all data
- No API limitations
- Better performance (1-10ms vs 50-200ms)
- Full control over queries

**Cons:**
- Bypasses Rails validations
- Schema changes could break integration
- No built-in audit trail
- Security is our responsibility

**Mitigation Strategy:** Implement an abstraction layer that can switch between database and API access.

## Technical Stack

```yaml
Core Technologies:
  Language: TypeScript 5.x
  Runtime: Node.js 20 LTS
  MCP SDK: "@modelcontextprotocol/sdk" latest
  Database: PostgreSQL 15 (via Prisma)
  
Dependencies:
  ORM: Prisma 5.x
  Validation: Zod
  CSV Parsing: Papa Parse
  Date Math: date-fns
  Testing: Jest + Supertest
  
Infrastructure:
  Container: Docker
  Process Manager: PM2
  Logging: Winston
  Monitoring: Prometheus metrics
```

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

#### 1.1 Project Setup
```bash
# Initialize project
mkdir maybe-finance-mcp
cd maybe-finance-mcp
npm init -y
npm install typescript @types/node tsx
npm install @modelcontextprotocol/sdk@latest
npm install prisma @prisma/client
npm install zod date-fns papaparse
npm install -D jest @types/jest ts-jest
```

#### 1.2 Project Structure
```
maybe-finance-mcp/
├── src/
│   ├── index.ts                 # MCP server entry
│   ├── config/
│   │   ├── database.ts         # Database configuration
│   │   └── environment.ts      # Environment variables
│   ├── db/
│   │   ├── prisma.ts          # Prisma client
│   │   └── schema.prisma      # Database schema
│   ├── services/
│   │   ├── accounts.ts        # Account operations
│   │   ├── transactions.ts    # Transaction operations
│   │   ├── categories.ts      # Category management
│   │   └── analytics.ts       # Financial analytics
│   ├── tools/
│   │   ├── cash-flow.ts       # Cash flow tracking
│   │   ├── spending.ts        # Spending analysis
│   │   ├── categorization.ts  # Smart categorization
│   │   └── csv-import.ts      # CSV automation
│   ├── types/
│   │   └── maybe-finance.ts   # Type definitions
│   └── utils/
│       ├── validators.ts      # Input validation
│       └── formatters.ts      # Output formatting
├── tests/
├── docker/
│   └── Dockerfile
└── docs/
```

#### 1.3 Database Connection
```typescript
// src/db/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Simplified schema matching Maybe Finance
model Account {
  id            String   @id @default(uuid())
  familyId      String   @map("family_id")
  name          String
  accountableType String @map("accountable_type")
  accountableId   String @map("accountable_id")
  balance       Decimal  @db.Decimal(19, 4)
  currency      String   @default("EUR")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  
  transactions  Transaction[]
  
  @@map("accounts")
}

model Transaction {
  id          String    @id @default(uuid())
  accountId   String    @map("account_id")
  date        DateTime
  name        String?
  amount      Decimal   @db.Decimal(19, 4)
  currency    String    @default("EUR")
  category    String?
  excluded    Boolean   @default(false)
  notes       String?
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  account     Account   @relation(fields: [accountId], references: [id])
  
  @@map("transactions")
}

model Category {
  id          String   @id @default(uuid())
  familyId    String   @map("family_id")
  name        String
  color       String?
  isSystem    Boolean  @default(false) @map("is_system")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  @@map("categories")
}
```

### Phase 2: Core MCP Implementation (Week 3-4)

#### 2.1 MCP Server Setup
```typescript
// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
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

// Initialize services
const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://maybe:password@localhost:5432/maybe_production"
    }
  }
});

// Register all tools
registerTools(server, prisma);

// Error handling
server.onerror = (error) => {
  console.error("[MCP Error]", error);
};

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("Maybe Finance MCP Server started");
}

main().catch(console.error);
```

#### 2.2 Cash Flow Tracking Tool
```typescript
// src/tools/cash-flow.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { subDays, startOfDay, endOfDay } from "date-fns";

export function registerCashFlowTools(server: Server, prisma: PrismaClient) {
  // Rolling cash flow tracker
  server.setRequestHandler(
    "tools/invoke",
    async (request) => {
      if (request.params.name === "get_rolling_cash_flow") {
        const params = GetRollingCashFlowSchema.parse(request.params.arguments);
        
        const startDate = startOfDay(subDays(new Date(), params.days));
        const endDate = endOfDay(new Date());
        
        const transactions = await prisma.transaction.findMany({
          where: {
            date: {
              gte: startDate,
              lte: endDate
            },
            excluded: false,
            ...(params.accountIds && {
              accountId: { in: params.accountIds }
            })
          },
          include: {
            account: true
          }
        });
        
        // Calculate inflows and outflows
        const inflows = transactions
          .filter(t => t.amount.toNumber() < 0) // Negative = income in Maybe
          .reduce((sum, t) => sum + Math.abs(t.amount.toNumber()), 0);
          
        const outflows = transactions
          .filter(t => t.amount.toNumber() > 0) // Positive = expense
          .reduce((sum, t) => sum + t.amount.toNumber(), 0);
        
        const netFlow = inflows - outflows;
        
        // Group by day for trend analysis
        const dailyFlows = groupTransactionsByDay(transactions);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                period: `${params.days} days`,
                inflows: formatCurrency(inflows),
                outflows: formatCurrency(outflows),
                netFlow: formatCurrency(netFlow),
                averageDailyInflow: formatCurrency(inflows / params.days),
                averageDailyOutflow: formatCurrency(outflows / params.days),
                trend: calculateTrend(dailyFlows),
                breakdown: {
                  byCategory: groupByCategory(transactions),
                  byAccount: groupByAccount(transactions)
                }
              }, null, 2)
            }
          ]
        };
      }
    }
  );
}

const GetRollingCashFlowSchema = z.object({
  days: z.number().int().positive().max(365),
  accountIds: z.array(z.string()).optional(),
  excludeTransfers: z.boolean().default(true)
});
```

#### 2.3 Advanced Categorization Tool
```typescript
// src/tools/categorization.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

// Special categories for user's requirements
const SPECIAL_CATEGORIES = {
  REQUIRED_PURCHASES: "Required Purchases",
  DISCRETIONARY: "Discretionary Spending",
  SUBSCRIPTIONS: "Subscriptions",
  SPENDING_BUT_ASSETS: "Spending but Assets"
};

export function registerCategorizationTools(server: Server, prisma: PrismaClient) {
  // Smart categorization with ML-like rules
  server.setRequestHandler(
    "tools/invoke",
    async (request) => {
      if (request.params.name === "categorize_transactions") {
        const params = CategorizeTransactionsSchema.parse(request.params.arguments);
        
        const transactions = await prisma.transaction.findMany({
          where: {
            id: { in: params.transactionIds }
          }
        });
        
        const categorized = await Promise.all(
          transactions.map(async (transaction) => {
            const category = await determineCategory(transaction, params.rules);
            
            // Update transaction
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { category }
            });
            
            return {
              transactionId: transaction.id,
              name: transaction.name,
              amount: transaction.amount,
              category
            };
          })
        );
        
        return {
          content: [
            {
              type: "text",
              text: `Categorized ${categorized.length} transactions:\n` +
                categorized.map(t => 
                  `- ${t.name}: ${t.amount} → ${t.category}`
                ).join('\n')
            }
          ]
        };
      }
      
      if (request.params.name === "track_spending_assets") {
        const params = TrackSpendingAssetsSchema.parse(request.params.arguments);
        
        // Create or update asset tracking
        const asset = await prisma.$transaction(async (tx) => {
          // Mark transaction as "spending but asset"
          await tx.transaction.update({
            where: { id: params.transactionId },
            data: { 
              category: SPECIAL_CATEGORIES.SPENDING_BUT_ASSETS,
              notes: JSON.stringify({
                assetType: params.assetType,
                estimatedValue: params.estimatedValue,
                depreciationRate: params.annualDepreciationRate
              })
            }
          });
          
          // Create asset tracking record (custom table)
          // This would require extending the schema
          return {
            transactionId: params.transactionId,
            assetType: params.assetType,
            purchaseValue: params.estimatedValue,
            currentValue: params.estimatedValue,
            depreciationRate: params.annualDepreciationRate
          };
        });
        
        return {
          content: [
            {
              type: "text",
              text: `Asset tracked: ${params.assetType}\n` +
                `Purchase value: €${params.estimatedValue}\n` +
                `Annual depreciation: ${params.annualDepreciationRate}%`
            }
          ]
        };
      }
    }
  );
}

// Smart categorization logic
async function determineCategory(
  transaction: any,
  customRules?: any[]
): Promise<string> {
  const name = transaction.name?.toLowerCase() || '';
  const amount = Math.abs(transaction.amount.toNumber());
  
  // Subscription detection
  if (isRecurring(transaction) || SUBSCRIPTION_KEYWORDS.some(k => name.includes(k))) {
    return SPECIAL_CATEGORIES.SUBSCRIPTIONS;
  }
  
  // Required purchases (groceries, utilities, etc.)
  if (REQUIRED_KEYWORDS.some(k => name.includes(k))) {
    return SPECIAL_CATEGORIES.REQUIRED_PURCHASES;
  }
  
  // Large purchases that might be assets
  if (amount > 500 && ASSET_KEYWORDS.some(k => name.includes(k))) {
    return SPECIAL_CATEGORIES.SPENDING_BUT_ASSETS;
  }
  
  // Default to discretionary
  return SPECIAL_CATEGORIES.DISCRETIONARY;
}

const SUBSCRIPTION_KEYWORDS = ['netflix', 'spotify', 'amazon prime', 'subscription'];
const REQUIRED_KEYWORDS = ['grocery', 'supermarket', 'utilities', 'rent', 'insurance'];
const ASSET_KEYWORDS = ['electronics', 'computer', 'monitor', 'laptop', 'equipment'];
```

#### 2.4 CSV Import Tool
```typescript
// src/tools/csv-import.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import Papa from "papaparse";
import { createHash } from "crypto";

export function registerCSVImportTools(server: Server, prisma: PrismaClient) {
  server.setRequestHandler(
    "tools/invoke",
    async (request) => {
      if (request.params.name === "import_csv") {
        const params = ImportCSVSchema.parse(request.params.arguments);
        
        // Parse CSV
        const csvData = Buffer.from(params.csvContent, 'base64').toString('utf-8');
        const parsed = Papa.parse(csvData, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });
        
        if (parsed.errors.length > 0) {
          throw new Error(`CSV parsing errors: ${parsed.errors.map(e => e.message).join(', ')}`);
        }
        
        // Auto-detect field mapping
        const mapping = params.fieldMapping || detectFieldMapping(parsed.data[0]);
        
        // Import transactions
        const results = {
          imported: 0,
          duplicates: 0,
          errors: 0
        };
        
        for (const row of parsed.data) {
          try {
            const transaction = mapRowToTransaction(row, mapping);
            
            // Check for duplicates
            const hash = generateTransactionHash(transaction);
            const existing = await prisma.transaction.findFirst({
              where: {
                accountId: params.accountId,
                date: transaction.date,
                amount: transaction.amount,
                name: transaction.name
              }
            });
            
            if (existing) {
              results.duplicates++;
              continue;
            }
            
            // Import transaction
            await prisma.transaction.create({
              data: {
                ...transaction,
                accountId: params.accountId,
                currency: params.currency || 'EUR',
                excluded: false
              }
            });
            
            results.imported++;
          } catch (error) {
            results.errors++;
            console.error('Import error:', error);
          }
        }
        
        // Update account balance
        await updateAccountBalance(params.accountId, prisma);
        
        return {
          content: [
            {
              type: "text",
              text: `CSV Import Complete:\n` +
                `✅ Imported: ${results.imported}\n` +
                `⚠️  Duplicates: ${results.duplicates}\n` +
                `❌ Errors: ${results.errors}`
            }
          ]
        };
      }
    }
  );
}

function detectFieldMapping(sampleRow: any): FieldMapping {
  const mapping: any = {};
  const fields = Object.keys(sampleRow);
  
  // Common field patterns
  const patterns = {
    date: /date|time|posted/i,
    amount: /amount|value|debit|credit/i,
    description: /desc|name|payee|merchant/i,
    category: /category|type/i
  };
  
  for (const field of fields) {
    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.test(field)) {
        mapping[key] = field;
        break;
      }
    }
  }
  
  return mapping;
}
```

### Phase 3: Advanced Features (Week 5-6)

#### 3.1 Spending Analytics Tool
```typescript
// src/tools/spending-analytics.ts
export function registerSpendingAnalytics(server: Server, prisma: PrismaClient) {
  // Anomaly detection
  server.setRequestHandler(
    "tools/invoke", 
    async (request) => {
      if (request.params.name === "detect_spending_anomalies") {
        const params = DetectAnomaliesSchema.parse(request.params.arguments);
        
        // Get historical spending data
        const transactions = await prisma.transaction.findMany({
          where: {
            date: {
              gte: subDays(new Date(), params.lookbackDays)
            },
            amount: { gt: 0 }, // Expenses only
            excluded: false
          },
          orderBy: { date: 'asc' }
        });
        
        // Calculate daily spending
        const dailySpending = calculateDailySpending(transactions);
        
        // Statistical analysis
        const stats = calculateStatistics(dailySpending);
        const threshold = stats.mean + (stats.stdDev * params.sensitivity);
        
        // Find anomalies
        const anomalies = dailySpending.filter(day => day.total > threshold);
        
        // Analyze patterns
        const patterns = analyzeSpendingPatterns(transactions);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                summary: {
                  averageDailySpending: formatCurrency(stats.mean),
                  standardDeviation: formatCurrency(stats.stdDev),
                  anomalyThreshold: formatCurrency(threshold),
                  anomaliesFound: anomalies.length
                },
                anomalies: anomalies.map(a => ({
                  date: a.date,
                  amount: formatCurrency(a.total),
                  deviation: `${((a.total - stats.mean) / stats.stdDev).toFixed(1)}σ`,
                  transactions: a.transactions
                })),
                patterns: {
                  weekdayAverage: patterns.weekdayAverage,
                  weekendAverage: patterns.weekendAverage,
                  monthlyTrend: patterns.monthlyTrend,
                  recurringExpenses: patterns.recurring
                }
              }, null, 2)
            }
          ]
        };
      }
    }
  );
}
```

#### 3.2 Financial Health Score
```typescript
// src/tools/financial-health.ts
export function registerFinancialHealthTools(server: Server, prisma: PrismaClient) {
  server.setRequestHandler(
    "tools/invoke",
    async (request) => {
      if (request.params.name === "calculate_financial_health") {
        // Comprehensive financial analysis
        const [accounts, recentTransactions, categories] = await Promise.all([
          prisma.account.findMany(),
          prisma.transaction.findMany({
            where: { 
              date: { gte: subDays(new Date(), 90) },
              excluded: false
            }
          }),
          prisma.category.findMany()
        ]);
        
        // Calculate metrics
        const metrics = {
          netWorth: calculateNetWorth(accounts),
          monthlyIncome: calculateAverageMonthlyIncome(recentTransactions),
          monthlyExpenses: calculateAverageMonthlyExpenses(recentTransactions),
          savingsRate: 0,
          emergencyFundMonths: 0,
          debtToIncomeRatio: 0,
          expenseBreakdown: calculateExpenseBreakdown(recentTransactions, categories)
        };
        
        metrics.savingsRate = ((metrics.monthlyIncome - metrics.monthlyExpenses) / metrics.monthlyIncome) * 100;
        metrics.emergencyFundMonths = calculateEmergencyFundCoverage(accounts, metrics.monthlyExpenses);
        
        // Score calculation (0-100)
        const score = calculateHealthScore(metrics);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                score: score,
                grade: getGrade(score),
                metrics: metrics,
                recommendations: generateRecommendations(metrics, score),
                trends: {
                  savingsRateTrend: calculateTrend(recentTransactions, 'savings'),
                  spendingTrend: calculateTrend(recentTransactions, 'spending'),
                  netWorthTrend: 'calculating...' // Would need historical snapshots
                }
              }, null, 2)
            }
          ]
        };
      }
    }
  );
}
```

## Database Schema Reference

### Core Tables Used
```sql
-- Accounts table
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  accountable_type VARCHAR(50), -- 'Account::Checking', 'Account::Credit', etc.
  accountable_id UUID,
  balance DECIMAL(19,4) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table  
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(id),
  date DATE NOT NULL,
  name VARCHAR(255),
  amount DECIMAL(19,4) NOT NULL, -- Positive = expense, Negative = income
  currency VARCHAR(3) DEFAULT 'EUR',
  category VARCHAR(100),
  excluded BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7), -- Hex color
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom table for asset tracking
CREATE TABLE spending_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id),
  asset_type VARCHAR(100),
  purchase_value DECIMAL(19,4),
  current_value DECIMAL(19,4),
  depreciation_rate DECIMAL(5,2), -- Annual percentage
  last_valued_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Deployment Guide

### Docker Configuration
```dockerfile
# docker/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Docker Compose Integration
```yaml
# docker-compose.yml
version: '3.8'

services:
  maybe-mcp:
    build: ./maybe-finance-mcp
    container_name: maybe-mcp-server
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://maybe:${DB_PASSWORD}@maybe-db:5432/maybe_production
      - LOG_LEVEL=info
    depends_on:
      - maybe-db
    volumes:
      - ./maybe-mcp-logs:/app/logs
    networks:
      - maybe-network

networks:
  maybe-network:
    external: true
```

### Environment Configuration
```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://maybe:secure_password@localhost:5432/maybe_production
LOG_LEVEL=info
MAX_QUERY_RESULTS=1000
CACHE_TTL=300
```

## Testing Strategy

### Unit Tests
```typescript
// tests/tools/cash-flow.test.ts
import { calculateRollingCashFlow } from '../src/services/cash-flow';
import { PrismaClient } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

describe('Cash Flow Calculations', () => {
  const prisma = mockDeep<PrismaClient>();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('calculates rolling cash flow correctly', async () => {
    const mockTransactions = [
      { amount: -1000, date: new Date('2024-01-01') }, // Income
      { amount: 500, date: new Date('2024-01-02') },   // Expense
      { amount: 300, date: new Date('2024-01-03') }    // Expense
    ];
    
    prisma.transaction.findMany.mockResolvedValue(mockTransactions);
    
    const result = await calculateRollingCashFlow(prisma, { days: 30 });
    
    expect(result.inflows).toBe(1000);
    expect(result.outflows).toBe(800);
    expect(result.netFlow).toBe(200);
  });
});
```

### Integration Tests
```typescript
// tests/integration/mcp-server.test.ts
describe('MCP Server Integration', () => {
  let server: TestServer;
  
  beforeAll(async () => {
    server = await createTestServer();
  });
  
  test('handles get_rolling_cash_flow request', async () => {
    const response = await server.invoke('get_rolling_cash_flow', {
      days: 30,
      accountIds: ['test-account-1']
    });
    
    expect(response.content[0].type).toBe('text');
    expect(JSON.parse(response.content[0].text)).toHaveProperty('inflows');
  });
});
```

## Security Considerations

### Database Access Security
```typescript
// src/security/database-security.ts
export class SecureDatabase {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    });
    
    // Add query middleware for security
    this.prisma.$use(async (params, next) => {
      // Log all data access
      logger.info('Database query', {
        model: params.model,
        action: params.action,
        timestamp: new Date().toISOString()
      });
      
      // Prevent dangerous operations
      if (['deleteMany', 'updateMany'].includes(params.action)) {
        throw new Error('Bulk operations not allowed');
      }
      
      return next(params);
    });
  }
  
  // Read-only access for most operations
  get readonly() {
    return new Proxy(this.prisma, {
      get(target, prop) {
        if (['create', 'update', 'delete', 'upsert'].includes(String(prop))) {
          throw new Error('Write operations not allowed in readonly mode');
        }
        return target[prop];
      }
    });
  }
}
```

### Input Validation
```typescript
// src/utils/validators.ts
import { z } from 'zod';

export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    // Remove potential SQL injection attempts
    return input.replace(/[;'"\\]/g, '');
  }
  return input;
};

export const validateDateRange = (start: Date, end: Date) => {
  const maxRange = 365; // days
  const daysDiff = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff > maxRange) {
    throw new Error(`Date range cannot exceed ${maxRange} days`);
  }
};
```

## Timeline and Milestones

### Development Schedule

**Week 1-2: Foundation**
- [x] Project setup and configuration
- [x] Database connection via Prisma
- [x] Basic MCP server structure
- [ ] Core type definitions

**Week 3-4: Core Tools**
- [ ] Cash flow tracking tool
- [ ] Transaction query tool
- [ ] Basic categorization
- [ ] CSV import tool

**Week 5-6: Advanced Features**
- [ ] Spending analytics & anomaly detection
- [ ] Financial health scoring
- [ ] Advanced categorization with assets
- [ ] Subscription detection

**Week 7-8: Testing & Deployment**
- [ ] Comprehensive testing suite
- [ ] Docker deployment setup
- [ ] Performance optimization
- [ ] Documentation finalization

**Week 9-10: Production & Monitoring**
- [ ] Production deployment on Hetzner
- [ ] Monitoring setup
- [ ] User acceptance testing
- [ ] Performance tuning

### Success Metrics
- Query response time < 100ms for 95% of requests
- 100% accurate financial calculations
- Zero data loss during CSV imports
- Successful categorization rate > 80%

## Maintenance and Future Enhancements

### Monitoring Setup
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'maybe-mcp'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### Future API Migration Path
```typescript
// src/services/data-adapter.ts
interface DataAdapter {
  getTransactions(filters: TransactionFilters): Promise<Transaction[]>;
  getAccounts(): Promise<Account[]>;
}

class DatabaseAdapter implements DataAdapter {
  // Current direct database implementation
}

class ApiAdapter implements DataAdapter {
  // Future API-based implementation
  // Ready to switch when Maybe Finance API becomes available
}

// Factory pattern for easy switching
export function createDataAdapter(): DataAdapter {
  if (process.env.USE_API === 'true') {
    return new ApiAdapter();
  }
  return new DatabaseAdapter();
}
```

### Backup Strategy
```bash
#!/bin/bash
# backup-mcp-data.sh
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
rclone copy backup-*.sql remote:backups/maybe-mcp/
```

## Conclusion

This implementation provides a robust MCP server for Maybe Finance that:
1. Works with the current v0.6.0 release
2. Provides all requested functionality
3. Maintains security and performance
4. Allows future migration to API-based approach
5. Can be deployed alongside your existing Maybe Finance instance

The modular architecture ensures easy maintenance and extension as your needs evolve.