# Maybe Finance MCP - Current Context

## Project Status: ✅ FULLY OPERATIONAL

This is a Model Context Protocol (MCP) server that connects Claude Desktop to your self-hosted Maybe Finance instance. All critical issues have been fixed and the system is fully functional with 17 tools.

## Recent Changes (Fixed)
1. **Tool Registration Architecture** - Fixed issue where only 3 tools were visible. Now all 17 tools are properly registered.
2. **Date Parsing** - Supports 15+ date formats including European (DD-MM-YYYY)
3. **Amount Parsing** - Handles both European (€1.234,56) and US ($1,234.56) formats
4. **API Client** - Enhanced with retry logic, rate limiting, and caching
5. **CSV Import** - Full implementation with duplicate detection
6. **Categorization** - Smart engine with 50+ Dutch merchant patterns

## Architecture Overview

### Core Services
- **EnhancedMaybeFinanceAPI** (`src/services/enhanced-api-client.ts`) - Advanced API client with retry, caching, rate limiting
- **CategorizationEngine** (`src/services/categorization-engine.ts`) - Smart categorization with pattern matching
- **CSVProcessor** (`src/services/csv-processor.ts`) - CSV parsing and field detection

### Utilities
- **Date Utils** (`src/utils/date-utils.ts`) - Comprehensive date parsing
- **Parsers** (`src/utils/parsers.ts`) - Amount and currency parsing
- **Validators** (`src/utils/validators.ts`) - Zod schemas for validation
- **Formatters** (`src/utils/formatters.ts`) - Currency and date formatting

### Tools (17 Total)
All tools are defined in `src/tools/all-tools.ts` and handled by their respective handlers:

1. **Account Management** (`handleAccountTools`)
   - get_accounts - List all accounts with balances
   - get_account_balance - Get specific account balance

2. **Transaction Queries** (`handleTransactionTools`)
   - get_transactions - Get transactions with filters
   - search_transactions - Text search
   - get_spending_breakdown - Category analysis

3. **Transaction Management** (`handleTransactionManagementTools`)
   - create_transaction - Create new
   - update_transaction - Update existing
   - categorize_transaction - Quick categorize
   - bulk_categorize - Bulk operations

4. **Cash Flow Analytics** (`handleCashFlowTools`)
   - get_cash_flow - Period analysis
   - get_rolling_cash_flow - Rolling windows
   - forecast_cash_flow - ML forecasting

5. **Category Management** (`handleCategoryTools`)
   - get_categories - List categories
   - create_category - Create new

6. **Import/Export** (`handleCSVImportTools`)
   - import_csv - Import from CSV
   - analyze_csv - Preview structure

7. **Automation** (`handleAutoCategorization`)
   - auto_categorize_all - Bulk auto-categorize
   - get_categorization_rules - Manage rules

## Special Features

### Dutch Banking Support
- Recognizes 50+ Dutch merchants (Albert Heijn, HEMA, Jumbo, etc.)
- Handles European date formats (DD-MM-YYYY)
- Parses European amounts (€1.234,56)

### Financial Planning Categories
- **Required Purchases** - Essential spending
- **Discretionary Spending** - Optional expenses
- **Subscriptions** - Recurring services
- **Spending but Assets** - Asset purchases

### Performance Features
- Request caching (5-minute TTL)
- Rate limiting (100 req/min)
- Retry logic (3 attempts with backoff)
- Batch processing for imports

## Configuration

### Environment Variables
```bash
API_BASE_URL=https://maybe.lapushinskii.com/api/v1
API_KEY=your-api-key-here
```

### Claude Desktop Config
Add to `claude_desktop_config.json`:
```json
{
  "maybe-finance": {
    "command": "node",
    "args": ["path/to/maybe-mcp/dist/index.js"],
    "env": {
      "API_BASE_URL": "your-api-url",
      "API_KEY": "your-api-key"
    }
  }
}
```

## Build & Run
```bash
npm install
npm run build
npm start
```

## Known Issues
- None currently. All tools working properly.

## Pending Enhancements
- Comprehensive test suite
- Anomaly detection system
- Multi-currency support
- Budget tracking features
- Investment portfolio analysis

## User Requirements Status
1. ✅ Track inflows/outflows on rolling basis - COMPLETE with insights
2. ✅ Monitor spending patterns - Subscription detection and trend analysis
3. ✅ Special categorization - FULLY IMPLEMENTED:
   - ✅ Required purchases (groceries, utilities, rent, insurance)
   - ✅ Discretionary spending (dining, entertainment, shopping)
   - ✅ Subscriptions (streaming, software, gym)
   - ✅ "Spending but assets" (electronics >€100, furniture, tools)
4. ✅ CSV import automation - Smart field detection and batch import
5. ⏳ Self-hosted deployment guide - Needs Docker configuration

## Project Structure
```
maybe-mcp/
├── src/
│   ├── index.ts                    # Entry point with tool registration
│   ├── services/
│   │   ├── api-client.ts          # Basic API client
│   │   ├── enhanced-api-client.ts # Enhanced with retry/cache
│   │   ├── categorization-engine.ts # Smart categorization
│   │   └── csv-processor.ts      # CSV parsing
│   ├── tools/                     # MCP tool implementations
│   │   ├── accounts.ts
│   │   ├── all-tools.ts          # Centralized tool definitions
│   │   ├── auto-categorization.ts
│   │   ├── cash-flow.ts
│   │   ├── categories.ts
│   │   ├── csv-import.ts
│   │   ├── index.ts
│   │   ├── transaction-management.ts
│   │   └── transactions.ts
│   └── utils/
│       ├── date-utils.ts          # Date parsing (15+ formats)
│       ├── formatters.ts
│       ├── parsers.ts             # Amount parsing
│       └── validators.ts
├── CLAUDE-HISTORY.md              # Development history
├── CLAUDE.md                      # Development directives
├── CONTEXT.md                     # This file
├── FEATURES.md                    # Feature documentation
├── README.md                      # User documentation
├── package.json                   # Dependencies
└── tsconfig.json                  # TypeScript config
```

## Dependencies
- @modelcontextprotocol/sdk: ^0.5.0
- axios: ^1.6.2
- date-fns: ^3.0.0
- papaparse: ^5.4.1
- zod: ^3.22.4