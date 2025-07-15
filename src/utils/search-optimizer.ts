/**
 * Enhanced search optimization utilities for FTS5
 * Provides better query parsing, ranking, and semantic search capabilities
 */

export interface SearchQuery {
  original: string;
  terms: string[];
  phrases: string[];
  fuzzy: boolean;
  prefix: boolean;
  complexity: 'simple' | 'complex';
  estimatedCost: number;
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

  // Analyze query complexity
  const complexity = analyzeQueryComplexity(original);
  const estimatedCost = estimateQueryCost(original, terms.length, phrases.length);

  return { original, terms, phrases, fuzzy, prefix, complexity, estimatedCost };
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
 * Calculate relevance score for search results with enhanced scoring
 */
export function calculateRelevance(
  entity: any,
  searchQuery: SearchQuery,
  rank: number
): number {
  let score = 1.0 / (rank + 1); // Base score from FTS5 rank

  // Boost exact name matches
  const nameLower = entity.name.toLowerCase();
  const queryLower = searchQuery.original.toLowerCase();

  if (nameLower === queryLower) {
    score *= 10.0; // Exact name match
  } else if (nameLower.startsWith(queryLower)) {
    score *= 5.0; // Name starts with query
  } else if (nameLower.includes(queryLower)) {
    score *= 3.0; // Name contains query
  }

  // Boost entity type matches
  if (entity.entity_type.toLowerCase().includes(queryLower)) {
    score *= 2.0;
  }

  // Boost recent entities
  const daysSinceUpdate = (Date.now() / 1000 / 86400) - entity.updated_at;
  if (daysSinceUpdate < 7) {
    score *= 1.2; // Recent entities get slight boost
  }

  // Penalize very old entities
  if (daysSinceUpdate > 365) {
    score *= 0.8;
  }

  // Boost entities with more observations (more content)
  if (entity.observations && Array.isArray(entity.observations)) {
    const observationCount = entity.observations.length;
    if (observationCount > 5) {
      score *= 1.1; // Entities with more content get slight boost
    }
  }

  return Math.min(score, 100.0); // Cap at 100
}

/**
 * Generate search highlights for results with improved formatting
 */
export function generateHighlights(
  entity: any,
  searchQuery: SearchQuery
): string[] {
  const highlights: string[] = [];
  const queryLower = searchQuery.original.toLowerCase();

  // Highlight name matches
  if (entity.name.toLowerCase().includes(queryLower)) {
    highlights.push(`Name: ${entity.name}`);
  }

  // Highlight entity type matches
  if (entity.entity_type.toLowerCase().includes(queryLower)) {
    highlights.push(`Type: ${entity.entity_type}`);
  }

  // Highlight observation matches with better context
  if (entity.observations && Array.isArray(entity.observations)) {
    for (const obs of entity.observations) {
      if (obs.type === 'text' && obs.text) {
        const textLower = obs.text.toLowerCase();
        if (textLower.includes(queryLower)) {
          const matchIndex = textLower.indexOf(queryLower);
          const start = Math.max(0, matchIndex - 50);
          const end = Math.min(obs.text.length, matchIndex + queryLower.length + 50);
          const snippet = obs.text.slice(start, end);
          highlights.push(`Content: ...${snippet}...`);
          break; // Only show first match
        }
      }
    }
  }

  return highlights;
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
