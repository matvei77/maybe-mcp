# Maybe Finance MCP - Technical Fix Implementation Plan

## Critical Issues Analysis & Solutions

### 1. UUID Validation Too Restrictive
**Problem**: All tools use `.uuid()` validation but Maybe Finance IDs might not be UUIDs
**Solution**: Replace with flexible string validation
```typescript
// Before:
accountId: z.string().uuid()
// After:
accountId: z.string().min(1).regex(/^[a-zA-Z0-9-_]+$/, "Invalid ID format")
```

### 2. Date Parsing Completely Broken
**Problem**: Only basic DD-MM-YYYY support, no validation, no other formats
**Solution**: Implement robust date parser with multiple format support
```typescript
import { parse, isValid, format } from 'date-fns';

function parseDate(dateStr: string): Date {
  const formats = [
    'dd-MM-yyyy', 'dd/MM/yyyy', 'dd.MM.yyyy',
    'yyyy-MM-dd', 'MM/dd/yyyy', 'dd MMM yyyy'
  ];
  
  for (const fmt of formats) {
    try {
      const date = parse(dateStr, fmt, new Date());
      if (isValid(date)) return date;
    } catch {}
  }
  throw new Error(`Invalid date format: ${dateStr}`);
}
```

### 3. Amount Parsing Failures
**Problem**: parseAmount doesn't handle negatives, multiple formats, or validation
**Solution**: Complete rewrite with proper handling
```typescript
function parseAmount(amount: string | number): number {
  if (typeof amount === 'number') return amount;
  
  // Remove currency symbols and normalize
  let cleaned = amount
    .replace(/[€$£¥₹]/g, '')
    .replace(/\s/g, '')
    .trim();
  
  // Handle negative amounts
  const isNegative = cleaned.includes('-') || cleaned.includes('(');
  cleaned = cleaned.replace(/[()-]/g, '');
  
  // Handle different decimal separators
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // 1,234.56 or 1.234,56
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Could be 1,234 or 1,23
    const parts = cleaned.split(',');
    if (parts[1]?.length === 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) throw new Error(`Invalid amount: ${amount}`);
  
  return isNegative ? -Math.abs(parsed) : parsed;
}
```

### 4. API Client Needs Complete Overhaul
**Problem**: No retry logic, no rate limiting, no caching, poor error handling
**Solution**: Implement robust API client with all features
```typescript
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { RateLimiter } from 'limiter';
import NodeCache from 'node-cache';

export class EnhancedMaybeFinanceAPI {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;
  private cache: NodeCache;
  
  constructor(baseURL: string, apiKey: string) {
    // Rate limiting: 100 requests per minute
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 100,
      interval: 'minute',
      fireImmediately: true
    });
    
    // Cache with 5 minute TTL
    this.cache = new NodeCache({ 
      stdTTL: 300,
      checkperiod: 60 
    });
    
    this.client = axios.create({
      baseURL,
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    
    // Retry logic with exponential backoff
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               error.response?.status === 429 || // Rate limit
               error.response?.status >= 500;    // Server errors
      },
      onRetry: (retryCount, error) => {
        console.log(`Retry attempt ${retryCount} for ${error.config?.url}`);
      }
    });
    
    // Request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      await this.rateLimiter.removeTokens(1);
      return config;
    });
    
    // Response interceptor for better errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const data = error.response?.data;
        
        let message = 'API request failed';
        if (status === 401) message = 'Invalid API key';
        else if (status === 403) message = 'Access forbidden';
        else if (status === 404) message = 'Resource not found';
        else if (status === 429) message = 'Rate limit exceeded';
        else if (data?.message) message = data.message;
        else if (error.message) message = error.message;
        
        throw new Error(`[${status || 'Network'}] ${message}`);
      }
    );
  }
  
  // Cached GET request helper
  private async cachedGet<T>(url: string, params?: any): Promise<T> {
    const cacheKey = `${url}:${JSON.stringify(params || {})}`;
    const cached = this.cache.get<T>(cacheKey);
    if (cached) return cached;
    
    const response = await this.client.get<T>(url, { params });
    this.cache.set(cacheKey, response.data);
    return response.data;
  }
}
```

