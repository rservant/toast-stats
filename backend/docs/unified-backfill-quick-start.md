# Unified BackfillService - Quick Start Guide

## 5-Minute Quick Start

### 1. Basic Setup

```typescript
import { BackfillService } from './services/UnifiedBackfillService.js'

// Service is already initialized in routes/districts.ts
// You can use it directly via HTTP API or import it for programmatic use
```

### 2. Simple Backfill (HTTP API)

```bash
# Backfill last 7 days for all districts
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-07"
  }'

# Response: {"backfillId": "uuid-string", "status": "processing", ...}
```

### 3. Check Progress

```bash
# Replace 'your-backfill-id' with the ID from step 2
curl http://localhost:5001/api/districts/backfill/your-backfill-id
```

### 4. Cancel if Needed

```bash
curl -X DELETE http://localhost:5001/api/districts/backfill/your-backfill-id
```

## Common Scenarios

### Scenario 1: Daily Data Refresh

**Goal**: Backfill yesterday's data for all configured districts

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-05"
  }'
```

**TypeScript:**

```typescript
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
const dateStr = yesterday.toISOString().split('T')[0]

const backfillId = await service.initiateBackfill({
  startDate: dateStr,
})
```

### Scenario 2: Fill Missing Data

**Goal**: Fill gaps in historical data, skipping already cached dates

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "skipExisting": true
  }'
```

### Scenario 3: Specific Districts

**Goal**: Backfill data for specific districts only

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "targetDistricts": ["42", "15", "73"]
  }'
```

### Scenario 4: High-Speed Processing

**Goal**: Process data as quickly as possible

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "concurrency": 8,
    "rateLimitDelayMs": 1000,
    "enableCaching": true
  }'
```

### Scenario 5: Conservative Processing

**Goal**: Process data reliably, prioritizing success over speed

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "concurrency": 1,
    "rateLimitDelayMs": 5000,
    "retryFailures": true
  }'
```

## Monitoring Progress

### Simple Progress Check

```bash
# Get basic status
curl http://localhost:5001/api/districts/backfill/your-id | jq '.status, .progress'
```

### Detailed Progress Monitoring

```bash
# Monitor with detailed information
watch -n 2 'curl -s http://localhost:5001/api/districts/backfill/your-id | jq "{
  status: .status,
  progress: \"\(.progress.completed)/\(.progress.total)\",
  current: .progress.current,
  failed: .progress.failed,
  errors: .progress.totalErrors
}"'
```

### Performance Monitoring

```bash
# Check performance metrics
curl http://localhost:5001/api/districts/backfill/your-id | jq '.performanceStatus'
```

## Error Handling

### Check for Errors

```bash
# Check error summary
curl http://localhost:5001/api/districts/backfill/your-id | jq '.errorSummary'
```

### Analyze Partial Snapshots

```bash
# Review partial snapshots
curl http://localhost:5001/api/districts/backfill/your-id | jq '.partialSnapshots[]'
```

### District-Level Errors

```bash
# Check district progress
curl http://localhost:5001/api/districts/backfill/your-id | jq '.progress.districtProgress'
```

## Frontend Integration

### React Hook Usage

```typescript
import { useInitiateBackfill, useBackfillStatus } from '../hooks/useBackfill'

function MyComponent() {
  const [backfillId, setBackfillId] = useState<string | null>(null)
  const initiateMutation = useInitiateBackfill()
  const { data: status } = useBackfillStatus(backfillId, !!backfillId)

  const handleStart = async () => {
    const result = await initiateMutation.mutateAsync({
      startDate: '2024-01-01',
      endDate: '2024-01-07'
    })
    setBackfillId(result.backfillId)
  }

  return (
    <div>
      <button onClick={handleStart}>Start Backfill</button>
      {status && (
        <div>
          Status: {status.status}
          Progress: {status.progress.completed}/{status.progress.total}
        </div>
      )}
    </div>
  )
}
```

## Troubleshooting Quick Fixes

### Issue: "No valid districts to process"

```bash
# Check configured districts
curl http://localhost:5001/api/districts | jq '.districts[].districtId'

# Use specific districts
curl -X POST http://localhost:5001/api/districts/backfill \
  -d '{"startDate": "2024-01-01", "targetDistricts": ["42"]}'
```

### Issue: High failure rate

```bash
# Use conservative settings
curl -X POST http://localhost:5001/api/districts/backfill \
  -d '{
    "startDate": "2024-01-01",
    "concurrency": 1,
    "rateLimitDelayMs": 5000,
    "retryFailures": true
  }'
```

### Issue: Slow processing

```bash
# Check cache performance
curl http://localhost:5001/api/districts/backfill/your-id | jq '.performanceStatus.intermediateCache.hitRate'

# Enable caching if not already
curl -X POST http://localhost:5001/api/districts/backfill \
  -d '{"startDate": "2024-01-01", "enableCaching": true}'
```

## Next Steps

1. **Read Full Documentation**: [Unified BackfillService Documentation](./unified-backfill-service.md)
2. **Explore API Reference**: [API Reference Guide](./unified-backfill-api-reference.md)
3. **See More Examples**: [Comprehensive Examples](./unified-backfill-examples.md)
4. **Understand Architecture**: [Complete README](./README-unified-backfill.md)

## Need Help?

- Check application logs for detailed error messages
- Use the status endpoint to understand current job state
- Review error summaries for patterns and systemic issues
- Monitor performance metrics for optimization opportunities

---

_This quick start guide covers the most common use cases. For advanced scenarios and detailed configuration options, refer to the complete documentation._
