# Maybe Finance MCP Project Context

## Project Status Overview
**Date**: 2025-01-08
**Current State**: Major fixes implemented, project now functional with enhanced features

## Key Information
- **Project Type**: Model Context Protocol (MCP) server for Maybe Finance
- **Architecture**: TypeScript-based MCP server connecting to Maybe Finance API
- **API Endpoint**: https://maybe.lapushinskii.com/api/v1
- **Required Features**: Account management, transaction tracking, cash flow analysis, categorization

## Issues Fixed (2025-01-08)

### ✅ 1. Environment Configuration
- API-only approach maintained (no database needed)
- Enhanced API client configuration
- Proper error handling for missing API keys

### ✅ 2. Core Functionality Fixed
- **Date Parsing**: Robust multi-format date parser supporting DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, and more
- **CSV Import**: Full implementation with smart field detection and duplicate checking
- **Categorization**: Advanced engine with "spending but assets" logic and Dutch merchant support
- **Cash Flow**: Enhanced analytics with insights, account filtering, and transfer exclusion
- **Amount Parsing**: Handles European and US formats, negative amounts, and various currencies

### ✅ 3. Technical Improvements
- **ID Validation**: Replaced strict UUID with flexible ID format
- **API Client**: Added retry logic, rate limiting (100/min), and 5-minute caching
- **Error Handling**: Comprehensive error messages and validation
- **Currency Formatting**: Proper European locale for EUR

### ✅ 4. New Features Implemented
- **Auto-categorization**: Smart rules engine with pattern matching
- **Subscription Detection**: Identifies recurring payments with confidence scoring
- **CSV Import**: Analyzes structure, detects columns, handles duplicates
- **Custom Rules**: Add/remove categorization rules dynamically
- **Spending Insights**: Weekend spending, large transactions, trends

### ✅ 5. API Integration Enhanced
- **Retry Logic**: 3 retries with exponential backoff
- **Rate Limiting**: Prevents API overload
- **Caching**: Reduces redundant API calls
- **Better Errors**: Detailed error messages for all scenarios

## Project Structure
```
maybe-mcp/
├── src/
│   ├── index.ts          # Entry point
│   ├── services/
│   │   └── api-client.ts # API client implementation
│   ├── tools/            # MCP tools
│   │   ├── accounts.ts
│   │   ├── cash-flow.ts
│   │   ├── categories.ts
│   │   ├── index.ts
│   │   ├── transaction-management.ts
│   │   └── transactions.ts
│   └── utils/
│       ├── formatters.ts
│       ├── parsers.ts
│       └── validators.ts
├── CLAUDE.md            # Development directives
├── FEATURES.md          # Feature documentation
├── README.md            # User documentation
├── package.json         # Dependencies
└── tsconfig.json        # TypeScript config
```

## Dependencies
- @modelcontextprotocol/sdk: ^0.5.0
- axios: ^1.6.2
- date-fns: ^3.0.0
- papaparse: ^5.4.1
- zod: ^3.22.4

## Next Steps Priority
1. **Environment Setup**: Create .env file with API credentials
2. **Testing**: Run the server and verify all tools work
3. **Add Tests**: Implement comprehensive test suite
4. **Docker Setup**: Create deployment configuration
5. **Documentation**: Create user guide with examples
6. **Performance**: Monitor and optimize API usage

## API Endpoints Currently Used
- GET /accounts
- GET /accounts/:id
- GET /transactions
- GET /transactions/:id
- POST /transactions
- PUT /transactions/:id
- DELETE /transactions/:id
- GET /categories
- GET /chats (AI integration)
- POST /chats
- GET /usage

## Known Working Features
- Basic account listing
- Transaction queries with filters
- Category listing
- Basic transaction CRUD operations

## Features Successfully Implemented
- ✅ CSV import with duplicate detection
- ✅ Advanced categorization with custom rules
- ✅ Subscription detection with confidence scoring
- ✅ Asset tracking ("Spending but Assets" category)
- ✅ Basic spending insights and trends
- ✅ Transfer exclusion in cash flow
- ✅ Net worth calculation

## Features Still Pending
- ⏳ Full anomaly detection system
- ⏳ Financial health scoring
- ⏳ Comprehensive test suite
- ⏳ Advanced spending forecasts

## Technical Debt
- No error recovery mechanisms
- Missing input validation in some tools
- Hardcoded values that should be configurable
- No caching layer for API responses
- Missing performance optimizations

## Security Considerations
- API key stored in environment variables
- No request signing or additional auth
- Need to validate all user inputs
- Consider rate limiting implementation

## Testing Requirements
- Unit tests for all utilities
- Integration tests for API client
- MCP tool tests with mocked responses
- End-to-end testing with real API (staging)

## Deployment Considerations
- Need Docker configuration
- Process manager setup (PM2)
- Logging strategy
- Monitoring and alerting
- Backup procedures for configuration

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

## API Compatibility Notes
- Maybe Finance v0.6.0 (discontinued project)
- API documentation limited
- Need to validate actual API responses
- Consider implementing fallback mechanisms

## Development Environment
- Node.js 20+ required
- TypeScript 5.3.3
- Windows environment (C:\Users\matvei)
- Git repository initialized