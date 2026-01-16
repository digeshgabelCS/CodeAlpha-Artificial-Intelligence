
import { FAQItem, MatchResult, Vector, Intent } from '../types';
import { STOPWORDS } from '../constants';

interface CachedFAQ {
  id: string;
  vector: Vector;
  faq: FAQItem;
}

interface SearchContext {
  faqs?: FAQItem[];
  previousCategory?: string;
  previousIntent?: Intent;
  currentIntent?: Intent;
}

/**
 * A lightweight client-side NLP service with stemming and cosine similarity.
 * Optimized with vector caching.
 */
class NLPService {
  
  private faqCache: CachedFAQ[] = [];
  private isInitialized = false;

  private intentMap: { [key in Intent]?: string[] } = {
    'CANCEL_SUBSCRIPTION': ['cancel', 'stop', 'terminate', 'unsubscribe', 'end', 'quit', 'leave', 'deactivate', 'closing'],
    'UPGRADE_PLAN': ['upgrade', 'pro', 'enterprise', 'buy', 'premium', 'plan', 'tier', 'unlimited', 'higher', 'expand'],
    'ACCOUNT_RECOVERY': ['reset', 'password', 'forgot', 'login', 'access', 'lock', 'mfa', '2fa', 'signin', 'credential', 'unlock', 'entry'],
    'GREETING': ['hi', 'hello', 'hey', 'morning', 'evening', 'greet', 'yo', 'sup', 'welcome', 'hiya'],
    'PRICING': ['cost', 'price', 'money', 'dollar', 'charge', 'bill', 'fee', 'payment', 'expensive', 'cheap', 'worth', 'pay'],
    'SECURITY': ['secure', 'safe', 'protect', 'encrypt', 'privacy', 'hack', 'data', 'gdpr', 'compliance', 'audit', 'breach', 'safety'],
    'FEEDBACK': ['feedback', 'suggest', 'critique', 'improve', 'idea', 'opinion', 'bad', 'good', 'feature', 'request', 'comment', 'love', 'hate', 'sucks', 'awesome'],
    'IMAGE_ANALYSIS': ['analyze', 'analysis', 'scan', 'identify', 'recognize', 'describe', 'detect', 'vision', 'what', 'read', 'ocr', 'look', 'see', 'check', 'examine'],
    'IMAGE_GENERATION': ['draw', 'sketch', 'paint', 'generate', 'create', 'make', 'produce', 'render', 'visualize', 'illustration', 'artwork', 'dalle', 'midjourney', 'imagine', 'edit', 'modify', 'change', 'transform', 'style', 'filter', 'convert', 'turn', 'add', 'remove'],
    'DEEP_RESEARCH': ['research', 'investigate', 'study', 'report', 'comprehensive', 'deep', 'breakdown', 'analysis', 'trends', 'history', 'overview', 'details'],
    'CLEAR_CHAT': ['clear', 'reset', 'wipe', 'delete', 'restart', 'clean', 'purge', 'erase', 'cls', 'empty']
  };

  private intentCategoryMap: { [key: string]: string[] } = {
    'PRICING': ['Billing'],
    'CANCEL_SUBSCRIPTION': ['Billing'],
    'UPGRADE_PLAN': ['Billing', 'Features'],
    'SECURITY': ['Technical'],
    'ACCOUNT_RECOVERY': ['Technical'],
    'GREETING': ['General'],
  };

  /**
   * Simple Stemming algorithm (Simplified Porter Stemmer logic)
   */
  private stem(word: string): string {
    if (word.length < 3) return word;

    let stemmed = word;

    // Step 1: Handle plural forms and basic suffixes
    if (stemmed.endsWith('ies') && !stemmed.endsWith('eies')) {
      stemmed = stemmed.slice(0, -3) + 'i';
    } else if (stemmed.endsWith('es') && !['aes', 'ees', 'oes'].some(e => stemmed.endsWith(e))) {
      stemmed = stemmed.slice(0, -2);
    } else if (stemmed.endsWith('s') && !stemmed.endsWith('ss')) {
      stemmed = stemmed.slice(0, -1);
    }

    // Step 2: Handle past tense and progressive
    if (stemmed.endsWith('ing')) {
      const base = stemmed.slice(0, -3);
      if (base.length >= 3) stemmed = base;
    } else if (stemmed.endsWith('ed')) {
      const base = stemmed.slice(0, -2);
      if (base.length >= 3) stemmed = base;
    }

    return stemmed;
  }

  /**
   * Pre-calculates vectors for all FAQs to improve performance.
   */
  initialize(faqs: FAQItem[]) {
    if (this.isInitialized) return;
    
    this.faqCache = faqs.map(faq => {
      const tokens = this.preprocess(faq.question);
      return {
        id: faq.id,
        faq: faq,
        vector: this.createVector(tokens)
      };
    });
    
    this.isInitialized = true;
  }

