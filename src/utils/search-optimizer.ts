/**
 * Enhanced search optimization utilities for FTS5
 * Provides better query parsing, ranking, and semantic search capabilities
 */

import { SearchOptions } from '../types.js';
import {
  analyzeSearchIntent,
  generateSearchSuggestions,
  calculateContextAwareRelevance,
  generateContextAwareHighlights,
  analyzeQueryComplexity as analyzeQueryComplexityEnhanced
} from './context-aware-search.js';

export interface SearchQuery {
  original: string;
  terms: string[];
  phrases: string[];
  fuzzy: boolean;
  prefix: boolean;
  complexity: 'simple' | 'complex';
  estimatedCost: number;
  // Context-aware search enhancements
  semanticTerms: string[];
  contextHints: string[];
  searchMode: 'exact' | 'semantic' | 'fuzzy' | 'hybrid';
  contentTypes: ('text' | 'image' | 'audio' | 'resource')[];
}

export interface SearchResult {
  entity: any;
  relevance: number;
  highlights: string[];
  matchType: 'exact' | 'prefix' | 'fuzzy' | 'semantic';
  score: number;
}

export interface SearchCache {
  query: string;
  results: SearchResult[];
  timestamp: number;
  ttl: number;
}

// Query complexity analysis
const COMPLEXITY_INDICATORS = {
  OPERATORS: ['AND', 'OR', 'NOT', 'NEAR'],
  WILDCARDS: ['*', '?', '~'],
  PHRASES: /"[^"]+"/g,
  BOOLEAN: /\b(AND|OR|NOT)\b/gi
};

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  SIMPLE_QUERY_LIMIT: 1000,
  COMPLEX_QUERY_LIMIT: 100,
  CACHE_TTL: 300000, // 5 minutes
  MAX_CACHE_SIZE: 1000,
  MIN_RELEVANCE_SCORE: 0.1
};

// In-memory query cache
const queryCache = new Map<string, SearchCache>();

/**
 * Parse and optimize search queries for FTS5 with complexity analysis
 */
export function parseSearchQuery(query: string): SearchQuery {
  const original = query.trim();
  const terms: string[] = [];
  const phrases: string[] = [];
  let fuzzy = false;
  let prefix = false;

  // Extract quoted phrases
  const phraseRegex = /"([^"]+)"/g;
  let match;
  while ((match = phraseRegex.exec(original)) !== null) {
    phrases.push(match[1]);
  }

  // Extract individual terms
  const cleanQuery = original.replace(/"[^"]+"/g, '').trim();
  const words = cleanQuery.split(/\s+/).filter(word => word.length > 0);

  for (const word of words) {
    if (word.endsWith('*')) {
      prefix = true;
      terms.push(word.slice(0, -1));
    } else if (word.includes('~')) {
      fuzzy = true;
      terms.push(word.replace('~', ''));
    } else {
      terms.push(word);
    }
  }

  // Analyze query complexity with enhanced analysis
  const complexityAnalysis = analyzeQueryComplexityEnhanced(original);
  const complexity = complexityAnalysis.complexity === 'moderate' ? 'complex' : complexityAnalysis.complexity;
  const estimatedCost = estimateQueryCost(original, terms.length, phrases.length);

  // Context-aware search enhancements
  const semanticTerms = extractSemanticTerms(original);
  const contextHints = extractContextHints(original);
  const searchMode = determineSearchMode(original, terms, phrases);
  const contentTypes = detectContentTypes(original);

  return {
    original,
    terms,
    phrases,
    fuzzy,
    prefix,
    complexity,
    estimatedCost,
    semanticTerms,
    contextHints,
    searchMode,
    contentTypes
  };
}

/**
 * Extract semantic terms for context-aware search
 */
function extractSemanticTerms(query: string): string[] {
  const semanticTerms: string[] = [];
  const lowerQuery = query.toLowerCase();

  // Common semantic patterns
  const semanticPatterns = [
    // Person-related terms
    { pattern: /\b(person|people|contact|friend|colleague|team)\b/g, weight: 2.0 },
    // Project-related terms
    { pattern: /\b(project|task|work|assignment|deliverable)\b/g, weight: 1.5 },
    // Time-related terms
    { pattern: /\b(recent|recently|today|yesterday|last week|this month)\b/g, weight: 1.3 },
    // Action-related terms
    { pattern: /\b(meeting|call|discussion|conversation|email)\b/g, weight: 1.4 },
    // Technology-related terms
    { pattern: /\b(technology|software|code|system|platform)\b/g, weight: 1.2 },
    // Importance indicators
    { pattern: /\b(important|critical|urgent|priority|key)\b/g, weight: 1.6 }
  ];

  for (const { pattern, weight } of semanticPatterns) {
    const matches = lowerQuery.match(pattern);
    if (matches) {
      semanticTerms.push(...matches);
    }
  }

  return [...new Set(semanticTerms)]; // Remove duplicates
}

