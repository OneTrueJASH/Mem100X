import { SearchOptions } from '../types.js';

export interface SearchIntent {
  intent: 'find' | 'browse' | 'explore' | 'verify';
  confidence: number;
  suggestions: string[];
}

export interface SearchSuggestion {
  query: string;
  type: 'spelling' | 'semantic' | 'contextual' | 'related';
  confidence: number;
}

/**
 * Analyze search intent based on query patterns and context
 */
export function analyzeSearchIntent(query: string): SearchIntent {
  const lowerQuery = query.toLowerCase();

  // Intent detection patterns
  const findPatterns = ['find', 'search', 'locate', 'where', 'what is', 'who is'];
  const browsePatterns = ['browse', 'show', 'list', 'all', 'everything'];
  const explorePatterns = ['explore', 'discover', 'related', 'similar', 'connections'];
  const verifyPatterns = ['verify', 'confirm', 'check', 'is this', 'does'];

  let intent: 'find' | 'browse' | 'explore' | 'verify' = 'find';
  let confidence = 0.5;
  const suggestions: string[] = [];

  // Check for explicit intent indicators
  if (findPatterns.some(pattern => lowerQuery.includes(pattern))) {
    intent = 'find';
    confidence = 0.8;
  } else if (browsePatterns.some(pattern => lowerQuery.includes(pattern))) {
    intent = 'browse';
    confidence = 0.8;
  } else if (explorePatterns.some(pattern => lowerQuery.includes(pattern))) {
    intent = 'explore';
    confidence = 0.8;
  } else if (verifyPatterns.some(pattern => lowerQuery.includes(pattern))) {
    intent = 'verify';
    confidence = 0.8;
  }

  // Analyze query complexity
  const words = query.split(/\s+/).length;
  if (words === 1) {
    confidence = Math.min(confidence + 0.1, 0.9);
    suggestions.push('Try adding more context to your search');
  } else if (words > 5) {
    confidence = Math.min(confidence + 0.1, 0.9);
    suggestions.push('Consider breaking down your search into smaller parts');
  }

  // Check for question patterns
  if (query.includes('?')) {
    intent = 'find';
    confidence = Math.min(confidence + 0.1, 0.9);
    suggestions.push('Questions are best answered with specific entity searches');
  }

  return { intent, confidence, suggestions };
}

/**
 * Generate search suggestions based on query and context
 */
export function generateSearchSuggestions(
  query: string,
  searchContext?: SearchOptions['searchContext']
): string[] {
  const suggestions: string[] = [];
  const lowerQuery = query.toLowerCase();

  // Spelling suggestions (simple implementation)
  const commonTypos: Record<string, string[]> = {
    'teh': ['the'],
    'recieve': ['receive'],
    'seperate': ['separate'],
    'occured': ['occurred'],
    'neccessary': ['necessary']
  };

  const words = query.split(/\s+/);
  for (const word of words) {
    const corrections = commonTypos[word.toLowerCase()];
    if (corrections) {
      for (const correction of corrections) {
        const newQuery = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), correction);
        suggestions.push(newQuery);
      }
    }
  }

  // Contextual suggestions based on search context
  if (searchContext?.currentEntities?.length) {
    for (const entity of searchContext.currentEntities.slice(0, 3)) {
      suggestions.push(`${query} ${entity}`);
      suggestions.push(`${entity} ${query}`);
    }
  }

  // Semantic suggestions based on query patterns
  if (lowerQuery.includes('person') || lowerQuery.includes('people')) {
    suggestions.push(query.replace(/\b(person|people)\b/gi, 'individual'));
    suggestions.push(query.replace(/\b(person|people)\b/gi, 'contact'));
  }

  if (lowerQuery.includes('company') || lowerQuery.includes('business')) {
    suggestions.push(query.replace(/\b(company|business)\b/gi, 'organization'));
    suggestions.push(query.replace(/\b(company|business)\b/gi, 'enterprise'));
  }

  // Add related terms
  const relatedTerms: Record<string, string[]> = {
    'meeting': ['appointment', 'call', 'discussion'],
    'project': ['task', 'work', 'assignment'],
    'document': ['file', 'report', 'paper'],
    'email': ['message', 'communication', 'correspondence']
  };

  for (const [term, related] of Object.entries(relatedTerms)) {
    if (lowerQuery.includes(term)) {
      for (const relatedTerm of related) {
        suggestions.push(query.replace(new RegExp(term, 'gi'), relatedTerm));
      }
    }
  }

  // Remove duplicates and limit results
  return [...new Set(suggestions)].slice(0, 10);
}

