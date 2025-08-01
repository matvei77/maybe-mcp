# Maybe Finance MCP Server - Available Features

## Complete List of Tools

### 📊 Account Management
- **get_accounts** - List all accounts with balances
- **get_account_balance** - Get specific account balance

### 💸 Transaction Queries
- **get_transactions** - Advanced transaction search with filters:
  - Date range filtering
  - Category filtering
  - Merchant filtering
  - Tag-based filtering
  - Amount range filtering
  - Account filtering
- **search_transactions** - Full-text search across transaction names, notes, and merchants

### ✏️ Transaction Management (NEW!)
- **create_transaction** - Create manual transaction entries
  - Supports DD-MM-YYYY date format
  - Add categories, merchants, notes, and tags
- **update_transaction** - Edit existing transactions
  - Update any field including amount, date, category
  - Mark transactions as excluded
- **delete_transaction** - Remove incorrect entries

### 📈 Financial Analytics
- **get_rolling_cash_flow** - Analyze cash flow for any period
  - Inflows vs outflows
  - Daily averages
  - Category breakdown
- **get_cash_flow_trend** - Track trends over time
  - Day/week/month periods
  - Automatic trend detection

### 🏷️ Categorization
- **get_categories** - List all categories including special ones:
  - Required Purchases
  - Discretionary Spending
  - Subscriptions
  - Spending but Assets
- **categorize_transactions** - Assign categories to transactions
- **get_spending_breakdown** - See spending by category with percentages

## Usage Examples

### Creating a Transaction
```
"Create a transaction for €50 groceries at Albert Heijn yesterday"
```

### Advanced Search
```
"Find all transactions at coffee shops this month"
"Show me transactions tagged as 'business' over €100"
```

### Financial Analysis
```
"What's my cash flow for the last 30 days?"
"Show me spending trends for the past 6 months"
"Break down my spending by category"
```

### Transaction Management
```
"Update transaction 123 to category 'Groceries'"
"Delete that duplicate transaction"
"Exclude this transaction from reports"
```

## API Capabilities Not Yet Implemented

Based on the Maybe Finance API, these features could be added:
- AI Chat integration for financial conversations
- Usage tracking and API limits
- Account state management
- Transfer detection
- Recurring transaction identification
- Budget tracking
- Financial health scoring

## Configuration

The server connects to your Maybe Finance instance at:
- API URL: https://maybe.lapushinskii.com/api/v1
- Authentication: API Key in headers

All tools support the actual Maybe Finance data model and work with your real financial data.