# Maybe Finance MCP Project Context

## Project Status Overview
**Date**: 2025-01-08
**Current State**: Initial implementation exists but needs significant fixes

## Key Information
- **Project Type**: Model Context Protocol (MCP) server for Maybe Finance
- **Architecture**: TypeScript-based MCP server connecting to Maybe Finance API
- **API Endpoint**: https://maybe.lapushinskii.com/api/v1
- **Required Features**: Account management, transaction tracking, cash flow analysis, categorization

## Current Issues Identified

### 1. Missing Environment Configuration
- No `.env` file exists (only `.env.example`)
- API key needs to be configured
- Database connection not implemented (API-only approach currently)

### 2. Incomplete Implementation
- Transaction creation tool exists but has date parsing issues
- No CSV import functionality implemented
- Missing "spending but assets" categorization logic
- No anomaly detection or spending patterns analysis
- Limited cash flow analytics

### 3. Build/Configuration Issues
- TypeScript configuration present but needs verification
- No tests implemented despite Jest being configured
- Missing type definitions for some API responses
- ESM module configuration may have issues

### 4. Missing Core Features from Requirements
- No rolling cash flow tracking with configurable periods
- No automatic categorization rules
- No subscription detection
- No spending anomaly detection
- No financial health scoring

### 5. API Integration Limitations
- Current implementation assumes specific API structure
- Error handling needs improvement
- No retry logic or rate limiting
- Missing API endpoint documentation validation

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
1. **Environment Setup**: Create proper .env configuration
2. **Fix Date Parsing**: Transaction creation date format issues
3. **Implement Core Features**: Rolling cash flow, categorization
4. **Add Tests**: Comprehensive test coverage
5. **Error Handling**: Improve API error handling and validation
6. **Documentation**: Update with actual API responses

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

## Features Needing Implementation
- CSV import with duplicate detection
- Advanced categorization with custom rules
- Spending pattern analysis
- Financial health scoring
- Subscription detection
- Asset tracking for high-value purchases
- Anomaly detection in spending

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

## User Requirements Not Yet Addressed
1. Track inflows/outflows on rolling basis (partial)
2. Monitor spending patterns (not implemented)
3. Special categorization (partial):
   - Required purchases (groceries, utilities)
   - Discretionary spending
   - Subscriptions
   - "Spending but assets" (not implemented)
4. CSV import automation (not implemented)
5. Self-hosted deployment guide (partial)

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