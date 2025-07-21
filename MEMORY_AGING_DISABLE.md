# Memory Aging Disable Functionality

## Overview

This document describes the implementation of an option for users to disable memory aging functionality in Mem100x. When disabled, the system operates without memory aging features while maintaining all other functionality.

## Implementation Details

### 1. Configuration Structure

The memory aging configuration is now part of the main configuration system in `src/config.ts`:

```typescript
memoryAging: z.object({
  enabled: z.boolean().default(true),
  preset: z.enum(['conservative', 'balanced', 'aggressive', 'work_focused', 'personal_focused']).default('balanced'),
  customConfig: z.object({
    baseDecayRate: z.number().default(0.1),
    recencyBoostFactor: z.number().default(0.3),
    frequencyBoostFactor: z.number().default(0.2),
    halfLifeDays: z.number().default(30),
    minProminenceThreshold: z.number().default(0.1),
    maxProminence: z.number().default(10.0),
    agingIntervalHours: z.number().default(24),
    importanceWeightMultiplier: z.number().default(2.0),
  }).optional(),
})
```

### 2. Environment Variables

Users can configure memory aging through environment variables:

- `MEMORY_AGING_ENABLED`: Set to `false` to disable memory aging entirely
- `MEMORY_AGING_PRESET`: Choose from available presets
- `MEMORY_AGING_CUSTOM_CONFIG`: JSON string with custom configuration

### 3. Database Integration

The database constructor in `src/database.ts` now checks the configuration:

```typescript
// Initialize memory aging system based on configuration
if (config.memoryAging.enabled) {
  // Use preset configuration and initialize normally
  this.memoryAging = new MemoryAgingSystem(agingConfig);
} else {
  // Create a no-op memory aging system when disabled
  this.memoryAging = new MemoryAgingSystem({
    baseDecayRate: 0,
    recencyBoostFactor: 0,
    frequencyBoostFactor: 0,
    halfLifeDays: 999999,
    minProminenceThreshold: 0,
    maxProminence: 1.0,
    agingIntervalHours: 999999,
    importanceWeightMultiplier: 1.0,
  });
}
```

### 4. Method Updates

The following methods now check if memory aging is enabled before performing operations:

- `updateEntityAccess()`: Skips access tracking when disabled
- `searchNodesWithAging()`: Returns unmodified search results when disabled
- `runMemoryAging()`: Skips aging calculations when disabled
- `getEntity()`: Still tracks access when enabled, but skips when disabled

## Usage Examples

### Disable Memory Aging

```bash
# Set environment variable
export MEMORY_AGING_ENABLED=false

# Or in .env file
MEMORY_AGING_ENABLED=false
```

### Change Preset

```bash
# Conservative: Memories last longer (60-day half-life)
export MEMORY_AGING_PRESET=conservative

# Aggressive: Memories fade faster (15-day half-life)
export MEMORY_AGING_PRESET=aggressive

# Work-focused: Work memories last longer (90-day half-life)
export MEMORY_AGING_PRESET=work_focused

# Personal-focused: Personal memories more prominent (45-day half-life)
export MEMORY_AGING_PRESET=personal_focused
```

### Custom Configuration

```bash
# Custom aging parameters
export MEMORY_AGING_CUSTOM_CONFIG='{"baseDecayRate": 0.05, "halfLifeDays": 60, "maxProminence": 15.0}'
```

## Behavior When Disabled

When memory aging is disabled:

1. **No Access Tracking**: Entity access is not tracked or logged
2. **No Prominence Calculations**: All entities maintain equal prominence (1.0)
3. **No Aging Runs**: Manual and automatic aging calculations are skipped
4. **Equal Search Results**: Search results are not boosted by prominence
5. **Normal Database Operations**: All other functionality continues normally
6. **Performance**: Slightly better performance due to reduced calculations

## Benefits

1. **User Choice**: Users can choose whether to use memory aging features
2. **Performance**: Disabled mode provides better performance for users who don't need aging
3. **Simplicity**: Users who prefer simpler memory management can disable complexity
4. **Compatibility**: Existing databases continue to work with aging disabled
5. **Flexibility**: Easy to enable/disable without code changes

## Configuration Documentation

The `env.example` file has been updated with memory aging configuration options and examples for different use cases.

## Testing

The implementation has been tested to ensure:

- Configuration loads correctly from environment variables
- Database initializes properly with aging disabled
- All methods respect the disabled setting
- No errors occur when aging is disabled
- Performance is maintained in disabled mode 
