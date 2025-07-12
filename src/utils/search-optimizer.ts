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
}

export interface SearchResult {
  entity: any;
  relevance: number;
  highlights: string[];
  matchType: 'exact' | 'prefix' | 'fuzzy' | 'semantic';
}

/**
 * Parse and optimize search queries for FTS5
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

  return { original, terms, phrases, fuzzy, prefix };
}

/**
 * Build optimized FTS5 query string
 */
export function buildFTSQuery(searchQuery: SearchQuery): string {
  const parts: string[] = [];

  // Add exact phrases
  for (const phrase of searchQuery.phrases) {
    parts.push(`"${phrase}"`);
  }

  // Add individual terms with prefix matching
  for (const term of searchQuery.terms) {
    if (searchQuery.prefix) {
      parts.push(`${term}*`);
    } else if (searchQuery.fuzzy) {
      parts.push(`${term}~`);
    } else {
      parts.push(`"${term}"*`);
    }
  }

  return parts.join(' OR ');
}

/**
 * Calculate relevance score for search results
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

  return Math.min(score, 100.0); // Cap at 100
}

/**
 * Generate search highlights for results
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

  // Highlight observation matches (first 100 chars)
  const observationsText = JSON.stringify(entity.observations);
  if (observationsText.toLowerCase().includes(queryLower)) {
    const matchIndex = observationsText.toLowerCase().indexOf(queryLower);
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(observationsText.length, matchIndex + queryLower.length + 50);
    highlights.push(`Content: ...${observationsText.slice(start, end)}...`);
  }

  return highlights;
}

/**
 * Determine match type for search result
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
 * Sort search results by relevance
 */
export function sortByRelevance(results: SearchResult[]): SearchResult[] {
  return results.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Apply search filters and limits
 */
export function filterSearchResults(
  results: SearchResult[],
  options: {
    minRelevance?: number;
    maxResults?: number;
    entityTypes?: string[];
  }
): SearchResult[] {
  let filtered = results;

  // Filter by minimum relevance
  if (options.minRelevance) {
    filtered = filtered.filter(result => result.relevance >= options.minRelevance!);
  }

  // Filter by entity types
  if (options.entityTypes && options.entityTypes.length > 0) {
    filtered = filtered.filter(result =>
      options.entityTypes!.includes(result.entity.entity_type)
    );
  }

  // Apply result limit
  if (options.maxResults) {
    filtered = filtered.slice(0, options.maxResults);
  }

  return filtered;
}