/**
 * Extract context hints from search query
 */
function extractContextHints(query: string): string[] {
  const hints: string[] = [];
  const lowerQuery = query.toLowerCase();

  // Context indicators
  const contextPatterns = [
    // Work context
    { pattern: /\b(work|office|job|professional|business)\b/g, context: 'work' },
    // Personal context
    { pattern: /\b(personal|family|home|private|life)\b/g, context: 'personal' },
    // Technical context
    { pattern: /\b(technical|code|programming|development|engineering)\b/g, context: 'technical' },
    // Time context
    { pattern: /\b(recent|old|new|current|past|future)\b/g, context: 'temporal' }
  ];

  for (const { pattern, context } of contextPatterns) {
    if (pattern.test(lowerQuery)) {
      hints.push(context);
    }
  }

  return hints;
}

/**
 * Determine search mode based on query characteristics
 */
function determineSearchMode(
  query: string,
  terms: string[],
  phrases: string[]
): 'exact' | 'semantic' | 'fuzzy' | 'hybrid' {
  const lowerQuery = query.toLowerCase();

  // Exact mode for quoted phrases or specific names
  if (phrases.length > 0 || /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(query)) {
    return 'exact';
  }

  // Fuzzy mode for short queries or typos
  if (query.length <= 3 || terms.some(term => term.length <= 2)) {
    return 'fuzzy';
  }

  // Semantic mode for descriptive queries
  if (lowerQuery.includes('about') || lowerQuery.includes('related to') ||
      lowerQuery.includes('similar to') || terms.length > 3) {
    return 'semantic';
  }

  // Default to hybrid mode
  return 'hybrid';
}

/**
 * Detect content types from search query
 */
function detectContentTypes(query: string): ('text' | 'image' | 'audio' | 'resource')[] {
  const types: ('text' | 'image' | 'audio' | 'resource')[] = ['text']; // Default
  const lowerQuery = query.toLowerCase();

  // Image content indicators
  if (lowerQuery.includes('image') || lowerQuery.includes('photo') ||
      lowerQuery.includes('picture') || lowerQuery.includes('screenshot')) {
    types.push('image');
  }

  // Audio content indicators
  if (lowerQuery.includes('audio') || lowerQuery.includes('sound') ||
      lowerQuery.includes('recording') || lowerQuery.includes('voice')) {
    types.push('audio');
  }

  // Resource content indicators
  if (lowerQuery.includes('file') || lowerQuery.includes('document') ||
      lowerQuery.includes('link') || lowerQuery.includes('url')) {
    types.push('resource');
  }

  return [...new Set(types)]; // Remove duplicates
}

/**
 * Analyze query complexity for optimization decisions
 */
function analyzeQueryComplexity(query: string): 'simple' | 'complex' {
  const hasOperators = COMPLEXITY_INDICATORS.OPERATORS.some(op =>
    query.toUpperCase().includes(op)
  );

  const hasWildcards = COMPLEXITY_INDICATORS.WILDCARDS.some(wc =>
    query.includes(wc)
  );

  const hasPhrases = COMPLEXITY_INDICATORS.PHRASES.test(query);
  const hasBoolean = COMPLEXITY_INDICATORS.BOOLEAN.test(query);

  const complexityScore = [
    hasOperators ? 3 : 0,
    hasWildcards ? 2 : 0,
    hasPhrases ? 1 : 0,
    hasBoolean ? 2 : 0
  ].reduce((sum, score) => sum + score, 0);

  return complexityScore > 2 ? 'complex' : 'simple';
}

/**
 * Estimate query execution cost for optimization
 */
function estimateQueryCost(query: string, termCount: number, phraseCount: number): number {
  let cost = 1.0;

  // Base cost from term count
  cost += termCount * 0.5;

  // Phrase searches are more expensive
  cost += phraseCount * 2.0;

  // Complexity multipliers
  if (query.includes('*')) cost *= 1.5; // Prefix searches
  if (query.includes('~')) cost *= 2.0; // Fuzzy searches
  if (query.includes('OR')) cost *= 1.8; // Boolean OR
  if (query.includes('AND')) cost *= 1.3; // Boolean AND
  if (query.includes('NOT')) cost *= 1.4; // Boolean NOT

  return Math.round(cost * 100) / 100;
}

