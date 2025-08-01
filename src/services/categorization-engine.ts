import { Transaction } from "./api-client.js";
import { parseAmount } from "../utils/parsers.js";

// Special categories matching user requirements
export const SPECIAL_CATEGORIES = {
  REQUIRED_PURCHASES: "Required Purchases",
  DISCRETIONARY: "Discretionary Spending",
  SUBSCRIPTIONS: "Subscriptions",
  SPENDING_BUT_ASSETS: "Spending but Assets"
};

export interface CategorizationRule {
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
    accountType?: string[];
  };
}

export interface Subscription {
  merchant: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'yearly';
  lastDate: Date;
  nextExpectedDate: Date;
  confidence: number;
  transactions: Transaction[];
}

export class CategorizationEngine {
  private rules: CategorizationRule[] = [
    // Required Purchases - Groceries
    {
      id: 'groceries_nl',
      name: 'Dutch Grocery Stores',
      category: SPECIAL_CATEGORIES.REQUIRED_PURCHASES,
      priority: 95,
      conditions: {
        merchantPatterns: [
          /albert\s*heijn/i, /jumbo/i, /lidl/i, /aldi/i, /plus/i, /coop/i,
          /dirk/i, /vomar/i, /deen/i, /spar/i, /ekoplaza/i, /marqt/i
        ],
        descriptionPatterns: [/supermar/i, /grocery/i, /boodschap/i],
      }
    },
    {
      id: 'groceries_general',
      name: 'General Grocery',
      category: SPECIAL_CATEGORIES.REQUIRED_PURCHASES,
      priority: 90,
      conditions: {
        descriptionPatterns: [
          /grocery/i, /supermarket/i, /food\s*store/i, /market/i
        ],
        amountRange: { min: 10, max: 300 }
      }
    },
    
    // Required Purchases - Utilities
    {
      id: 'utilities_energy',
      name: 'Energy Utilities',
      category: SPECIAL_CATEGORIES.REQUIRED_PURCHASES,
      priority: 100,
      conditions: {
        merchantPatterns: [
          /eneco/i, /vattenfall/i, /essent/i, /nuon/i, /greenchoice/i,
          /pure\s*energie/i, /vandebron/i, /budget\s*energie/i, /engie/i
        ],
        descriptionPatterns: [/electricity/i, /gas/i, /energie/i, /stroom/i],
      }
    },
    {
      id: 'utilities_water',
      name: 'Water Utilities',
      category: SPECIAL_CATEGORIES.REQUIRED_PURCHASES,
      priority: 100,
      conditions: {
        merchantPatterns: [/waternet/i, /vitens/i, /pwn/i, /evides/i, /dunea/i],
        descriptionPatterns: [/water/i],
      }
    },
    {
      id: 'utilities_internet',
      name: 'Internet/Telecom',
      category: SPECIAL_CATEGORIES.REQUIRED_PURCHASES,
      priority: 95,
      conditions: {
        merchantPatterns: [
          /ziggo/i, /kpn/i, /vodafone/i, /t-mobile/i, /tele2/i,
          /xs4all/i, /online\.nl/i
        ],
        descriptionPatterns: [/internet/i, /broadband/i, /telecom/i],
        isRecurring: true
      }
    },
    
    // Required Purchases - Housing
    {
      id: 'rent',
      name: 'Rent/Mortgage',
      category: SPECIAL_CATEGORIES.REQUIRED_PURCHASES,
      priority: 100,
      conditions: {
        descriptionPatterns: [
          /rent/i, /huur/i, /mortgage/i, /hypotheek/i,
          /woning/i, /verhuur/i
        ],
        dayOfMonth: [1, 2, 3, 28, 29, 30, 31],
        amountRange: { min: 400 }
      }
    },
    {
      id: 'insurance',
      name: 'Insurance',
      category: SPECIAL_CATEGORIES.REQUIRED_PURCHASES,
      priority: 95,
      conditions: {
        merchantPatterns: [
          /achmea/i, /aegon/i, /asr/i, /nn/i, /nationale.*nederlanden/i,
          /zilveren\s*kruis/i, /cz/i, /vgz/i, /menzis/i, /fbto/i
        ],
        descriptionPatterns: [
          /insurance/i, /verzekering/i, /zorgverzekering/i,
          /inboedel/i, /aansprakelijk/i
        ],
        isRecurring: true
      }
    },
    
    // Subscriptions - Streaming
    {
      id: 'streaming',
      name: 'Streaming Services',
      category: SPECIAL_CATEGORIES.SUBSCRIPTIONS,
      priority: 85,
      conditions: {
        merchantPatterns: [
          /netflix/i, /spotify/i, /disney/i, /hbo/i, /videoland/i,
          /amazon\s*prime/i, /apple\s*(tv|music)/i, /youtube\s*premium/i,
          /viaplay/i, /nlziet/i, /discovery/i
        ],
        isRecurring: true,
        amountRange: { min: 5, max: 50 }
      }
    },
    
    // Subscriptions - Software
    {
      id: 'software',
      name: 'Software Subscriptions',
      category: SPECIAL_CATEGORIES.SUBSCRIPTIONS,
      priority: 80,
      conditions: {
        merchantPatterns: [
          /adobe/i, /microsoft/i, /dropbox/i, /google\s*storage/i,
          /github/i, /slack/i, /notion/i, /1password/i, /lastpass/i
        ],
        descriptionPatterns: [/subscription/i, /monthly/i, /license/i],
        isRecurring: true
      }
    },
    
    // Subscriptions - Gym
    {
      id: 'gym',
      name: 'Gym/Fitness',
      category: SPECIAL_CATEGORIES.SUBSCRIPTIONS,
      priority: 80,
      conditions: {
        merchantPatterns: [
          /basic.*fit/i, /fit\s*for\s*free/i, /sportcity/i,
          /anytime\s*fitness/i, /gym/i, /fitness/i
        ],
        descriptionPatterns: [/gym/i, /fitness/i, /sport/i],
        isRecurring: true
      }
    },
    
    // Discretionary - Dining
    {
      id: 'dining_restaurants',
      name: 'Restaurants',
      category: SPECIAL_CATEGORIES.DISCRETIONARY,
      priority: 70,
      conditions: {
        merchantPatterns: [
          /restaurant/i, /cafe/i, /bistro/i, /brasserie/i,
          /pizzeria/i, /sushi/i, /burger/i, /grill/i
        ],
        descriptionPatterns: [
          /restaurant/i, /dining/i, /lunch/i, /dinner/i,
          /breakfast/i, /brunch/i
        ],
        amountRange: { min: 15 }
      }
    },
    {
      id: 'dining_fast_food',
      name: 'Fast Food',
      category: SPECIAL_CATEGORIES.DISCRETIONARY,
      priority: 65,
      conditions: {
        merchantPatterns: [
          /mcdonald/i, /burger\s*king/i, /kfc/i, /subway/i,
          /domino/i, /pizza\s*hut/i, /new\s*york\s*pizza/i,
          /thuisbezorgd/i, /uber\s*eats/i, /deliveroo/i
        ],
        amountRange: { min: 5, max: 50 }
      }
    },
    
    // Discretionary - Entertainment
    {
      id: 'entertainment',
      name: 'Entertainment',
      category: SPECIAL_CATEGORIES.DISCRETIONARY,
      priority: 60,
      conditions: {
        merchantPatterns: [
          /pathe/i, /cinema/i, /theater/i, /concert/i,
          /ticketmaster/i, /museum/i, /event/i
        ],
        descriptionPatterns: [
          /ticket/i, /entertainment/i, /show/i, /movie/i
        ]
      }
    },
    {
      id: 'shopping_clothing',
      name: 'Clothing & Fashion',
      category: SPECIAL_CATEGORIES.DISCRETIONARY,
      priority: 60,
      conditions: {
        merchantPatterns: [
          /h\s*&\s*m/i, /zara/i, /primark/i, /c\s*&\s*a/i,
          /hema/i, /uniqlo/i, /nike/i, /adidas/i
        ],
        descriptionPatterns: [/clothing/i, /fashion/i, /apparel/i]
      }
    },
    
    // Spending but Assets - Electronics
    {
      id: 'electronics',
      name: 'Electronics',
      category: SPECIAL_CATEGORIES.SPENDING_BUT_ASSETS,
      priority: 75,
      conditions: {
        merchantPatterns: [
          /mediamarkt/i, /coolblue/i, /bol\.com/i, /apple/i,
          /samsung/i, /bcc/i, /expert/i, /paradigit/i
        ],
        descriptionPatterns: [
          /laptop/i, /computer/i, /phone/i, /tablet/i,
          /tv/i, /television/i, /monitor/i, /headphone/i
        ],
        amountRange: { min: 100 }
      }
    },
    
    // Spending but Assets - Furniture
    {
      id: 'furniture',
      name: 'Furniture & Home',
      category: SPECIAL_CATEGORIES.SPENDING_BUT_ASSETS,
      priority: 75,
      conditions: {
        merchantPatterns: [
          /ikea/i, /leen\s*bakker/i, /kwantum/i, /praxis/i,
          /gamma/i, /karwei/i, /hornbach/i
        ],
        descriptionPatterns: [
          /furniture/i, /meubel/i, /desk/i, /chair/i,
          /table/i, /couch/i, /bed/i, /mattress/i
        ],
        amountRange: { min: 50 }
      }
    },
    
    // Spending but Assets - Tools & Equipment
    {
      id: 'tools',
      name: 'Tools & Equipment',
      category: SPECIAL_CATEGORIES.SPENDING_BUT_ASSETS,
      priority: 70,
      conditions: {
        merchantPatterns: [
          /bosch/i, /makita/i, /dewalt/i, /toolstation/i
        ],
        descriptionPatterns: [
          /tool/i, /drill/i, /equipment/i, /gereedschap/i
        ],
        amountRange: { min: 30 }
      }
    }
  ];

