# Maybe Finance MCP Server

A Model Context Protocol (MCP) server that connects Claude Desktop to your self-hosted Maybe Finance instance, enabling natural language financial queries, transaction management, and advanced analytics.

## 🚀 Features

### Complete Financial Management
- **Account Management**: Query account balances and information
- **Transaction CRUD**: Create, read, update, and delete transactions
- **CSV Import**: Bulk import transactions from bank statements
- **Smart Search**: Find transactions with advanced filtering

### Intelligent Categorization
- **Auto-Categorization**: AI-powered transaction categorization with 17 built-in rules
- **Custom Categories**: Create and manage your own categories
- **Special Categories**:
  - Required Purchases (groceries, utilities, etc.)
  - Discretionary Spending
  - Subscriptions
  - Spending but Assets (investments, high-value items)

### Advanced Analytics
- **Cash Flow Analysis**: Track inflows/outflows with insights
- **Rolling Metrics**: Analyze trends over custom time periods
- **Forecasting**: Predict future cash flow with confidence intervals
- **Spending Breakdowns**: Detailed category-based analytics

## Prerequisites

- Node.js 20 or later
- Maybe Finance API key (from your self-hosted instance)
- Claude Desktop installed on your computer

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/maybe-finance-mcp.git
cd maybe-finance-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create a .env file
cp .env.example .env