/**
 * Build optimized FTS5 query string with performance considerations
 */
export function buildFTSQuery(searchQuery: SearchQuery): string {
  const parts: string[] = [];

  // Add exact phrases first (highest priority)
  for (const phrase of searchQuery.phrases) {
    parts.push(`"${phrase}"`);
  }

  // Add individual terms with optimization
  for (const term of searchQuery.terms) {
    if (searchQuery.prefix) {
      parts.push(`${term}*`);
    } else if (searchQuery.fuzzy) {
      // FTS5 doesn't support ~ operator, so convert to prefix search
      // This provides similar functionality for partial matching
      parts.push(`${term}*`);
    } else {
      // Use prefix matching for better performance
      parts.push(`"${term}"*`);
    }
  }

  // Optimize query structure based on complexity
  if (searchQuery.complexity === 'complex') {
    // For complex queries, use OR to ensure we get results
    return parts.join(' OR ');
  } else {
    // For simple queries, use space separation (implicit AND)
    return parts.join(' ');
  }
}

/**
 * Calculate context-aware relevance score for search results
 */
export function calculateRelevance(
  entity: any,
  searchQuery: SearchQuery,
  rank: number,
  searchContext?: SearchOptions['searchContext']
): number {
  // Use the enhanced context-aware relevance calculation
  return calculateContextAwareRelevance(entity, searchQuery, rank, searchContext);
}

/**
 * Detect entity context (work vs personal)
 */
function detectEntityContext(entity: any): string {
  const entityText = [
    entity.name,
    entity.entity_type,
    ...(entity.observations || []).map((obs: any) =>
      obs.type === 'text' ? obs.text : ''
    )
  ].join(' ').toLowerCase();

  const workIndicators = ['work', 'office', 'job', 'professional', 'business', 'project', 'meeting'];
  const personalIndicators = ['personal', 'family', 'home', 'private', 'life', 'friend', 'hobby'];

  const workScore = workIndicators.filter(indicator => entityText.includes(indicator)).length;
  const personalScore = personalIndicators.filter(indicator => entityText.includes(indicator)).length;

  if (workScore > personalScore) return 'work';
  if (personalScore > workScore) return 'personal';
  return 'neutral';
}

/**
 * Get content types present in entity
 */
function getEntityContentTypes(entity: any): ('text' | 'image' | 'audio' | 'resource')[] {
  const types: ('text' | 'image' | 'audio' | 'resource')[] = ['text']; // Default

  if (entity.observations && Array.isArray(entity.observations)) {
    for (const obs of entity.observations) {
      if (obs.type === 'image') types.push('image');
      if (obs.type === 'audio') types.push('audio');
      if (obs.type === 'resource' || obs.type === 'resource_link') types.push('resource');
    }
  }

  return [...new Set(types)]; // Remove duplicates
}

/**
 * Generate context-aware search highlights with enhanced formatting
 */
export function generateHighlights(
  entity: any,
  searchQuery: SearchQuery,
  searchContext?: SearchOptions['searchContext']
): string[] {
  // Use the enhanced context-aware highlights generation
  return generateContextAwareHighlights(entity, searchQuery, searchContext);
}

/**
 * Find observations most relevant to the search query
 */
function findRelevantObservations(observations: any[], searchQuery: SearchQuery): any[] {
  const scoredObservations = observations.map(obs => {
    let score = 0;

    if (obs.type === 'text' && obs.text) {
      const textLower = obs.text.toLowerCase();

      // Exact query match
      if (textLower.includes(searchQuery.original.toLowerCase())) {
        score += 10;
      }

      // Semantic term matches
      for (const semanticTerm of searchQuery.semanticTerms) {
        if (textLower.includes(semanticTerm)) {
          score += 5;
        }
      }

      // Content type preference
      if (searchQuery.contentTypes.includes('text')) {
        score += 2;
      }
    } else {
      // Non-text content type matching
      if (searchQuery.contentTypes.includes(obs.type)) {
        score += 3;
      }
    }

    return { observation: obs, score };
  });

  // Sort by relevance and return top observations
  return scoredObservations
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.observation);
}

/**
 * Create context-aware text snippets with smart boundaries
 */
