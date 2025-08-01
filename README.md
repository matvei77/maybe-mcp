# Maybe Finance MCP Server

A Model Context Protocol (MCP) server that connects Claude Desktop to your self-hosted Maybe Finance instance, enabling natural language financial queries and analysis.

## Features

- **Account Management**: Query account balances and information
- **Transaction Search**: Find and filter transactions with various criteria
- **Cash Flow Analysis**: Track inflows/outflows on a rolling basis
- **Smart Categorization**: Automatically categorize transactions into:
  - Required Purchases (groceries, utilities, etc.)
  - Discretionary Spending
  - Subscriptions
  - Spending but Assets (high-value purchases that retain value)
- **Spending Analytics**: Get breakdowns and trends of your spending patterns

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
API_BASE_URL=https://maybe.lapushinskii.com/api/v1
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
        "API_BASE_URL": "https://maybe.lapushinskii.com/api/v1",
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
API_BASE_URL=https://maybe.lapushinskii.com/api/v1

# Your API key (get this from your Maybe Finance settings)
API_KEY=your-api-key-here
```

The API key should be kept secure and never committed to version control.

## Available Tools

Once configured, you can use these commands in Claude:

### Account Tools
- `get_accounts` - List all accounts with balances
- `get_account_balance` - Get balance for a specific account

### Transaction Tools
- `get_transactions` - Search transactions with filters (date range, category, amount)
- `search_transactions` - Find transactions by name/description

### Cash Flow Tools
- `get_rolling_cash_flow` - Analyze cash flow for the last N days
- `get_cash_flow_trend` - View cash flow trends over multiple periods

### Category Tools
- `get_categories` - List all available categories
- `categorize_transactions` - Manually categorize transactions
- `auto_categorize` - Automatically categorize based on patterns
- `get_spending_breakdown` - Get spending breakdown by category

## Example Usage in Claude

```
"Show me my cash flow for the last 30 days"
"What are my biggest expenses this month?"
"Categorize my recent transactions"
"How much am I spending on subscriptions?"
"Show me spending trends for the last 6 months"
```

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Security Notes

- The MCP server runs locally on your machine
- API credentials are stored in your local environment
- All communication with Maybe Finance is over HTTPS
- The API key provides scoped access to your financial data
- No data is sent to third-party servers

## Troubleshooting

### Connection Issues
- Verify your API endpoint URL is correct
- Check that your API key is valid
- Ensure your Maybe Finance instance is accessible

### Authentication Errors
- Regenerate your API key in Maybe Finance settings
- Check the API key is correctly set in environment variables
- Verify the API key has necessary permissions

## License

MIT