# Edit .env with your API credentials
API_BASE_URL=https://your-maybe-instance.com/api/v1
API_KEY=your-api-key-here
```

4. Build the project:
```bash
npm run build
```

## Configuration

### Claude Desktop Setup

1. Open Claude Desktop settings
2. Navigate to Developer → Model Context Protocol
3. Add the MCP server configuration:

```json
{
  "mcpServers": {
    "maybe-finance": {
      "command": "node",
      "args": ["C:\\path\\to\\maybe-finance-mcp\\dist\\index.js"],
      "env": {
        "API_BASE_URL": "https://your-maybe-instance.com/api/v1",
        "API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### API Configuration

The MCP server connects to your Maybe Finance instance via its REST API:

```bash
# Your Maybe Finance API endpoint
API_BASE_URL=https://your-maybe-instance.com/api/v1

# Your API key (get this from your Maybe Finance settings)
API_KEY=your-api-key-here
```

The API key should be kept secure and never committed to version control.

## 📋 Complete Tool Reference

### Account Management Tools

#### `get_accounts`
List all accounts with balances and net worth calculation.
- **Parameters**: 
  - `includeBalance` (boolean): Include current balance (default: true)
  - `groupByType` (boolean): Group accounts by type (default: false)

#### `get_account_balance`
Get detailed balance information for a specific account.
- **Parameters**:
  - `accountId` (string, required): Account ID

### Transaction Management Tools

#### `get_transactions`
Retrieve transactions with powerful filtering options.
- **Parameters**:
  - `accountId` (string): Filter by account
  - `startDate` (string): Start date (ISO format)
  - `endDate` (string): End date (ISO format)
  - `category` (string): Filter by category
  - `limit` (number): Maximum results (default: 100)
  - `offset` (number): Pagination offset

#### `search_transactions`
Search transactions by text query.
- **Parameters**:
  - `query` (string, required): Search query
  - `accountId` (string): Limit to specific account
  - `limit` (number): Maximum results

#### `create_transaction`
Create a new transaction.
- **Parameters**:
  - `accountId` (string, required): Account ID
  - `amount` (string, required): Amount (negative for expenses)
  - `date` (string, required): Transaction date
  - `name` (string, required): Transaction name/description
  - `category` (string): Category name
  - `merchant` (string): Merchant name
  - `tags` (array): Transaction tags
  - `notes` (string): Additional notes

#### `update_transaction`
Update an existing transaction.
- **Parameters**:
  - `transactionId` (string, required): Transaction ID
  - `category` (string): New category
  - `excluded` (boolean): Exclude from reports
  - `name` (string): New name
  - `amount` (string): New amount
  - `date` (string): New date
  - `merchant` (string): New merchant
  - `notes` (string): New notes
  - `tags` (array): New tags

#### `categorize_transaction`
Categorize a single transaction.
- **Parameters**:
  - `transactionId` (string, required): Transaction ID
  - `category` (string, required): Category name

#### `bulk_categorize`
Categorize multiple transactions at once.
- **Parameters**:
  - `transactionIds` (array, required): Array of transaction IDs
  - `category` (string, required): Category name

### Cash Flow Analysis Tools

#### `get_cash_flow`
Analyze cash flow for a specific period.
- **Parameters**:
  - `days` (number): Number of days to analyze (default: 30)
  - `accountIds` (array): Specific accounts to include
  - `includeForecasted` (boolean): Include forecasted data

#### `get_rolling_cash_flow`
Get rolling cash flow metrics over time.
- **Parameters**:
  - `period` (string): Period type (week/month/quarter)
  - `periods` (number): Number of periods (default: 6)
  - `accountIds` (array): Specific accounts to include

#### `forecast_cash_flow`
Predict future cash flow with confidence intervals.
- **Parameters**:
  - `days` (number, required): Days to forecast
  - `includeSeasonality` (boolean): Consider seasonal patterns
  - `confidenceLevel` (number): Confidence level (0.8-0.99)

### Category Management Tools

#### `get_categories`
List all available categories including special categories.
- **Parameters**: None

#### `create_category`
Create a custom category.
- **Parameters**:
  - `name` (string, required): Category name
  - `parentCategory` (string): Parent category for hierarchy
  - `color` (string): Hex color code
  - `icon` (string): Icon identifier

#### `get_spending_breakdown`
Analyze spending by category.
- **Parameters**:
  - `days` (number): Analysis period (default: 30)
  - `includeAssets` (boolean): Include asset purchases

### Import/Export Tools

#### `import_csv`
Import transactions from CSV file.
- **Parameters**:
  - `accountId` (string, required): Target account ID
  - `csvContent` (string, required): CSV content
  - `encoding` (string): base64 or utf8 (default: utf8)
  - `fieldMapping` (object): Custom field mapping
  - `dateFormat` (string): Date format in CSV
  - `skipDuplicates` (boolean): Skip duplicate detection
  - `autoCategarize` (boolean): Auto-categorize imports
  - `dryRun` (boolean): Preview without importing

#### `analyze_csv`
Analyze CSV structure before import.
- **Parameters**:
  - `csvContent` (string, required): CSV content
  - `encoding` (string): base64 or utf8
  - `sampleRows` (number): Rows to analyze (default: 5)

### Automation Tools

#### `auto_categorize_all`
Automatically categorize all uncategorized transactions.
- **Parameters**:
  - `dryRun` (boolean): Preview changes (default: true)
  - `startDate` (string): Process from date
  - `overwriteExisting` (boolean): Re-categorize existing

#### `get_categorization_rules`
View all active categorization rules.
- **Parameters**: None

## 💡 Example Usage in Claude

### Basic Queries
```
"What's my current account balance?"
"Show me all transactions from last month"
"How much did I spend on groceries this week?"
```

### Transaction Management
```
"Create a transaction for $50 coffee shop expense today"
"Update the Netflix transaction to the Subscriptions category"
"Import my bank statement CSV file"
```

### Analytics & Insights
```
"Show me my cash flow for the last 30 days"
"What are my biggest expense categories?"
"Forecast my cash flow for the next 2 weeks"
"Give me a spending breakdown by category"
```

### Automation
```
"Auto-categorize all my transactions"
"Show me the categorization rules"
"Bulk categorize all coffee transactions as Dining"
```

## 🔧 Development

### Run in Development Mode
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Lint Code
```bash
npm run lint
```

## 🔒 Security Notes

- The MCP server runs locally on your machine
- API credentials are stored in your local environment
- All communication with Maybe Finance is over HTTPS
- The API key provides scoped access to your financial data
- No data is sent to third-party servers
- Sensitive data is never logged or exposed

## 🐛 Troubleshooting

### Connection Issues
- Verify your API endpoint URL is correct
- Check that your API key is valid
- Ensure your Maybe Finance instance is accessible
- Check firewall/proxy settings

### Authentication Errors
- Regenerate your API key in Maybe Finance settings
- Check the API key is correctly set in environment variables
- Verify the API key has necessary permissions

### Tool Errors
- Ensure account IDs are valid UUIDs
- Check date formats (ISO 8601 preferred)
- Verify category names match exactly
- Check transaction amounts are properly formatted

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- Built for [Maybe Finance](https://maybe.co) - Open source personal finance app
- Powered by [Model Context Protocol](https://github.com/anthropics/mcp)
- Designed for use with [Claude Desktop](https://claude.ai)