### 5. Implement CSV Import Tool
**Problem**: Completely missing despite being a key requirement
**Solution**: Full implementation with smart field detection
```typescript
import Papa from 'papaparse';
import { createHash } from 'crypto';

interface CSVImportOptions {
  accountId: string;
  dateFormat?: string;
  amountColumn?: string;
  descriptionColumn?: string;
  categoryColumn?: string;
  skipDuplicates?: boolean;
  autoCategarize?: boolean;
}

export class CSVImporter {
  constructor(private api: MaybeFinanceAPI) {}
  
  async importCSV(csvContent: string, options: CSVImportOptions) {
    const results = {
      total: 0,
      imported: 0,
      duplicates: 0,
      errors: [] as any[],
      categorized: 0
    };
    
    // Parse CSV
    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase()
    });
    
    if (parsed.errors.length > 0) {
      throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
    }
    
    // Auto-detect columns if not specified
    const columns = this.detectColumns(parsed.data[0], options);
    
    // Process each row
    for (const [index, row] of parsed.data.entries()) {
      results.total++;
      
      try {
        // Extract transaction data
        const transaction = this.extractTransaction(row, columns, options);
        
        // Check for duplicates
        if (options.skipDuplicates) {
          const isDuplicate = await this.checkDuplicate(transaction, options.accountId);
          if (isDuplicate) {
            results.duplicates++;
            continue;
          }
        }
        
        // Auto-categorize if enabled
        if (options.autoCategarize && !transaction.category) {
          transaction.category = await this.autoCategarize(transaction);
          if (transaction.category) results.categorized++;
        }
        
        // Create transaction
        await this.api.createTransaction({
          ...transaction,
          accountId: options.accountId
        });
        
        results.imported++;
      } catch (error) {
        results.errors.push({
          row: index + 1,
          data: row,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  private detectColumns(sampleRow: any, options: CSVImportOptions) {
    const columns = {
      date: options.dateColumn,
      amount: options.amountColumn,
      description: options.descriptionColumn,
      category: options.categoryColumn
    };
    
    // Auto-detect if not specified
    if (!columns.date) {
      columns.date = this.findColumn(sampleRow, ['date', 'transaction date', 'posted', 'datum']);
    }
    if (!columns.amount) {
      columns.amount = this.findColumn(sampleRow, ['amount', 'value', 'bedrag', 'debit', 'credit']);
    }
    if (!columns.description) {
      columns.description = this.findColumn(sampleRow, ['description', 'desc', 'memo', 'payee', 'merchant', 'omschrijving']);
    }
    
    return columns;
  }
  
  private async checkDuplicate(transaction: any, accountId: string): Promise<boolean> {
    const hash = createHash('md5')
      .update(`${transaction.date}:${transaction.amount}:${transaction.name}`)
      .digest('hex');
    
    // Check recent transactions for matches
    const recent = await this.api.getTransactions({
      accountId,
      startDate: new Date(transaction.date - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(transaction.date + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    
    return recent.transactions.some(tx => {
      const txHash = createHash('md5')
        .update(`${tx.date}:${tx.amount}:${tx.name}`)
        .digest('hex');
      return txHash === hash;
    });
  }
}
```