function createContextSnippet(text: string, query: string, maxLength: number): string {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const matchIndex = textLower.indexOf(queryLower);

  if (matchIndex === -1) return text.slice(0, maxLength) + '...';

  // Calculate snippet boundaries
  const halfLength = Math.floor(maxLength / 2);
  let start = Math.max(0, matchIndex - halfLength);
  let end = Math.min(text.length, matchIndex + query.length + halfLength);

  // Adjust boundaries to word boundaries
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  while (end < text.length && !/\s/.test(text[end])) end++;

  // Add ellipsis if needed
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Determine match type for search result with enhanced detection
 */
export function determineMatchType(
  entity: any,
  searchQuery: SearchQuery
): 'exact' | 'prefix' | 'fuzzy' | 'semantic' {
  const nameLower = entity.name.toLowerCase();
  const queryLower = searchQuery.original.toLowerCase();

  if (nameLower === queryLower) {
    return 'exact';
  } else if (nameLower.startsWith(queryLower)) {
    return 'prefix';
  } else if (searchQuery.fuzzy) {
    return 'fuzzy';
  } else {
    return 'semantic';
  }
}

/**
 * Sort search results by relevance with tie-breaking
 */
export function sortByRelevance(results: SearchResult[]): SearchResult[] {
  return results.sort((a, b) => {
    // Primary sort by relevance score
    if (Math.abs(a.relevance - b.relevance) > 0.01) {
      return b.relevance - a.relevance;
    }

    // Tie-break by entity name length (prefer shorter names)
    if (a.entity.name.length !== b.entity.name.length) {
      return a.entity.name.length - b.entity.name.length;
    }

    // Final tie-break by name alphabetical order
    return a.entity.name.localeCompare(b.entity.name);
  });
}

/**
 * Apply search filters and limits with performance optimization
 */
export function filterSearchResults(
  results: SearchResult[],
  options: {
    minRelevance?: number;
    maxResults?: number;
    entityTypes?: string[];
    excludeTypes?: string[];
  }
): SearchResult[] {
  let filtered = results;

  // Filter by minimum relevance
  if (options.minRelevance) {
    filtered = filtered.filter(result => result.relevance >= options.minRelevance!);
  }

  // Filter by entity types (include)
  if (options.entityTypes && options.entityTypes.length > 0) {
    filtered = filtered.filter(result =>
      options.entityTypes!.includes(result.entity.entity_type)
    );
  }

  // Filter by entity types (exclude)
  if (options.excludeTypes && options.excludeTypes.length > 0) {
    filtered = filtered.filter(result =>
      !options.excludeTypes!.includes(result.entity.entity_type)
    );
  }

  // Apply result limit
  if (options.maxResults) {
    filtered = filtered.slice(0, options.maxResults);
  }

  return filtered;
}

/**
 * Query cache management
 */
export function getCachedQuery(query: string): SearchResult[] | null {
  const cached = queryCache.get(query);
  if (!cached) return null;

  // Check if cache is still valid
  if (Date.now() - cached.timestamp > cached.ttl) {
    queryCache.delete(query);
    return null;
  }

  return cached.results;
}

export function cacheQuery(query: string, results: SearchResult[], ttl: number = PERFORMANCE_THRESHOLDS.CACHE_TTL): void {
  // Implement LRU eviction if cache is full
  if (queryCache.size >= PERFORMANCE_THRESHOLDS.MAX_CACHE_SIZE) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) {
      queryCache.delete(oldestKey);
    }
  }

  queryCache.set(query, {
    query,
    results,
    timestamp: Date.now(),
    ttl
  });
}

/**
 * Clear query cache
 */
export function clearQueryCache(): void {
  queryCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; maxSize: number; hitRate: number } {
  return {
    size: queryCache.size,
    maxSize: PERFORMANCE_THRESHOLDS.MAX_CACHE_SIZE,
    hitRate: 0 // Would need to track hits/misses for accurate rate
  };
}

/**
 * Optimize search query based on performance characteristics
 */
export function optimizeSearchQuery(query: string): string {
  const parsed = parseSearchQuery(query);

  // For simple queries, ensure we use prefix matching
  if (parsed.complexity === 'simple' && parsed.terms.length === 1) {
    const term = parsed.terms[0];
    if (!term.endsWith('*') && !term.includes('~')) {
      return `${term}*`;
    }
  }

  // For complex queries, ensure proper boolean syntax
  if (parsed.complexity === 'complex') {
    // Add parentheses around phrases for better parsing
    return query.replace(/"([^"]+)"/g, '("$1")');
  }

  return query;
}

/**
 * Get recommended search limit based on query complexity
 */
export function getRecommendedSearchLimit(query: string): number {
  const parsed = parseSearchQuery(query);

  if (parsed.complexity === 'simple') {
    return PERFORMANCE_THRESHOLDS.SIMPLE_QUERY_LIMIT;
  } else {
    return PERFORMANCE_THRESHOLDS.COMPLEX_QUERY_LIMIT;
  }
}