  async categorize(transaction: Transaction): Promise<string | null> {
    const amount = Math.abs(parseAmount(transaction.amount));
    const merchant = (transaction.merchant || transaction.name || '').toLowerCase();
    const description = (transaction.name || '').toLowerCase();
    const date = new Date(transaction.date);

    // Sort rules by priority (highest first)
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.matchesRule(transaction, rule, { amount, merchant, description, date })) {
        return rule.category;
      }
    }

    // Default categorization based on amount and patterns
    if (this.isLikelyGrocery(merchant, description, amount)) {
      return SPECIAL_CATEGORIES.REQUIRED_PURCHASES;
    }
    
    if (this.isLikelySubscription(merchant, amount)) {
      return SPECIAL_CATEGORIES.SUBSCRIPTIONS;
    }

    // Default to discretionary for unmatched expenses
    return SPECIAL_CATEGORIES.DISCRETIONARY;
  }

  private matchesRule(
    _transaction: Transaction,
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
        pattern.test(parsed.description) || pattern.test(parsed.merchant)
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

  private isLikelyGrocery(merchant: string, description: string, amount: number): boolean {
    const combined = `${merchant} ${description}`.toLowerCase();
    const groceryKeywords = [
      'market', 'grocery', 'food', 'supermar', 'grocer'
    ];
    
    return groceryKeywords.some(keyword => combined.includes(keyword)) &&
           amount >= 10 && amount <= 300;
  }

  private isLikelySubscription(merchant: string, amount: number): boolean {
    // Common subscription amounts
    const subscriptionAmounts = [
      4.99, 5.99, 6.99, 7.99, 8.99, 9.99, 10.99, 11.99,
      12.99, 14.99, 15.99, 19.99, 24.99, 29.99
    ];
    
    return subscriptionAmounts.includes(amount) ||
           merchant.includes('subscription') ||
           merchant.includes('monthly');
  }

  async detectSubscriptions(transactions: Transaction[]): Promise<Subscription[]> {
    const merchantGroups: Record<string, Transaction[]> = {};

    // Group transactions by merchant and amount
    for (const tx of transactions) {
      if (tx.classification !== 'expense') continue;
      
      const amount = Math.abs(parseAmount(tx.amount));
      const key = `${tx.merchant || tx.name}:${amount.toFixed(2)}`;
      
      if (!merchantGroups[key]) {
        merchantGroups[key] = [];
      }
      merchantGroups[key].push(tx);
    }

    const subscriptions: Subscription[] = [];

    // Analyze each merchant group
    for (const [key, txs] of Object.entries(merchantGroups)) {
      if (txs.length < 3) continue; // Need at least 3 occurrences

      const [merchantName, amountStr] = key.split(':');
      const amount = parseFloat(amountStr);
      
      // Calculate intervals between transactions
      const dates = txs
        .map(tx => new Date(tx.date).getTime())
        .sort((a, b) => a - b);
      
      const intervals: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        intervals.push(dates[i] - dates[i - 1]);
      }

      // Determine frequency
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const daysBetween = avgInterval / (1000 * 60 * 60 * 24);
      
      let frequency: 'weekly' | 'monthly' | 'yearly' | null = null;
      let confidence = 0;

      if (daysBetween >= 6 && daysBetween <= 8) {
        frequency = 'weekly';
        confidence = this.calculateConfidence(intervals, 7 * 24 * 60 * 60 * 1000);
      } else if (daysBetween >= 25 && daysBetween <= 35) {
        frequency = 'monthly';
        confidence = this.calculateConfidence(intervals, 30 * 24 * 60 * 60 * 1000);
      } else if (daysBetween >= 350 && daysBetween <= 380) {
        frequency = 'yearly';
        confidence = this.calculateConfidence(intervals, 365 * 24 * 60 * 60 * 1000);
      }

      if (frequency && confidence > 0.7) {
        const lastDate = new Date(Math.max(...dates));
        const nextExpectedDate = this.calculateNextDate(lastDate, frequency);
        
        subscriptions.push({
          merchant: merchantName,
          amount,
          frequency,
          lastDate,
          nextExpectedDate,
          confidence,
          transactions: txs
        });
      }
    }

    return subscriptions.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateConfidence(intervals: number[], expectedInterval: number): number {
    if (intervals.length === 0) return 0;
    
    const tolerance = expectedInterval * 0.15; // 15% tolerance
    const withinTolerance = intervals.filter(interval =>
      Math.abs(interval - expectedInterval) <= tolerance
    );
    
    return withinTolerance.length / intervals.length;
  }

  private calculateNextDate(lastDate: Date, frequency: 'weekly' | 'monthly' | 'yearly'): Date {
    const next = new Date(lastDate);
    
    switch (frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    
    return next;
  }

  // Add custom rule
  addRule(rule: CategorizationRule): void {
    this.rules.push(rule);
    // Re-sort by priority
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  // Get all rules
  getRules(): CategorizationRule[] {
    return [...this.rules];
  }

  // Remove rule by ID
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }
}