### 6. Advanced Categorization System
**Problem**: No smart categorization, no pattern matching
**Solution**: Rule-based categorization engine
```typescript
interface CategorizationRule {
  id: string;
  name: string;
  category: string;
  priority: number;
  conditions: {
    merchantPatterns?: RegExp[];
    descriptionPatterns?: RegExp[];
    amountRange?: { min?: number; max?: number };
    dayOfWeek?: number[];
    dayOfMonth?: number[];
    isRecurring?: boolean;
  };
}

export class SmartCategorizer {
  private rules: CategorizationRule[] = [
    // Required Purchases
    {
      id: 'groceries',
      name: 'Grocery Stores',
      category: SPECIAL_CATEGORIES.REQUIRED_PURCHASES,
      priority: 90,
      conditions: {
        merchantPatterns: [/albert heijn/i, /jumbo/i, /lidl/i, /aldi/i, /plus/i, /coop/i],
        descriptionPatterns: [/supermar/i, /grocery/i, /food/i]
      }
    },
    {
      id: 'utilities',
      name: 'Utilities',
      category: SPECIAL_CATEGORIES.REQUIRED_PURCHASES,
      priority: 95,
      conditions: {
        merchantPatterns: [/eneco/i, /vattenfall/i, /essent/i, /gas/i, /electric/i, /water/i],
        descriptionPatterns: [/utility/i, /electric/i, /gas/i, /water/i, /heating/i]
      }
    },
    {
      id: 'rent',
      name: 'Rent/Mortgage',
      category: SPECIAL_CATEGORIES.REQUIRED_PURCHASES,
      priority: 100,
      conditions: {
        descriptionPatterns: [/rent/i, /huur/i, /mortgage/i, /hypotheek/i],
        dayOfMonth: [1, 2, 3, 28, 29, 30, 31],
        amountRange: { min: 500 }
      }
    },
    
    // Subscriptions
    {
      id: 'streaming',
      name: 'Streaming Services',
      category: SPECIAL_CATEGORIES.SUBSCRIPTIONS,
      priority: 80,
      conditions: {
        merchantPatterns: [/netflix/i, /spotify/i, /disney/i, /hbo/i, /amazon prime/i],
        isRecurring: true
      }
    },
    {
      id: 'telecom',
      name: 'Phone/Internet',
      category: SPECIAL_CATEGORIES.SUBSCRIPTIONS,
      priority: 85,
      conditions: {
        merchantPatterns: [/t-mobile/i, /vodafone/i, /kpn/i, /ziggo/i],
        isRecurring: true
      }
    },
    
    // Discretionary
    {
      id: 'dining',
      name: 'Restaurants',
      category: SPECIAL_CATEGORIES.DISCRETIONARY,
      priority: 60,
      conditions: {
        merchantPatterns: [/restaurant/i, /cafe/i, /bar/i, /pizza/i, /sushi/i],
        descriptionPatterns: [/lunch/i, /dinner/i, /food/i]
      }
    },
    {
      id: 'entertainment',
      name: 'Entertainment',
      category: SPECIAL_CATEGORIES.DISCRETIONARY,
      priority: 50,
      conditions: {
        merchantPatterns: [/cinema/i, /theater/i, /concert/i, /museum/i],
        descriptionPatterns: [/ticket/i, /entertainment/i]
      }
    },
    
    // Assets
    {
      id: 'electronics',
      name: 'Electronics',
      category: SPECIAL_CATEGORIES.SPENDING_BUT_ASSETS,
      priority: 70,
      conditions: {
        merchantPatterns: [/mediamarkt/i, /coolblue/i, /apple/i, /samsung/i],
        descriptionPatterns: [/laptop/i, /computer/i, /phone/i, /tv/i, /monitor/i],
        amountRange: { min: 200 }
      }
    },
    {
      id: 'furniture',
      name: 'Furniture',
      category: SPECIAL_CATEGORIES.SPENDING_BUT_ASSETS,
      priority: 70,
      conditions: {
        merchantPatterns: [/ikea/i, /leen bakker/i],
        descriptionPatterns: [/furniture/i, /desk/i, /chair/i, /table/i],
        amountRange: { min: 100 }
      }
    }
  ];
  
  async categorize(transaction: any): Promise<string | null> {
    const amount = Math.abs(parseAmount(transaction.amount));
    const merchant = transaction.merchant?.toLowerCase() || '';
    const description = transaction.name?.toLowerCase() || '';
    const date = new Date(transaction.date);
    
    // Sort rules by priority
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      if (this.matchesRule(transaction, rule, { amount, merchant, description, date })) {
        return rule.category;
      }
    }
    
    return null;
  }
  
  private matchesRule(
    transaction: any, 
    rule: CategorizationRule,
    parsed: { amount: number; merchant: string; description: string; date: Date }
  ): boolean {
    const { conditions } = rule;
    
    // Check merchant patterns
    if (conditions.merchantPatterns?.length) {
      const matches = conditions.merchantPatterns.some(pattern => 
        pattern.test(parsed.merchant)
      );
      if (!matches) return false;
    }
    
    // Check description patterns
    if (conditions.descriptionPatterns?.length) {
      const matches = conditions.descriptionPatterns.some(pattern => 
        pattern.test(parsed.description)
      );
      if (!matches) return false;
    }
    
    // Check amount range
    if (conditions.amountRange) {
      const { min, max } = conditions.amountRange;
      if (min !== undefined && parsed.amount < min) return false;
      if (max !== undefined && parsed.amount > max) return false;
    }
    
    // Check day of week
    if (conditions.dayOfWeek?.length) {
      if (!conditions.dayOfWeek.includes(parsed.date.getDay())) return false;
    }
    
    // Check day of month
    if (conditions.dayOfMonth?.length) {
      if (!conditions.dayOfMonth.includes(parsed.date.getDate())) return false;
    }
    
    return true;
  }
  
  async detectSubscriptions(transactions: any[]): Promise<any[]> {
    const merchantFrequency: Record<string, any[]> = {};
    
    // Group by merchant
    for (const tx of transactions) {
      const key = `${tx.merchant}:${Math.abs(parseAmount(tx.amount))}`;
      if (!merchantFrequency[key]) merchantFrequency[key] = [];
      merchantFrequency[key].push(tx);
    }
    
    // Find recurring patterns
    const subscriptions = [];
    for (const [key, txs] of Object.entries(merchantFrequency)) {
      if (txs.length >= 3) { // At least 3 occurrences
        const dates = txs.map(tx => new Date(tx.date).getTime()).sort();
        const intervals = [];
        
        for (let i = 1; i < dates.length; i++) {
          intervals.push(dates[i] - dates[i-1]);
        }
        
        // Check if intervals are consistent (within 3 days tolerance)
        const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        const daysBetween = avgInterval / (1000 * 60 * 60 * 24);
        
        if (daysBetween >= 25 && daysBetween <= 35) {
          subscriptions.push({
            merchant: txs[0].merchant,
            amount: txs[0].amount,
            frequency: 'monthly',
            lastDate: new Date(Math.max(...dates)),
            transactions: txs
          });
        }
      }
    }
    
    return subscriptions;
  }
}
```

