/**
 * Intelligent Memory Aging System
 *
 * Implements human-like memory patterns:
 * - Usage-based prominence (frequently accessed memories stay fresh)
 * - Natural decay (unused memories fade over time)
 * - Recency effects (recent memories are more prominent)
 * - Importance weighting (user-defined importance affects aging)
 * - Adaptive decay rates (different entities decay at different rates)
 */

export interface MemoryAgingConfig {
  // Base decay rate (per day) - how quickly memories fade
  baseDecayRate: number;

  // Recency boost factor - how much recent access boosts prominence
  recencyBoostFactor: number;

  // Frequency boost factor - how much frequent access boosts prominence
  frequencyBoostFactor: number;

  // Half-life in days - time for prominence to decay by 50%
  halfLifeDays: number;

  // Minimum prominence threshold - memories below this are considered "forgotten"
  minProminenceThreshold: number;

  // Maximum prominence - cap on how prominent a memory can become
  maxProminence: number;

  // Aging interval in hours - how often to run aging calculations
  agingIntervalHours: number;

  // Importance weight multiplier - how much user-defined importance affects aging
  importanceWeightMultiplier: number;
}

export interface AgingStats {
  totalEntities: number;
  activeEntities: number;
  forgottenEntities: number;
  averageProminence: number;
  averageAccessCount: number;
  lastAgingRun: number;
  agingCycles: number;
}

export interface ProminenceScore {
  score: number;
  factors: {
    recency: number;
    frequency: number;
    importance: number;
    decay: number;
  };
  lastCalculated: number;
}

export class MemoryAgingSystem {
  private config: MemoryAgingConfig;
  private lastAgingRun: number = 0;
  private agingCycles: number = 0;

  constructor(config: Partial<MemoryAgingConfig> = {}) {
    this.config = {
      baseDecayRate: 0.1,
      recencyBoostFactor: 0.3,
      frequencyBoostFactor: 0.2,
      halfLifeDays: 30,
      minProminenceThreshold: 0.1,
      maxProminence: 10.0,
      agingIntervalHours: 24,
      importanceWeightMultiplier: 2.0,
      ...config
    };
  }

  /**
   * Calculate prominence score for an entity based on usage patterns
   */
  calculateProminenceScore(
    accessCount: number,
    lastAccessed: number,
    importanceWeight: number = 1.0,
    currentTime: number = Date.now()
  ): ProminenceScore {
    const now = currentTime;
    const daysSinceLastAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);

    // Recency factor (exponential decay)
    const recencyFactor = Math.exp(-this.config.baseDecayRate * daysSinceLastAccess);

    // Frequency factor (logarithmic growth with diminishing returns)
    const frequencyFactor = Math.log(1 + accessCount) / Math.log(10);

    // Importance factor (user-defined importance)
    const importanceFactor = Math.min(importanceWeight * this.config.importanceWeightMultiplier, this.config.maxProminence);

    // Decay factor (natural decay over time)
    const decayFactor = Math.pow(0.5, daysSinceLastAccess / this.config.halfLifeDays);

    // Calculate composite prominence score
    const prominenceScore = (
      recencyFactor * this.config.recencyBoostFactor +
      frequencyFactor * this.config.frequencyBoostFactor +
      importanceFactor * 0.3 +
      decayFactor * 0.2
    );

    // Apply bounds
    const boundedScore = Math.max(
      this.config.minProminenceThreshold,
      Math.min(this.config.maxProminence, prominenceScore)
    );