/**
 * Enhanced relevance calculation with context awareness
 */
export function calculateContextAwareRelevance(
  entity: any,
  searchQuery: any,
  ftsRank: number,
  searchContext?: SearchOptions['searchContext'],
  intent?: 'find' | 'browse' | 'explore' | 'verify'
): number {
  let relevance = ftsRank;

  // Base relevance from FTS
  relevance = Math.max(0.1, relevance);

  // Handle both raw database rows and processed entities
  const entityName = entity.name || entity.entity_name;
  const entityType = entity.entityType || entity.entity_type;
  const observations = entity.observations || [];

  // Context boost based on current entities
  if (searchContext?.currentEntities?.length) {
    const entityNameLower = entityName.toLowerCase();
    const currentEntities = searchContext.currentEntities.map(e => e.toLowerCase());

    // Direct match with current context
    if (currentEntities.includes(entityNameLower)) {
      relevance *= 2.0;
    }

    // Check for related entities in current context
    const relatedBoost = currentEntities.some(current =>
      entityNameLower.includes(current) || current.includes(entityNameLower)
    ) ? 1.5 : 1.0;
    relevance *= relatedBoost;
  }

  // User context boost
  if (searchContext?.userContext) {
    const contextBoost = {
      'work': 1.3,
      'personal': 1.2,
      'neutral': 1.0
    };
    relevance *= contextBoost[searchContext.userContext];
  }

  // Conversation context boost
  if (searchContext?.conversationContext) {
    const conversationLower = searchContext.conversationContext.toLowerCase();
    const entityNameLower = entityName.toLowerCase();

    if (conversationLower.includes(entityNameLower)) {
      relevance *= 1.4;
    }

    // Check entity observations for conversation context
    const observationText = Array.isArray(observations)
      ? observations
          .filter((obs: any) => obs.type === 'text')
          .map((obs: any) => obs.text.toLowerCase())
          .join(' ')
      : '';

    if (conversationLower.split(/\s+/).some(word =>
      observationText.includes(word) && word.length > 3
    )) {
      relevance *= 1.2;
    }
  }

  // Recent searches boost
  if (searchContext?.recentSearches?.length) {
    const entityNameLower = entityName.toLowerCase();
    const recentMatch = searchContext.recentSearches.some(search =>
      search.toLowerCase().includes(entityNameLower) ||
      entityNameLower.includes(search.toLowerCase())
    );

    if (recentMatch) {
      relevance *= 1.3;
    }
  }

  // Content type relevance
  if (searchQuery.contentTypes?.length && Array.isArray(observations)) {
    const hasMatchingContent = observations.some((obs: any) =>
      searchQuery.contentTypes.includes(obs.type)
    );

    if (hasMatchingContent) {
      relevance *= 1.2;
    }
  }

  // --- Recency and usage boosting ---
  // Boost by recency (last_accessed, updated_at)
  if ('last_accessed' in entity && typeof entity.last_accessed === 'number') {
    const now = Date.now() / 1000;
    const age = now - entity.last_accessed;
    relevance *= (1 + Math.max(0, 1 - age / (60 * 60 * 24 * 30))); // 1 month decay
  }
  if ('updated_at' in entity && typeof entity.updated_at === 'number') {
    const now = Date.now() / 1000;
    const age = now - entity.updated_at;
    relevance *= (1 + Math.max(0, 1 - age / (60 * 60 * 24 * 30)));
  }
  // Boost by usage (access_count, prominence_score)
  if ('access_count' in entity && typeof entity.access_count === 'number') {
    relevance *= (1 + Math.min(0.5, entity.access_count / 100));
  }
  if ('prominence_score' in entity && typeof entity.prominence_score === 'number') {
    relevance *= (1 + Math.min(0.5, entity.prominence_score / 100));
  }

  // --- Intent boosting ---
  if (intent) {
    if (intent === 'find' && entityName.toLowerCase() === (searchQuery.original || '').toLowerCase()) {
      relevance *= 1.5;
    }
    if (intent === 'browse') {
      relevance *= 1 + 0.1 * (observations.length || 1);
    }
    if (intent === 'explore') {
      relevance *= 1 + 0.1 * (observations.length || 1);
    }
    if (intent === 'verify' && entityName.toLowerCase().includes((searchQuery.original || '').toLowerCase())) {
      relevance *= 1.3;
    }
  }

  return Math.min(relevance, 10.0); // Cap at 10.0
}