### 7. Enhanced Cash Flow Analytics
**Problem**: Basic implementation, missing features
**Solution**: Complete analytics engine
```typescript
export class CashFlowAnalytics {
  constructor(private api: MaybeFinanceAPI) {}
  
  async getRollingCashFlow(options: {
    days: number;
    accountIds?: string[];
    excludeTransfers?: boolean;
    includeForecasts?: boolean;
  }) {
    const { transactions } = await this.api.getTransactions({
      startDate: subDays(new Date(), options.days).toISOString(),
      endDate: new Date().toISOString()
    });
    
    // Filter by accounts if specified
    let filtered = transactions;
    if (options.accountIds?.length) {
      filtered = filtered.filter(tx => 
        options.accountIds!.includes(tx.account?.id || tx.accountId)
      );
    }
    
    // Exclude transfers if requested
    if (options.excludeTransfers) {
      filtered = await this.excludeTransfers(filtered);
    }
    
    // Calculate metrics
    const metrics = this.calculateMetrics(filtered, options.days);
    
    // Add forecasts if requested
    if (options.includeForecasts) {
      metrics.forecasts = await this.generateForecasts(filtered, metrics);
    }
    
    return metrics;
  }
  
  private async excludeTransfers(transactions: any[]): Promise<any[]> {
    // Identify transfers by matching amounts on same day
    const transferPairs = new Set<string>();
    
    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        const tx1 = transactions[i];
        const tx2 = transactions[j];
        
        // Same day, opposite amounts, different accounts
        if (tx1.date === tx2.date &&
            Math.abs(parseAmount(tx1.amount) + parseAmount(tx2.amount)) < 0.01 &&
            tx1.account?.id !== tx2.account?.id) {
          transferPairs.add(tx1.id);
          transferPairs.add(tx2.id);
        }
      }
    }
    
    return transactions.filter(tx => !transferPairs.has(tx.id));
  }
  
  private calculateMetrics(transactions: any[], days: number) {
    const dailyFlows = this.groupByDay(transactions);
    const categoryFlows = this.groupByCategory(transactions);
    const accountFlows = this.groupByAccount(transactions);
    
    const inflows = transactions
      .filter(tx => tx.classification === 'income')
      .reduce((sum, tx) => sum + parseAmount(tx.amount), 0);
      
    const outflows = transactions
      .filter(tx => tx.classification === 'expense')
      .reduce((sum, tx) => sum + parseAmount(tx.amount), 0);
    
    // Calculate volatility
    const dailyAmounts = Object.values(dailyFlows).map((d: any) => d.net);
    const volatility = this.calculateStandardDeviation(dailyAmounts);
    
    // Detect trends
    const trend = this.detectTrend(dailyFlows);
    
    return {
      period: `${days} days`,
      summary: {
        totalInflows: inflows,
        totalOutflows: outflows,
        netFlow: inflows - outflows,
        avgDailyInflow: inflows / days,
        avgDailyOutflow: outflows / days,
        avgDailyNet: (inflows - outflows) / days,
        volatility,
        trend
      },
      daily: dailyFlows,
      byCategory: categoryFlows,
      byAccount: accountFlows,
      insights: this.generateInsights(transactions, { inflows, outflows, volatility })
    };
  }
  
  private generateInsights(transactions: any[], metrics: any): string[] {
    const insights = [];
    
    // Spending trend
    if (metrics.outflows > metrics.inflows) {
      insights.push(`⚠️ You're spending ${formatCurrency(metrics.outflows - metrics.inflows)} more than you earn`);
    }
    
    // Volatility
    if (metrics.volatility > metrics.avgDailyOutflow * 0.5) {
      insights.push('📊 Your cash flow is highly variable - consider budgeting for stability');
    }
    
    // Large transactions
    const largeTransactions = transactions.filter(tx => 
      Math.abs(parseAmount(tx.amount)) > metrics.avgDailyOutflow * 3
    );
    if (largeTransactions.length > 0) {
      insights.push(`🎯 ${largeTransactions.length} large transactions significantly impact your cash flow`);
    }
    
    return insights;
  }
}
```

### 8. Anomaly Detection System
**Problem**: Completely missing
**Solution**: Statistical anomaly detection
```typescript
export class AnomalyDetector {
  async detectAnomalies(transactions: any[], options: {
    lookbackDays: number;
    sensitivity: number; // 1-3 standard deviations
  }) {
    const anomalies = {
      amount: [] as any[],
      frequency: [] as any[],
      newMerchants: [] as any[],
      timeOfDay: [] as any[],
      category: [] as any[]
    };
    
    // Amount anomalies
    const amounts = transactions.map(tx => parseAmount(tx.amount));
    const amountStats = this.calculateStats(amounts);
    const amountThreshold = amountStats.mean + (amountStats.stdDev * options.sensitivity);
    
    anomalies.amount = transactions.filter(tx => {
      const amount = Math.abs(parseAmount(tx.amount));
      return amount > amountThreshold;
    });
    
    // Frequency anomalies (too many transactions in a day)
    const dailyCounts = this.countByDay(transactions);
    const countStats = this.calculateStats(Object.values(dailyCounts));
    const countThreshold = countStats.mean + (countStats.stdDev * options.sensitivity);
    
    for (const [date, count] of Object.entries(dailyCounts)) {
      if (count > countThreshold) {
        anomalies.frequency.push({
          date,
          count,
          threshold: countThreshold,
          transactions: transactions.filter(tx => tx.date.startsWith(date))
        });
      }
    }
    
    // New merchant detection
    const historicalMerchants = new Set(
      transactions
        .filter(tx => new Date(tx.date) < subDays(new Date(), 30))
        .map(tx => tx.merchant)
        .filter(Boolean)
    );
    
    anomalies.newMerchants = transactions.filter(tx => 
      tx.merchant && 
      !historicalMerchants.has(tx.merchant) &&
      new Date(tx.date) >= subDays(new Date(), 30)
    );
    
    // Time anomalies (transactions at unusual hours)
    anomalies.timeOfDay = transactions.filter(tx => {
      const hour = new Date(tx.date).getHours();
      return hour < 6 || hour > 23; // Transactions between midnight and 6am
    });
    
    // Category spending anomalies
    const categorySpending = this.analyzeCategarySpending(transactions);
    anomalies.category = categorySpending.filter(cat => 
      cat.currentPeriod > cat.average * (1 + options.sensitivity * 0.3)
    );
    
    return {
      anomalies,
      summary: {
        total: Object.values(anomalies).flat().length,
        highRisk: anomalies.amount.filter(tx => 
          parseAmount(tx.amount) > amountThreshold * 2
        ).length,
        suggestions: this.generateSuggestions(anomalies)
      }
    };
  }
  