    return {
      score: boundedScore,
      factors: {
        recency: recencyFactor,
        frequency: frequencyFactor,
        importance: importanceFactor,
        decay: decayFactor
      },
      lastCalculated: now
    };
  }

  /**
   * Update entity access tracking and recalculate prominence
   */
  updateEntityAccess(
    currentAccessCount: number,
    currentLastAccessed: number,
    currentProminence: number,
    importanceWeight: number = 1.0
  ): {
    newAccessCount: number;
    newLastAccessed: number;
    newProminence: number;
  } {
    const now = Date.now();
    const newAccessCount = currentAccessCount + 1;
    const newLastAccessed = now;

    const prominenceResult = this.calculateProminenceScore(
      newAccessCount,
      newLastAccessed,
      importanceWeight,
      now
    );

    return {
      newAccessCount,
      newLastAccessed,
      newProminence: prominenceResult.score
    };
  }

  /**
   * Calculate aging for all entities (batch processing)
   */
  calculateAgingForEntities(
    entities: Array<{
      name: string;
      accessCount: number;
      lastAccessed: number;
      prominenceScore: number;
      importanceWeight: number;
    }>
  ): Array<{
    name: string;
    newProminence: number;
    isForgotten: boolean;
    agingFactors: ProminenceScore['factors'];
  }> {
    const now = Date.now();
    const results = [];

    for (const entity of entities) {
      const prominenceResult = this.calculateProminenceScore(
        entity.accessCount,
        entity.lastAccessed,
        entity.importanceWeight,
        now
      );

      const isForgotten = prominenceResult.score <= this.config.minProminenceThreshold;

      results.push({
        name: entity.name,
        newProminence: prominenceResult.score,
        isForgotten,
        agingFactors: prominenceResult.factors
      });
    }

    return results;
  }

  /**
   * Get aging-aware search boost for entities
   * Higher prominence entities get search boost
   */
  getSearchBoost(prominenceScore: number): number {
    // Normalize prominence to 0-1 range for search boost
    const normalizedProminence = (prominenceScore - this.config.minProminenceThreshold) /
      (this.config.maxProminence - this.config.minProminenceThreshold);

    // Apply sigmoid function for smooth boost curve
    return 1.0 + (2.0 * normalizedProminence) / (1.0 + Math.exp(-3 * (normalizedProminence - 0.5)));
  }

  /**
   * Check if aging should be run based on interval
   */
  shouldRunAging(): boolean {
    const now = Date.now();
    const hoursSinceLastRun = (now - this.lastAgingRun) / (1000 * 60 * 60);
    return hoursSinceLastRun >= this.config.agingIntervalHours;
  }

  /**
   * Mark aging as completed
   */
  markAgingCompleted(): void {
    this.lastAgingRun = Date.now();
    this.agingCycles++;
  }

  /**
   * Get aging statistics
   */
  getAgingStats(entities: Array<{ prominenceScore: number; accessCount: number }>): AgingStats {
    const totalEntities = entities.length;
    const activeEntities = entities.filter(e => e.prominenceScore > this.config.minProminenceThreshold).length;
    const forgottenEntities = totalEntities - activeEntities;

    const averageProminence = entities.reduce((sum, e) => sum + e.prominenceScore, 0) / totalEntities;
    const averageAccessCount = entities.reduce((sum, e) => sum + e.accessCount, 0) / totalEntities;

    return {
      totalEntities,
      activeEntities,
      forgottenEntities,
      averageProminence,
      averageAccessCount,
      lastAgingRun: this.lastAgingRun,
      agingCycles: this.agingCycles
    };
  }

  /**
   * Get configuration
   */
  getConfig(): MemoryAgingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MemoryAgingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Calculate memory retention curve (for analysis)
   */
  calculateRetentionCurve(
    accessCount: number,
    importanceWeight: number = 1.0,
    daysRange: number = 365
  ): Array<{ days: number; prominence: number }> {
    const curve = [];
    const now = Date.now();

    for (let days = 0; days <= daysRange; days += 7) { // Weekly points
      const lastAccessed = now - (days * 24 * 60 * 60 * 1000);
      const prominenceResult = this.calculateProminenceScore(
        accessCount,
        lastAccessed,
        importanceWeight,
        now
      );

      curve.push({
        days,
        prominence: prominenceResult.score
      });
    }

    return curve;
  }

  /**
   * Get recommended importance weight based on entity characteristics
   */
  getRecommendedImportanceWeight(
    entityType: string,
    contentLength: number,
    relationCount: number
  ): number {
    let weight = 1.0;

    // Entity type importance
    const typeWeights: Record<string, number> = {
      'person': 1.5,
      'project': 1.3,
      'company': 1.2,
      'technology': 1.1,
      'document': 1.0,
      'meeting': 1.4,
      'task': 1.3,
      'idea': 1.2
    };

    weight *= typeWeights[entityType] || 1.0;

    // Content richness
    if (contentLength > 1000) weight *= 1.2;
    if (contentLength > 5000) weight *= 1.1;

    // Connectivity importance
    if (relationCount > 10) weight *= 1.3;
    if (relationCount > 50) weight *= 1.2;

    return Math.min(weight, this.config.maxProminence);
  }
}

/**
 * Memory aging configuration presets
 */
export const MEMORY_AGING_PRESETS = {
  // Conservative aging - memories last longer
  CONSERVATIVE: {
    baseDecayRate: 0.05,
    recencyBoostFactor: 0.4,
    frequencyBoostFactor: 0.3,
    halfLifeDays: 60,
    minProminenceThreshold: 0.05,
    maxProminence: 15.0,
    agingIntervalHours: 48,
    importanceWeightMultiplier: 3.0
  },

  // Balanced aging - default human-like behavior
  BALANCED: {
    baseDecayRate: 0.1,
    recencyBoostFactor: 0.3,
    frequencyBoostFactor: 0.2,
    halfLifeDays: 30,
    minProminenceThreshold: 0.1,
    maxProminence: 10.0,
    agingIntervalHours: 24,
    importanceWeightMultiplier: 2.0
  },

  // Aggressive aging - memories fade faster
  AGGRESSIVE: {
    baseDecayRate: 0.2,
    recencyBoostFactor: 0.2,
    frequencyBoostFactor: 0.1,
    halfLifeDays: 15,
    minProminenceThreshold: 0.2,
    maxProminence: 5.0,
    agingIntervalHours: 12,
    importanceWeightMultiplier: 1.5
  },

  // Work-focused - work memories last longer
  WORK_FOCUSED: {
    baseDecayRate: 0.05,
    recencyBoostFactor: 0.35,
    frequencyBoostFactor: 0.25,
    halfLifeDays: 90,
    minProminenceThreshold: 0.08,
    maxProminence: 12.0,
    agingIntervalHours: 36,
    importanceWeightMultiplier: 2.5
  },

  // Personal-focused - personal memories are more prominent
  PERSONAL_FOCUSED: {
    baseDecayRate: 0.08,
    recencyBoostFactor: 0.4,
    frequencyBoostFactor: 0.3,
    halfLifeDays: 45,
    minProminenceThreshold: 0.06,
    maxProminence: 15.0,
    agingIntervalHours: 24,
    importanceWeightMultiplier: 3.0
  }
};
