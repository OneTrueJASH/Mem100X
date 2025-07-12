/**
 * Context Confidence Scoring System
 * ML-like intelligence for automatic context detection
 * Blazing fast pattern matching with detailed scoring
 */

import { ContextScore, DatabaseConfig } from './types.js';

export class ContextConfidenceScorer {
  // Component weights (sum to 1.0) - tuned for optimal detection
  private readonly WEIGHTS = {
    entityExists: 0.25, // Entity already in context
    entityType: 0.3, // Entity type matches config
    keywordMatch: 0.35, // Keyword pattern matches
    relationContext: 0.05, // Related entities in context
    temporal: 0.05, // Recent activity bonus
  };

  // Confidence thresholds
  private readonly HIGH_CONFIDENCE = 0.5;
  private readonly MEDIUM_CONFIDENCE = 0.3;
  private readonly LOW_CONFIDENCE = 0.15;

  private contextPatterns: Map<string, RegExp[]> = new Map();
  private entityContextMap: Map<string, string> = new Map();
  private recentContexts: Array<{ context: string; timestamp: number }> = [];
  private readonly maxRecent = 100;

  constructor(
    private contextConfigs: Record<string, DatabaseConfig>,
    entityContextMap: Map<string, string>
  ) {
    this.entityContextMap = entityContextMap;
    this.compilePatterns();
  }

  private compilePatterns(): void {
    // Pre-compile regex patterns for blazing-fast matching
    for (const [context, config] of Object.entries(this.contextConfigs)) {
      const patterns = config.patterns.map((pattern) => new RegExp(`\\b${pattern}\\b`, 'i'));
      this.contextPatterns.set(context, patterns);
    }
  }

  scoreContexts(data: any, availableContexts: string[]): ContextScore[] {
    const scores: ContextScore[] = [];

    for (const context of availableContexts) {
      const score = this.scoreSingleContext(context, data);
      scores.push(score);
    }

    // Sort by confidence descending
    scores.sort((a, b) => b.confidence - a.confidence);

    // Update recent contexts if we have a clear winner
    if (scores.length > 0 && scores[0].confidence >= this.LOW_CONFIDENCE) {
      this.updateRecentContexts(scores[0].context);
    }

    return scores;
  }

  private scoreSingleContext(context: string, data: any): ContextScore {
    const breakdown: Record<string, number> = {
      entityExists: 0,
      entityType: 0,
      keywordMatch: 0,
      relationContext: 0,
      temporal: 0,
    };
    const evidence: string[] = [];

    // 1. Entity existence check (highest weight)
    if (data.entities) {
      for (const entity of data.entities) {
        const name = entity.name?.toLowerCase();
        if (name && this.entityContextMap.get(name) === context) {
          breakdown.entityExists = 1.0;
          evidence.push(`Entity '${name}' exists in ${context}`);
          break;
        }
      }
    }

    // 2. Entity type matching
    if (data.entities && this.contextConfigs[context]) {
      const configTypes = new Set(this.contextConfigs[context].entityTypes);
      let typeMatches = 0;

      for (const entity of data.entities) {
        if (entity.entityType && configTypes.has(entity.entityType.toLowerCase())) {
          typeMatches++;
          evidence.push(`Type '${entity.entityType}' matches ${context}`);
        }
      }

      if (data.entities.length > 0) {
        breakdown.entityType = typeMatches / data.entities.length;
      }
    }

    // 3. Keyword pattern matching
    const patterns = this.contextPatterns.get(context) || [];
    const searchTexts: string[] = [];

    // Collect all searchable text
    if (data.entities) {
      for (const entity of data.entities) {
        const text = [
          entity.name || '',
          entity.entityType || '',
          ...(entity.observations || []),
        ].join(' ');
        searchTexts.push(text);
      }
    }

    if (data.query) {
      searchTexts.push(data.query);
    }

    // Fast pattern matching
    const matchedPatterns = new Set<string>();
    const allText = searchTexts.join(' ').toLowerCase();

    for (const pattern of patterns) {
      if (pattern.test(allText)) {
        matchedPatterns.add(pattern.source);
        evidence.push(`Pattern '${pattern.source}' found`);
      }
    }

    if (patterns.length > 0) {
      // Score based on percentage of unique patterns matched
      breakdown.keywordMatch = matchedPatterns.size / patterns.length;
    }

    // 4. Relation context scoring
    if (data.relations) {
      let relationMatches = 0;

      for (const relation of data.relations) {
        const fromContext = this.entityContextMap.get(relation.from?.toLowerCase());
        const toContext = this.entityContextMap.get(relation.to?.toLowerCase());

        if (fromContext === context) {
          relationMatches += 0.5;
          evidence.push(`Relation from '${relation.from}' in ${context}`);
        }
        if (toContext === context) {
          relationMatches += 0.5;
          evidence.push(`Relation to '${relation.to}' in ${context}`);
        }
      }

      if (data.relations.length > 0) {
        breakdown.relationContext = Math.min(1.0, relationMatches / data.relations.length);
      }
    }

    // 5. Temporal scoring (recent usage)
    breakdown.temporal = this.calculateTemporalScore(context);
    if (breakdown.temporal > 0.5) {
      evidence.push('Recently used context');
    }

    // Calculate weighted total
    const totalScore = Object.entries(breakdown).reduce(
      (sum, [key, value]) => sum + value * this.WEIGHTS[key as keyof typeof this.WEIGHTS],
      0
    );

    const confidence = Math.min(1.0, totalScore);

    return {
      context,
      confidence,
      score: totalScore,
      breakdown,
      evidence,
    };
  }

  private calculateTemporalScore(context: string): number {
    if (this.recentContexts.length === 0) return 0;

    const now = Date.now();
    let recencyScore = 0;

    for (const recent of this.recentContexts) {
      if (recent.context === context) {
        // Exponential decay: half-life of 1 hour
        const timeDiff = (now - recent.timestamp) / 1000; // seconds
        const decayFactor = Math.pow(0.5, timeDiff / 3600);
        recencyScore += decayFactor;
      }
    }

    // Normalize to 0-1 range
    return Math.min(1.0, recencyScore / 3.0);
  }

  private updateRecentContexts(context: string): void {
    this.recentContexts.push({ context, timestamp: Date.now() });

    // Keep only recent entries
    if (this.recentContexts.length > this.maxRecent) {
      this.recentContexts = this.recentContexts.slice(-this.maxRecent);
    }

    // Remove entries older than 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.recentContexts = this.recentContexts.filter((r) => r.timestamp > cutoff);
  }

  getConfidenceLevel(confidence: number): string {
    if (confidence >= this.HIGH_CONFIDENCE) return 'high';
    if (confidence >= this.MEDIUM_CONFIDENCE) return 'medium';
    if (confidence >= this.LOW_CONFIDENCE) return 'low';
    return 'very_low';
  }

  shouldPromptUser(topScore: ContextScore, secondScore?: ContextScore): boolean {
    // Prompt if confidence is too low
    if (topScore.confidence < this.MEDIUM_CONFIDENCE) return true;

    // Prompt if second best is too close (within 10%)
    if (secondScore && topScore.confidence - secondScore.confidence < 0.1) return true;

    return false;
  }

  updateEntityContext(entityName: string, context: string): void {
    this.entityContextMap.set(entityName.toLowerCase(), context);
  }
}
