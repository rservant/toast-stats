# Unified BackfillService Usage Examples

This document provides comprehensive examples for using the Unified BackfillService in various scenarios.

## Table of Contents

1. [Basic Usage Examples](#basic-usage-examples)
2. [Advanced Configuration Examples](#advanced-configuration-examples)
3. [Error Handling Examples](#error-handling-examples)
4. [Performance Optimization Examples](#performance-optimization-examples)
5. [Frontend Integration Examples](#frontend-integration-examples)
6. [Monitoring and Debugging Examples](#monitoring-and-debugging-examples)

## Basic Usage Examples

### Example 1: Simple System-Wide Backfill

Backfill the last 30 days for all configured districts using default settings.

**HTTP Request:**

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-30"
  }'
```

**TypeScript/JavaScript:**

```typescript
import { BackfillService } from './services/UnifiedBackfillService.js'

const service = new BackfillService(
  refreshService,
  snapshotStore,
  configService
)

async function simpleBackfill() {
  try {
    const backfillId = await service.initiateBackfill({
      startDate: '2024-01-01',
      endDate: '2024-01-30',
    })

    console.log(`Backfill started with ID: ${backfillId}`)

    // Monitor progress
    const status = service.getBackfillStatus(backfillId)
    console.log(
      `Progress: ${status?.progress.completed}/${status?.progress.total}`
    )
  } catch (error) {
    console.error('Backfill failed:', error.message)
  }
}
```

### Example 2: Single District Backfill

Backfill data for a specific district with detailed collection.

**HTTP Request:**

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-07-01",
    "endDate": "2024-12-31",
    "targetDistricts": ["42"],
    "collectionType": "per-district"
  }'
```

**TypeScript/JavaScript:**

```typescript
async function singleDistrictBackfill() {
  const backfillId = await service.initiateBackfill({
    startDate: '2024-07-01',
    endDate: '2024-12-31',
    targetDistricts: ['42'],
    collectionType: 'per-district',
  })

  console.log(`Single district backfill started: ${backfillId}`)
}
```

### Example 3: Multiple Districts Backfill

Backfill specific districts with automatic strategy selection.

**HTTP Request:**

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "targetDistricts": ["42", "15", "73", "28"],
    "collectionType": "auto"
  }'
```

**TypeScript/JavaScript:**

```typescript
async function multipleDistrictsBackfill() {
  const backfillId = await service.initiateBackfill({
    startDate: '2024-01-01',
    targetDistricts: ['42', '15', '73', '28'],
    collectionType: 'auto', // Service will choose optimal strategy
  })

  console.log(`Multi-district backfill started: ${backfillId}`)
}
```

## Advanced Configuration Examples

### Example 4: High-Performance Backfill

Configure backfill for maximum performance with custom settings.

**HTTP Request:**

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "targetDistricts": ["42", "15"],
    "concurrency": 8,
    "rateLimitDelayMs": 1000,
    "enableCaching": true,
    "cacheKeyPrefix": "priority",
    "retryFailures": true,
    "skipExisting": true
  }'
```

**TypeScript/JavaScript:**

```typescript
async function highPerformanceBackfill() {
  const backfillId = await service.initiateBackfill({
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    targetDistricts: ['42', '15'],
    concurrency: 8, // Higher concurrency
    rateLimitDelayMs: 1000, // Faster rate limiting
    enableCaching: true, // Enable caching
    cacheKeyPrefix: 'priority', // Custom cache prefix
    retryFailures: true, // Retry failed operations
    skipExisting: true, // Skip already cached dates
  })

  console.log(`High-performance backfill started: ${backfillId}`)

  // Monitor performance metrics
  const performanceStatus = service.getPerformanceStatus()
  console.log('Performance Status:', performanceStatus)
}
```

### Example 5: Conservative Backfill

Configure backfill for reliability over speed.

**HTTP Request:**

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "concurrency": 1,
    "rateLimitDelayMs": 5000,
    "retryFailures": true,
    "enableCaching": false
  }'
```

**TypeScript/JavaScript:**

```typescript
async function conservativeBackfill() {
  const backfillId = await service.initiateBackfill({
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    concurrency: 1, // Single-threaded processing
    rateLimitDelayMs: 5000, // Conservative rate limiting
    retryFailures: true, // Enable retries
    enableCaching: false, // Disable caching for fresh data
  })

  console.log(`Conservative backfill started: ${backfillId}`)
}
```

## Error Handling Examples

### Example 6: Comprehensive Error Handling

Handle various error scenarios with detailed error information.

**TypeScript/JavaScript:**

```typescript
async function robustBackfill() {
  try {
    const backfillId = await service.initiateBackfill({
      startDate: '2024-01-01',
      endDate: '2024-01-30',
      targetDistricts: ['42', '15', '73'],
    })

    console.log(`Backfill started: ${backfillId}`)

    // Poll for completion with error handling
    let attempts = 0
    const maxAttempts = 300 // 10 minutes at 2-second intervals

    while (attempts < maxAttempts) {
      try {
        const status = service.getBackfillStatus(backfillId)

        if (!status) {
          console.error('Backfill job not found')
          break
        }

        console.log(
          `Status: ${status.status}, Progress: ${status.progress.completed}/${status.progress.total}`
        )

        // Handle different status types
        switch (status.status) {
          case 'complete':
            console.log('Backfill completed successfully!')
            console.log(`Created ${status.snapshotIds.length} snapshots`)
            return

          case 'partial_success':
            console.log('Backfill completed with some issues')
            if (status.errorSummary) {
              console.log(
                `Errors: ${status.errorSummary.totalErrors} total, ${status.errorSummary.retryableErrors} retryable`
              )
              console.log(
                `Affected districts: ${status.errorSummary.affectedDistricts.join(', ')}`
              )
            }
            return

          case 'error':
            console.error(`Backfill failed: ${status.error}`)
            return

          case 'cancelled':
            console.log('Backfill was cancelled')
            return

          case 'processing':
            // Show detailed progress
            if (status.progress.failed > 0) {
              console.warn(`${status.progress.failed} operations have failed`)
            }
            if (status.progress.partialSnapshots > 0) {
              console.warn(
                `${status.progress.partialSnapshots} partial snapshots created`
              )
            }
            break
        }

        await new Promise(resolve => setTimeout(resolve, 2000))
        attempts++
      } catch (error) {
        console.error('Error checking status:', error.message)
        await new Promise(resolve => setTimeout(resolve, 5000)) // Wait longer on error
        attempts++
      }
    }

    console.error('Backfill monitoring timed out')
  } catch (error) {
    if (error.response?.data?.error) {
      const apiError = error.response.data.error
      console.error(`API Error [${apiError.code}]: ${apiError.message}`)
      if (apiError.suggestions) {
        console.log('Suggestions:', apiError.suggestions.join(', '))
      }
    } else {
      console.error('Unexpected error:', error.message)
    }
  }
}
```

### Example 7: Handling Partial Snapshots

Process and analyze partial snapshot results.

**TypeScript/JavaScript:**

```typescript
async function handlePartialSnapshots() {
  const backfillId = await service.initiateBackfill({
    startDate: '2024-01-01',
    endDate: '2024-01-30',
    targetDistricts: ['42', '15', '73', '28', '91'],
  })

  // Wait for completion
  let status
  do {
    await new Promise(resolve => setTimeout(resolve, 3000))
    status = service.getBackfillStatus(backfillId)
  } while (status?.status === 'processing')

  if (status?.partialSnapshots && status.partialSnapshots.length > 0) {
    console.log(`Found ${status.partialSnapshots.length} partial snapshots`)

    for (const partial of status.partialSnapshots) {
      console.log(`Snapshot ${partial.snapshotId}:`)
      console.log(`  Success rate: ${Math.round(partial.successRate * 100)}%`)
      console.log(
        `  Successful districts: ${partial.successfulDistricts.join(', ')}`
      )
      console.log(`  Failed districts: ${partial.failedDistricts.join(', ')}`)

      // Analyze errors
      const errorsByType = partial.errors.reduce(
        (acc, error) => {
          acc[error.errorType] = (acc[error.errorType] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      console.log('  Error breakdown:', errorsByType)
    }
  }
}
```

## Performance Optimization Examples

### Example 8: Dynamic Performance Tuning

Adjust performance settings based on system load and results.

**TypeScript/JavaScript:**

```typescript
async function dynamicPerformanceTuning() {
  // Start with conservative settings
  let concurrency = 2
  let rateLimitDelay = 3000

  const backfillId = await service.initiateBackfill({
    startDate: '2024-01-01',
    endDate: '2024-01-30',
    concurrency,
    rateLimitDelayMs: rateLimitDelay,
    enableCaching: true,
  })

  console.log(`Started backfill with concurrency: ${concurrency}`)

  let lastCompleted = 0
  let stagnantCount = 0

  while (true) {
    await new Promise(resolve => setTimeout(resolve, 10000)) // Check every 10 seconds

    const status = service.getBackfillStatus(backfillId)
    if (!status || status.status !== 'processing') break

    const performanceStatus = service.getPerformanceStatus()

    // Check if progress is stagnant
    if (status.progress.completed === lastCompleted) {
      stagnantCount++
    } else {
      stagnantCount = 0
      lastCompleted = status.progress.completed
    }

    // Adjust performance based on metrics
    if (stagnantCount >= 3) {
      // Progress is stagnant, try to optimize
      if (
        performanceStatus.concurrencyLimiter.queueLength === 0 &&
        concurrency < 5
      ) {
        // No queue, can increase concurrency
        concurrency++
        service.updatePerformanceSettings({ concurrencyLimit: concurrency })
        console.log(`Increased concurrency to ${concurrency}`)
      } else if (
        performanceStatus.rateLimiter.currentCount <
        performanceStatus.rateLimiter.maxRequests / 2
      ) {
        // Rate limiter not saturated, can reduce delay
        rateLimitDelay = Math.max(1000, rateLimitDelay - 500)
        service.updatePerformanceSettings({ rateLimitDelayMs: rateLimitDelay })
        console.log(`Reduced rate limit delay to ${rateLimitDelay}ms`)
      }
      stagnantCount = 0
    }

    // Monitor error rates
    if (status.progress.totalErrors > status.progress.completed * 0.1) {
      // High error rate, be more conservative
      if (concurrency > 1) {
        concurrency--
        service.updatePerformanceSettings({ concurrencyLimit: concurrency })
        console.log(
          `Reduced concurrency to ${concurrency} due to high error rate`
        )
      }
    }

    console.log(
      `Progress: ${status.progress.completed}/${status.progress.total}, ` +
        `Cache hit rate: ${Math.round(performanceStatus.intermediateCache.hitRate * 100)}%`
    )
  }
}
```

### Example 9: Cache Optimization

Optimize caching for repeated operations.

**TypeScript/JavaScript:**

```typescript
async function optimizedCaching() {
  // First pass - populate cache
  console.log('First pass: Populating cache...')
  const firstBackfillId = await service.initiateBackfill({
    startDate: '2024-01-01',
    endDate: '2024-01-15',
    targetDistricts: ['42', '15'],
    enableCaching: true,
    cacheKeyPrefix: 'initial',
    concurrency: 3,
  })

  // Wait for completion
  let status
  do {
    await new Promise(resolve => setTimeout(resolve, 2000))
    status = service.getBackfillStatus(firstBackfillId)
  } while (status?.status === 'processing')

  console.log('First pass completed')

  // Second pass - should benefit from cache
  console.log('Second pass: Leveraging cache...')
  const secondBackfillId = await service.initiateBackfill({
    startDate: '2024-01-01',
    endDate: '2024-01-30', // Overlapping range
    targetDistricts: ['42', '15', '73'], // Some same districts
    enableCaching: true,
    cacheKeyPrefix: 'initial', // Same cache prefix
    concurrency: 5, // Can be more aggressive with cache
  })

  // Monitor cache performance
  const startTime = Date.now()
  do {
    await new Promise(resolve => setTimeout(resolve, 2000))
    status = service.getBackfillStatus(secondBackfillId)

    const performanceStatus = service.getPerformanceStatus()
    console.log(
      `Cache hit rate: ${Math.round(performanceStatus.intermediateCache.hitRate * 100)}%`
    )
  } while (status?.status === 'processing')

  const duration = Date.now() - startTime
  console.log(`Second pass completed in ${duration}ms`)

  // Compare performance
  const finalPerformanceStatus = service.getPerformanceStatus()
  console.log(`Final cache stats:`)
  console.log(
    `  Hit rate: ${Math.round(finalPerformanceStatus.intermediateCache.hitRate * 100)}%`
  )
  console.log(
    `  Entries: ${finalPerformanceStatus.intermediateCache.entryCount}`
  )
  console.log(
    `  Size: ${Math.round(finalPerformanceStatus.intermediateCache.sizeBytes / 1024)}KB`
  )
}
```

## Frontend Integration Examples

### Example 10: React Component Integration

Complete React component with advanced features.

**TypeScript/React:**

```typescript
import React, { useState, useEffect } from 'react'
import { useInitiateBackfill, useBackfillStatus, useCancelBackfill } from '../hooks/useBackfill'

interface AdvancedBackfillComponentProps {
  onComplete?: (backfillId: string, snapshotIds: string[]) => void
  onError?: (error: string) => void
}

export function AdvancedBackfillComponent({ onComplete, onError }: AdvancedBackfillComponentProps) {
  const [backfillId, setBackfillId] = useState<string | null>(null)
  const [config, setConfig] = useState({
    startDate: '',
    endDate: '',
    targetDistricts: [] as string[],
    collectionType: 'auto' as const,
    concurrency: 3,
    enableCaching: true,
    retryFailures: true
  })

  const initiateMutation = useInitiateBackfill()
  const cancelMutation = useCancelBackfill()
  const { data: status, isError } = useBackfillStatus(backfillId, !!backfillId)

  // Handle completion
  useEffect(() => {
    if (status?.status === 'complete' || status?.status === 'partial_success') {
      onComplete?.(status.backfillId, status.snapshotIds)
    } else if (status?.status === 'error') {
      onError?.(status.error || 'Backfill failed')
    }
  }, [status?.status, onComplete, onError])

  const handleStart = async () => {
    try {
      const result = await initiateMutation.mutateAsync(config)
      setBackfillId(result.backfillId)
    } catch (error) {
      onError?.(error.message)
    }
  }

  const handleCancel = async () => {
    if (backfillId) {
      try {
        await cancelMutation.mutateAsync(backfillId)
        setBackfillId(null)
      } catch (error) {
        onError?.(error.message)
      }
    }
  }

  const progressPercentage = status
    ? Math.round((status.progress.completed / status.progress.total) * 100)
    : 0

  return (
    <div className="backfill-component">
      <h3>Advanced Backfill Configuration</h3>

      {!backfillId ? (
        <div className="config-form">
          <div>
            <label>Start Date:</label>
            <input
              type="date"
              value={config.startDate}
              onChange={e => setConfig(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>

          <div>
            <label>End Date:</label>
            <input
              type="date"
              value={config.endDate}
              onChange={e => setConfig(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>

          <div>
            <label>Target Districts (comma-separated):</label>
            <input
              type="text"
              value={config.targetDistricts.join(', ')}
              onChange={e => setConfig(prev => ({
                ...prev,
                targetDistricts: e.target.value.split(',').map(d => d.trim()).filter(d => d)
              }))}
              placeholder="e.g., 42, 15, 73"
            />
          </div>

          <div>
            <label>Collection Type:</label>
            <select
              value={config.collectionType}
              onChange={e => setConfig(prev => ({
                ...prev,
                collectionType: e.target.value as 'auto' | 'system-wide' | 'per-district'
              }))}
            >
              <option value="auto">Auto</option>
              <option value="system-wide">System-wide</option>
              <option value="per-district">Per-district</option>
            </select>
          </div>

          <div>
            <label>Concurrency: {config.concurrency}</label>
            <input
              type="range"
              min="1"
              max="10"
              value={config.concurrency}
              onChange={e => setConfig(prev => ({ ...prev, concurrency: parseInt(e.target.value) }))}
            />
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={config.enableCaching}
                onChange={e => setConfig(prev => ({ ...prev, enableCaching: e.target.checked }))}
              />
              Enable Caching
            </label>
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={config.retryFailures}
                onChange={e => setConfig(prev => ({ ...prev, retryFailures: e.target.checked }))}
              />
              Retry Failures
            </label>
          </div>

          <button
            onClick={handleStart}
            disabled={!config.startDate || initiateMutation.isPending}
          >
            {initiateMutation.isPending ? 'Starting...' : 'Start Backfill'}
          </button>
        </div>
      ) : (
        <div className="progress-display">
          <h4>Backfill Progress</h4>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p>{progressPercentage}% Complete</p>

          {status && (
            <div className="status-details">
              <p>Status: {status.status}</p>
              <p>Progress: {status.progress.completed} / {status.progress.total}</p>
              <p>Current: {status.progress.current}</p>

              {status.progress.failed > 0 && (
                <p className="error">Failed: {status.progress.failed}</p>
              )}

              {status.progress.partialSnapshots > 0 && (
                <p className="warning">Partial snapshots: {status.progress.partialSnapshots}</p>
              )}

              {status.performanceStatus && (
                <div className="performance-status">
                  <h5>Performance Status</h5>
                  <p>Cache hit rate: {Math.round(status.performanceStatus.intermediateCache.hitRate * 100)}%</p>
                  <p>Active slots: {status.performanceStatus.concurrencyLimiter.activeSlots} / {status.performanceStatus.concurrencyLimiter.maxConcurrent}</p>
                  <p>Rate limit: {status.performanceStatus.rateLimiter.currentCount} / {status.performanceStatus.rateLimiter.maxRequests}</p>
                </div>
              )}
            </div>
          )}

          {status?.status === 'processing' && (
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
            </button>
          )}

          {(status?.status === 'complete' || status?.status === 'partial_success' || status?.status === 'error') && (
            <button onClick={() => setBackfillId(null)}>
              Close
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

## Monitoring and Debugging Examples

### Example 11: Comprehensive Monitoring

Monitor backfill operations with detailed logging and metrics.

**TypeScript/JavaScript:**

```typescript
class BackfillMonitor {
  private service: BackfillService
  private activeJobs = new Map<string, { startTime: number; config: any }>()

  constructor(service: BackfillService) {
    this.service = service
  }

  async startMonitoredBackfill(config: any) {
    const startTime = Date.now()

    console.log('🚀 Starting monitored backfill:', {
      config,
      timestamp: new Date().toISOString(),
    })

    try {
      const backfillId = await this.service.initiateBackfill(config)

      this.activeJobs.set(backfillId, { startTime, config })

      console.log(`✅ Backfill initiated: ${backfillId}`)

      // Start monitoring
      this.monitorJob(backfillId)

      return backfillId
    } catch (error) {
      console.error('❌ Failed to start backfill:', error.message)
      throw error
    }
  }

  private async monitorJob(backfillId: string) {
    const jobInfo = this.activeJobs.get(backfillId)
    if (!jobInfo) return

    let lastStatus = ''
    let lastCompleted = 0
    let stagnantCount = 0

    const monitorInterval = setInterval(async () => {
      try {
        const status = this.service.getBackfillStatus(backfillId)

        if (!status) {
          console.warn(`⚠️ Job ${backfillId} not found`)
          this.cleanup(backfillId, monitorInterval)
          return
        }

        // Check for status changes
        if (status.status !== lastStatus) {
          console.log(`📊 Status change: ${lastStatus} → ${status.status}`)
          lastStatus = status.status
        }

        // Check for progress
        if (status.progress.completed !== lastCompleted) {
          const rate = (status.progress.completed - lastCompleted) / 2 // per second
          console.log(
            `📈 Progress: ${status.progress.completed}/${status.progress.total} (+${status.progress.completed - lastCompleted}, ${rate.toFixed(1)}/s)`
          )
          lastCompleted = status.progress.completed
          stagnantCount = 0
        } else if (status.status === 'processing') {
          stagnantCount++
          if (stagnantCount >= 5) {
            console.warn(
              `⚠️ Progress stagnant for ${stagnantCount * 2} seconds`
            )
          }
        }

        // Log performance metrics
        const performanceStatus = this.service.getPerformanceStatus()
        console.log(
          `🔧 Performance: Cache ${Math.round(performanceStatus.intermediateCache.hitRate * 100)}%, ` +
            `Concurrency ${performanceStatus.concurrencyLimiter.activeSlots}/${performanceStatus.concurrencyLimiter.maxConcurrent}, ` +
            `Rate ${performanceStatus.rateLimiter.currentCount}/${performanceStatus.rateLimiter.maxRequests}`
        )

        // Check for errors
        if (status.progress.totalErrors > 0) {
          console.warn(
            `⚠️ Errors detected: ${status.progress.totalErrors} total ` +
              `(${status.progress.retryableErrors} retryable, ${status.progress.permanentErrors} permanent)`
          )
        }

        // Handle completion
        if (status.status !== 'processing') {
          this.handleCompletion(backfillId, status, jobInfo)
          this.cleanup(backfillId, monitorInterval)
        }
      } catch (error) {
        console.error(`❌ Error monitoring job ${backfillId}:`, error.message)
      }
    }, 2000)
  }

  private handleCompletion(backfillId: string, status: any, jobInfo: any) {
    const duration = Date.now() - jobInfo.startTime
    const durationStr = `${Math.round(duration / 1000)}s`

    switch (status.status) {
      case 'complete':
        console.log(`✅ Backfill completed successfully in ${durationStr}`)
        console.log(
          `📊 Final stats: ${status.progress.completed} completed, ${status.progress.skipped} skipped`
        )
        console.log(`💾 Created ${status.snapshotIds.length} snapshots`)
        break

      case 'partial_success':
        console.log(`⚠️ Backfill completed with issues in ${durationStr}`)
        console.log(
          `📊 Final stats: ${status.progress.completed} completed, ${status.progress.failed} failed`
        )
        if (status.errorSummary) {
          console.log(
            `❌ Error summary: ${status.errorSummary.totalErrors} errors affecting ${status.errorSummary.affectedDistricts.length} districts`
          )
        }
        break

      case 'error':
        console.error(`❌ Backfill failed in ${durationStr}: ${status.error}`)
        break

      case 'cancelled':
        console.log(`🛑 Backfill cancelled in ${durationStr}`)
        break
    }

    // Log performance summary
    const performanceStatus = this.service.getPerformanceStatus()
    console.log(
      `🔧 Final performance: Cache entries ${performanceStatus.intermediateCache.entryCount}, ` +
        `Size ${Math.round(performanceStatus.intermediateCache.sizeBytes / 1024)}KB`
    )
  }

  private cleanup(backfillId: string, interval: NodeJS.Timeout) {
    clearInterval(interval)
    this.activeJobs.delete(backfillId)
  }

  getActiveJobs() {
    return Array.from(this.activeJobs.keys())
  }

  async cancelAllJobs() {
    const jobs = this.getActiveJobs()
    console.log(`🛑 Cancelling ${jobs.length} active jobs`)

    for (const jobId of jobs) {
      try {
        await this.service.cancelBackfill(jobId)
        console.log(`✅ Cancelled job ${jobId}`)
      } catch (error) {
        console.error(`❌ Failed to cancel job ${jobId}:`, error.message)
      }
    }
  }
}

// Usage
const monitor = new BackfillMonitor(backfillService)

// Start a monitored backfill
monitor.startMonitoredBackfill({
  startDate: '2024-01-01',
  endDate: '2024-01-30',
  targetDistricts: ['42', '15', '73'],
  concurrency: 4,
  enableCaching: true,
})
```

### Example 12: Error Analysis and Reporting

Analyze backfill errors and generate reports.

**TypeScript/JavaScript:**

```typescript
class BackfillErrorAnalyzer {
  private service: BackfillService

  constructor(service: BackfillService) {
    this.service = service
  }

  async analyzeBackfillErrors(backfillId: string) {
    const status = this.service.getBackfillStatus(backfillId)

    if (!status) {
      throw new Error('Backfill job not found')
    }

    const analysis = {
      jobId: backfillId,
      status: status.status,
      totalOperations: status.progress.total,
      successfulOperations: status.progress.completed,
      failedOperations: status.progress.failed,
      successRate:
        status.progress.total > 0
          ? status.progress.completed / status.progress.total
          : 0,
      errorBreakdown: {} as Record<string, number>,
      districtAnalysis: [] as any[],
      recommendations: [] as string[],
    }

    // Analyze district-level errors
    if (status.progress.districtProgress) {
      for (const [districtId, progress] of Object.entries(
        status.progress.districtProgress
      )) {
        const districtAnalysis = {
          districtId,
          status: progress.status,
          successRate:
            progress.datesTotal > 0
              ? progress.datesProcessed / progress.datesTotal
              : 0,
          retryCount: progress.retryCount,
          lastError: progress.lastError,
          failedDates: progress.failedDates,
        }

        analysis.districtAnalysis.push(districtAnalysis)
      }
    }

    // Analyze partial snapshots for error patterns
    if (status.partialSnapshots) {
      for (const partial of status.partialSnapshots) {
        for (const error of partial.errors) {
          analysis.errorBreakdown[error.errorType] =
            (analysis.errorBreakdown[error.errorType] || 0) + 1
        }
      }
    }

    // Generate recommendations
    if (analysis.successRate < 0.8) {
      analysis.recommendations.push(
        'Consider reducing concurrency to improve stability'
      )
    }

    if (analysis.errorBreakdown['network_error'] > 0) {
      analysis.recommendations.push(
        'Network errors detected - check connectivity and consider increasing rate limit delays'
      )
    }

    if (analysis.errorBreakdown['rate_limit_error'] > 0) {
      analysis.recommendations.push(
        'Rate limiting triggered - increase rate limit delays or reduce concurrency'
      )
    }

    if (analysis.errorBreakdown['timeout_error'] > 0) {
      analysis.recommendations.push(
        'Timeout errors detected - consider increasing timeout values'
      )
    }

    const problematicDistricts = analysis.districtAnalysis.filter(
      d => d.successRate < 0.5
    )
    if (problematicDistricts.length > 0) {
      analysis.recommendations.push(
        `Review problematic districts: ${problematicDistricts.map(d => d.districtId).join(', ')}`
      )
    }

    return analysis
  }

  generateErrorReport(analysis: any): string {
    let report = `# Backfill Error Analysis Report\n\n`
    report += `**Job ID:** ${analysis.jobId}\n`
    report += `**Status:** ${analysis.status}\n`
    report += `**Success Rate:** ${Math.round(analysis.successRate * 100)}%\n\n`

    report += `## Summary\n\n`
    report += `- Total Operations: ${analysis.totalOperations}\n`
    report += `- Successful: ${analysis.successfulOperations}\n`
    report += `- Failed: ${analysis.failedOperations}\n\n`

    if (Object.keys(analysis.errorBreakdown).length > 0) {
      report += `## Error Breakdown\n\n`
      for (const [errorType, count] of Object.entries(
        analysis.errorBreakdown
      )) {
        report += `- ${errorType}: ${count}\n`
      }
      report += `\n`
    }

    if (analysis.districtAnalysis.length > 0) {
      report += `## District Analysis\n\n`
      report += `| District | Status | Success Rate | Retries | Last Error |\n`
      report += `|----------|--------|--------------|---------|------------|\n`

      for (const district of analysis.districtAnalysis) {
        const successRate = Math.round(district.successRate * 100)
        const lastError = district.lastError
          ? district.lastError.substring(0, 50) + '...'
          : 'None'
        report += `| ${district.districtId} | ${district.status} | ${successRate}% | ${district.retryCount} | ${lastError} |\n`
      }
      report += `\n`
    }

    if (analysis.recommendations.length > 0) {
      report += `## Recommendations\n\n`
      for (const recommendation of analysis.recommendations) {
        report += `- ${recommendation}\n`
      }
    }

    return report
  }
}

// Usage
const analyzer = new BackfillErrorAnalyzer(backfillService)

async function analyzeAndReport(backfillId: string) {
  try {
    const analysis = await analyzer.analyzeBackfillErrors(backfillId)
    const report = analyzer.generateErrorReport(analysis)

    console.log(report)

    // Save report to file
    const fs = await import('fs/promises')
    await fs.writeFile(`backfill-report-${backfillId}.md`, report)

    console.log(`Report saved to backfill-report-${backfillId}.md`)
  } catch (error) {
    console.error('Error generating report:', error.message)
  }
}
```

These examples demonstrate the comprehensive capabilities of the Unified BackfillService, from basic usage to advanced monitoring and error analysis. The service provides flexibility for various use cases while maintaining robust error handling and performance optimization features.