  private generateSuggestions(anomalies: any): string[] {
    const suggestions = [];
    
    if (anomalies.amount.length > 0) {
      suggestions.push('Review large transactions for potential fraud or errors');
    }
    
    if (anomalies.frequency.length > 0) {
      suggestions.push('Unusual transaction frequency detected - check for duplicate charges');
    }
    
    if (anomalies.newMerchants.length > 5) {
      suggestions.push('Many new merchants detected - ensure all are legitimate');
    }
    
    if (anomalies.timeOfDay.length > 0) {
      suggestions.push('Transactions at unusual hours - verify these are authorized');
    }
    
    return suggestions;
  }
}
```

## Implementation Priority

### Phase 1: Critical Fixes (Day 1-2)
1. Fix UUID validation across all tools
2. Implement robust date parsing
3. Fix amount parsing with proper validation
4. Add basic error retry logic

### Phase 2: Core Features (Day 3-5)
1. Implement CSV import tool
2. Add smart categorization
3. Fix cash flow analytics with all filters
4. Add subscription detection

### Phase 3: Advanced Features (Day 6-7)
1. Implement anomaly detection
2. Add spending pattern analysis
3. Create asset tracking system
4. Build forecasting engine

### Phase 4: Infrastructure (Day 8-9)
1. Add comprehensive test suite
2. Implement caching layer
3. Add rate limiting
4. Improve error handling

### Phase 5: Polish (Day 10)
1. Performance optimization
2. Documentation
3. Integration testing
4. Deployment preparation

## Testing Strategy

### Unit Tests Required
- Date parsing with all formats
- Amount parsing with edge cases
- Categorization rules
- Anomaly detection algorithms
- CSV parsing and field detection

### Integration Tests Required
- API client with retries
- Full transaction flow
- CSV import process
- Cash flow calculations

### E2E Tests Required
- Complete user workflows
- Error scenarios
- Rate limit handling
- Cache behavior

## Performance Optimizations

1. **Batch API Requests**: Group multiple requests
2. **Parallel Processing**: Use Promise.all for independent operations
3. **Streaming CSV**: Process large files in chunks
4. **Indexed Lookups**: Use Maps for O(1) lookups
5. **Lazy Loading**: Load data only when needed

## Security Enhancements

1. **Input Sanitization**: Validate all user inputs
2. **API Key Rotation**: Support multiple keys
3. **Audit Logging**: Log all operations
4. **Rate Limiting**: Prevent abuse
5. **Error Masking**: Don't expose internal errors

## Monitoring & Observability

1. **Performance Metrics**: Track response times
2. **Error Rates**: Monitor failure patterns
3. **Usage Analytics**: Track feature adoption
4. **Health Checks**: Endpoint monitoring
5. **Alerting**: Proactive issue detection

This comprehensive plan addresses all identified issues and implements all missing features to create a production-ready MCP server for Maybe Finance.