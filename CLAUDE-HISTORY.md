# Maybe Finance MCP Development History

## Initial State
The project started as a broken Maybe Finance MCP (Model Context Protocol) server with multiple critical issues:
- UUID validation too restrictive
- Date parsing only accepting YYYY-MM-DD format
- No European banking format support
- Missing features (CSV import, categorization, analytics)
- Basic error handling

## Phase 1: Deep Analysis and Planning

### Critical Issues Identified:
1. **Date Parsing Failures**
   - Only accepted YYYY-MM-DD format
   - European users couldn't enter DD-MM-YYYY dates
   - Transaction creation failing due to date format

2. **ID Validation Too Strict**
   - Used `z.string().uuid()` which was too restrictive
   - Maybe Finance API uses various ID formats

3. **Amount Parsing Issues**
   - Couldn't handle European formats (€1.234,56)
   - No support for currency symbols

4. **Missing Core Features**
   - No CSV import functionality
   - No auto-categorization
   - No cash flow analytics
   - Basic API client without retry logic

## Phase 2: Core Fixes Implementation

### 1. Enhanced Date Parser (`src/utils/date-utils.ts`)
```typescript
// Now supports 15+ date formats including:
// DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, MMM DD YYYY, etc.
export function parseDate(dateStr: string): Date {
  // Comprehensive date parsing logic
}
```

### 2. Flexible ID Validation (`src/utils/validators.ts`)
```typescript
export const IdSchema = z.union([
  z.string().uuid(),
  z.string().regex(/^[a-zA-Z0-9_-]+$/),
  z.string().min(1)
]);
```

### 3. European Amount Parser (`src/utils/parsers.ts`)
```typescript
// Handles both European (1.234,56) and US (1,234.56) formats
export function parseAmount(amount: string | number): number {
  // Smart detection of decimal separator
}
```

## Phase 3: Advanced Features Implementation

### 1. Enhanced API Client (`src/services/enhanced-api-client.ts`)
- Retry logic with exponential backoff (3 retries)
- Rate limiting (100 requests/minute)
- Response caching with 5-minute TTL
- Concurrent request batching
- Proper error handling

### 2. Smart Categorization Engine (`src/services/categorization-engine.ts`)
- 50+ Dutch merchant patterns
- Special categories for financial planning:
  - Required Purchases
  - Discretionary Spending
  - Subscriptions
  - Spending but Assets
- Learning from user categorizations

### 3. CSV Import System (`src/tools/csv-import.ts`)
- Auto-detection of CSV structure
- Support for various bank formats
- Duplicate detection using MD5 hashing
- Field mapping with smart detection
- Batch import with progress tracking

### 4. Cash Flow Analytics (`src/tools/cash-flow.ts`)
- Rolling cash flow analysis (7d, 30d, 90d, 365d)
- Cash flow forecasting based on patterns
- Recurring transaction detection
- Income vs expense tracking

## Phase 4: Build and Integration Issues

### TypeScript Compilation Errors
Fixed 8 TypeScript errors:
- Unused imports removed
- Unused variables prefixed with `_`
- Changed `parseFloat` to `parseAmount` for proper handling

### Tool Registration Architecture Issue
**Problem**: Only 3 tools visible in Claude Desktop instead of 17
**Root Cause**: Each tool file was calling `server.setRequestHandler(ListToolsRequestSchema)` which overwrote previous registrations

**Solution**: Major architectural refactoring:
1. Created centralized `all-tools.ts` with all 17 tool definitions
2. Refactored all tool files from `registerXXXTools` to `handleXXXTools`
3. Single registration point in `index.ts` with proper dispatching

## Final Implementation Summary

### All 17 Tools Implemented:
1. **Account Tools** (2)
   - `get_accounts` - List all accounts with balances
   - `get_account_balance` - Get specific account balance

2. **Transaction Tools** (3)
   - `get_transactions` - Get transactions with filters
   - `search_transactions` - Text search across transactions
   - `get_spending_breakdown` - Spending analysis by category

3. **Transaction Management** (4)
   - `create_transaction` - Create new transactions
   - `update_transaction` - Update existing transactions
   - `categorize_transaction` - Quick categorization
   - `bulk_categorize` - Categorize multiple at once

4. **Cash Flow Tools** (3)
   - `get_cash_flow` - Period cash flow analysis
   - `get_rolling_cash_flow` - Rolling window analysis
   - `forecast_cash_flow` - ML-based forecasting

5. **Category Tools** (2)
   - `get_categories` - List all categories
   - `create_category` - Create new categories

6. **Import Tools** (2)
   - `import_csv` - Import transactions from CSV
   - `analyze_csv` - Preview CSV structure

7. **Automation Tools** (2)
   - `auto_categorize_all` - Bulk auto-categorization
   - `get_categorization_rules` - View/manage rules

### Key Features:
- ✅ Full European banking format support
- ✅ Dutch merchant recognition
- ✅ Smart categorization with learning
- ✅ Advanced date parsing (15+ formats)
- ✅ Retry logic and rate limiting
- ✅ Response caching for performance
- ✅ CSV import with duplicate detection
- ✅ Cash flow forecasting
- ✅ Special financial planning categories

## Configuration
The MCP server is configured in Claude Desktop's `claude_desktop_config.json`:
```json
{
  "maybe-finance": {
    "command": "node",
    "args": ["C:\\Users\\matvei\\maybe-mcp\\dist\\index.js"],
    "cwd": "C:\\Users\\matvei\\maybe-mcp",
    "env": {
      "API_BASE_URL": "https://maybe.lapushinskii.com/api/v1",
      "API_KEY": "your-api-key"
    }
  }
}
```

## Lessons Learned
1. MCP tool registration requires careful architecture to avoid handler conflicts
2. European users need specific date/amount format support
3. Financial tools benefit greatly from smart categorization
4. Caching and retry logic are essential for API reliability
5. Claude Desktop caches tool lists - restart required after changes

## Next Steps
- Add comprehensive test suite
- Implement anomaly detection system
- Create user documentation
- Add multi-currency support
- Implement budget tracking features