  /**
   * Detects user intent based on keyword extraction and stemming.
   */
  detectIntent(query: string): Intent {
    const tokens = this.preprocess(query);
    if (tokens.length === 0) return 'NONE';
    
    const lowerQuery = query.toLowerCase();

    // Prioritize specific phrase triggers
    if (lowerQuery.startsWith('deep research') || lowerQuery.includes('comprehensive report')) {
        return 'DEEP_RESEARCH';
    }
    
    // Check for explicit clear chat command phrases to avoid false positives with just "clear" in a sentence
    if (lowerQuery.includes('clear chat') || lowerQuery.includes('clear history') || lowerQuery.includes('reset chat') || lowerQuery.includes('new chat') || lowerQuery === 'clear' || lowerQuery === 'reset') {
        return 'CLEAR_CHAT';
    }

    for (const [intent, keywords] of Object.entries(this.intentMap)) {
      if (keywords.some(k => tokens.includes(this.stem(k.toLowerCase())))) {
        return intent as Intent;
      }
    }

    return 'NONE';
  }

  /**
   * Cleans, tokenizes, filters, and STEMS text.
   */
  preprocess(text: string): string[] {
    const cleanText = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .trim();

    const tokens = cleanText.split(/\s+/);
    
    return tokens
      .filter(token => token.length > 0 && !STOPWORDS.has(token))
      .map(token => this.stem(token));
  }

  /**
   * Creates a term frequency vector for a document based on a vocabulary.
   */
  createVector(tokens: string[]): Vector {
    const vector: Vector = {};
    for (const token of tokens) {
      vector[token] = (vector[token] || 0) + 1;
    }
    return vector;
  }

  /**
   * Calculates the cosine similarity between two vectors.
   */
  calculateCosineSimilarity(vecA: Vector, vecB: Vector): number {
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (const key in vecA) {
      magA += vecA[key] ** 2;
    }
    magA = Math.sqrt(magA);

    for (const key in vecB) {
      magB += vecB[key] ** 2;
    }
    magB = Math.sqrt(magB);

    if (magA === 0 || magB === 0) return 0;

    for (const key of Object.keys(vecA)) {
      if (vecB[key]) {
        dotProduct += vecA[key] * vecB[key];
      }
    }

    return dotProduct / (magA * magB);
  }

  /**
   * Finds the best match FAQ for a user query.
   * Uses pre-computed vectors if initialized.
   * Leverages conversational context for smarter ranking.
   */
  findBestMatch(userQuery: string, context: SearchContext = {}): MatchResult | null {
    const queryTokens = this.preprocess(userQuery);
    if (queryTokens.length === 0) return null;

    const queryVector = this.createVector(queryTokens);
    
    let bestMatch: MatchResult | null = null;
    let highestScore = -1;

    // Use cached vectors if available, otherwise fallback to unoptimized loop
    const itemsToScan = this.isInitialized ? this.faqCache : (context.faqs || []).map(f => ({
        id: f.id,
        faq: f,
        vector: this.createVector(this.preprocess(f.question))
    }));

    for (const item of itemsToScan) {
      let score = this.calculateCosineSimilarity(queryVector, item.vector);

      // 1. Context Awareness: Category Continuity
      // If the user is asking follow-up questions in the same category, boost score.
      if (context.previousCategory && item.faq.category === context.previousCategory) {
        score *= 1.25; 
      }

      // 2. Context Awareness: Intent-Category Alignment
      // If the detected intent strongly correlates with a category, boost that category.
      if (context.currentIntent && this.intentCategoryMap[context.currentIntent]) {
         if (this.intentCategoryMap[context.currentIntent].includes(item.faq.category)) {
             score *= 1.2;
         }
      }

      // 3. Short Query Heuristic (Follow-up)
      // If query is short (< 3 tokens) and we have a previous category, assume follow-up.
      if (queryTokens.length < 3 && context.previousCategory && item.faq.category === context.previousCategory) {
           score *= 1.1;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = { faq: item.faq, score };
      }
    }

    // Dynamic Threshold
    // Lower threshold slightly if we have strong context to allow for more natural follow-ups
    let threshold = 0.25;
    if (context.previousCategory || (context.currentIntent && context.currentIntent !== 'NONE')) {
        threshold = 0.2;
    }

    if (highestScore > threshold && bestMatch) {
      return { ...bestMatch, score: highestScore };
    }

    return null;
  }

  /**
   * Returns suggested follow-up questions based on the current FAQ's category.
   */
  getRelatedQuestions(faqs: FAQItem[], currentFaq: FAQItem): string[] {
    const related = faqs.filter(f => f.category === currentFaq.category && f.id !== currentFaq.id);
    return related.sort(() => 0.5 - Math.random()).slice(0, 3).map(f => f.question);
  }
}

export const nlpService = new NLPService();