/**
 * Generate context-aware highlights
 */
export function generateContextAwareHighlights(
  entity: any,
  searchQuery: any,
  searchContext?: SearchOptions['searchContext']
): string[] {
  const highlights: string[] = [];

  // Handle both raw database rows and processed entities
  const entityName = entity.name || entity.entity_name;
  const entityType = entity.entityType || entity.entity_type;
  const observations = entity.observations || [];

  // Basic term highlighting
  const queryTerms = searchQuery.terms || [];

  for (const term of queryTerms) {
    if (entityName.toLowerCase().includes(term.toLowerCase())) {
      highlights.push(`Entity name matches: "${term}"`);
    }
  }

  // Context highlighting
  if (searchContext?.currentEntities?.includes(entityName)) {
    highlights.push('Currently active entity');
  }

  if (searchContext?.userContext) {
    highlights.push(`Relevant for ${searchContext.userContext} context`);
  }

  // Content type highlighting
  const contentTypes = Array.isArray(observations)
    ? observations.map((obs: any) => obs.type)
    : [];
  const uniqueTypes = [...new Set(contentTypes)];
  if (uniqueTypes.length > 0) {
    highlights.push(`Contains: ${uniqueTypes.join(', ')} content`);
  }

  // Observation highlighting
  const textObservations = Array.isArray(observations)
    ? observations.filter((obs: any) => obs.type === 'text')
    : [];
  if (textObservations.length > 0) {
    const totalLength = textObservations.reduce((sum: number, obs: any) => sum + obs.text.length, 0);
    highlights.push(`${textObservations.length} text observations (${totalLength} chars)`);
  }

  return highlights;
}

/**
 * Analyze search query complexity and extract semantic information
 */
export function analyzeQueryComplexity(query: string): {
  complexity: 'simple' | 'moderate' | 'complex';
  semanticTerms: string[];
  contextHints: string[];
} {
  const words = query.split(/\s+/).length;
  const hasSpecialChars = /[^\w\s]/.test(query);
  const hasQuotes = query.includes('"') || query.includes("'");

  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (words > 3 || hasQuotes) complexity = 'moderate';
  if (words > 6 || (hasSpecialChars && words > 2)) complexity = 'complex';

  // Extract semantic terms (nouns, verbs, adjectives)
  const semanticTerms = query
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !['the', 'and', 'or', 'but', 'for', 'with', 'from'].includes(word.toLowerCase()));

  // Extract context hints
  const contextHints: string[] = [];
  if (query.includes('?')) contextHints.push('question');
  if (query.includes('"')) contextHints.push('exact_phrase');
  if (query.includes('*')) contextHints.push('wildcard');
  if (query.includes('AND') || query.includes('OR')) contextHints.push('boolean');

  return { complexity, semanticTerms, contextHints };
}
