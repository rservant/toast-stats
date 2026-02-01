# Performance SLOs Steering Document

**Status:** Authoritative  
**Applies to:** All frontend and backend code affecting application performance  
**Audience:** All developers and automation agents (including Kiro)  
**Owner:** Development Team

---

## 1. Purpose

This document defines **mandatory performance Service Level Objectives (SLOs)** for the Toast-Stats application.

Its goals are to:

- Establish user-centric performance targets for frontend and backend
- Define performance budgets that prevent regression
- Specify measurement and monitoring requirements
- Provide guidance on optimization techniques
- Define CI gates that enforce performance standards

This document is **normative**.

The keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are to be interpreted as described in RFC 2119.

Kiro MUST treat this document as the **primary source of truth** for all performance-related decisions.

---

## 2. Authority Model

In the event of conflict, performance rules MUST be applied according to the following precedence order (highest first):

1. **This Steering Document**
2. **[platform-engineering.md](./platform-engineering.md)** (deployment and infrastructure)
3. **[frontend-standards.md](./frontend-standards.md)** (frontend patterns)
4. Build configuration files (vite.config.ts, webpack.config.js)
5. Inline code comments

Lower-precedence sources MUST NOT weaken higher-precedence rules.

---

## 3. Scope

This document applies to all code that affects:

- Page load performance and Core Web Vitals
- API response latency
- Memory consumption and resource utilization
- Bundle size and asset delivery
- Runtime performance and responsiveness

There are **no exceptions** for admin pages, internal tools, or development builds.

---

## 4. Core Principles

All performance decisions MUST adhere to the following principles:

1. **User experience is the primary metric**  
   Performance targets exist to ensure good user experience, not arbitrary numbers.

2. **Measure before optimizing**  
   Performance improvements MUST be validated with measurements, not assumptions.

3. **Prevention over remediation**  
   CI gates SHOULD catch regressions before they reach production.

4. **Budget discipline**  
   Performance budgets are constraints, not suggestions.

5. **Progressive enhancement**  
   Core functionality MUST work before enhancements load.

---

## 5. Frontend Performance SLOs

### 5.1 Core Web Vitals Targets

The application MUST meet the following Core Web Vitals targets:

| Metric                              | Target  | Maximum | Description                                     |
| ----------------------------------- | ------- | ------- | ----------------------------------------------- |
| **LCP** (Largest Contentful Paint)  | < 1.5s  | < 2.5s  | Time until largest content element is rendered  |
| **FID** (First Input Delay)         | < 50ms  | < 100ms | Time from first interaction to browser response |
| **CLS** (Cumulative Layout Shift)   | < 0.05  | < 0.1   | Visual stability during page load               |
| **INP** (Interaction to Next Paint) | < 100ms | < 200ms | Responsiveness to user interactions             |

#### Target Definitions

- **Target**: The goal for 75th percentile of page loads (good user experience)
- **Maximum**: The absolute limit; exceeding this is a **blocking issue**

#### LCP Requirements

To achieve LCP < 2 seconds:

- Critical CSS MUST be inlined or preloaded
- Hero images MUST use appropriate sizing and formats (WebP, AVIF)
- Web fonts MUST use `font-display: swap` or `font-display: optional`
- Third-party scripts MUST NOT block the critical rendering path
- Server response time MUST be < 200ms for HTML documents

```typescript
// ✅ CORRECT - Preload critical assets
<link rel="preload" href="/fonts/Montserrat-Bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/hero-image.webp" as="image">

// ❌ FORBIDDEN - Render-blocking resources without preload
<link rel="stylesheet" href="/non-critical-styles.css">
```

#### TTI (Time to Interactive) Requirements

The application MUST be interactive within:

| Page Type         | TTI Target | Maximum |
| ----------------- | ---------- | ------- |
| Landing/Dashboard | < 2.5s     | < 4s    |
| Data-heavy pages  | < 3.5s     | < 5s    |
| Admin pages       | < 4s       | < 6s    |

### 5.2 Performance Budget

The application MUST NOT exceed the following asset budgets:

| Asset Type                     | Budget (Compressed) | Budget (Uncompressed) | Notes                               |
| ------------------------------ | ------------------- | --------------------- | ----------------------------------- |
| **JavaScript (Total)**         | 200 KB              | 600 KB                | All JS including vendor bundles     |
| **JavaScript (Main Bundle)**   | 100 KB              | 300 KB                | Application code only               |
| **JavaScript (Vendor Bundle)** | 100 KB              | 300 KB                | Third-party dependencies            |
| **CSS (Total)**                | 50 KB               | 150 KB                | All stylesheets                     |
| **Images (Per Page)**          | 500 KB              | -                     | Total images loaded on initial view |
| **Fonts (Total)**              | 100 KB              | -                     | All font files                      |
| **HTML Document**              | 50 KB               | -                     | Initial HTML response               |

#### Budget Enforcement

- Bundle size MUST be measured after gzip/brotli compression
- CI pipelines MUST fail if budgets are exceeded
- Budget increases require documented justification and approval

```bash
# Example CI check for bundle size
npm run build
BUNDLE_SIZE=$(stat -f%z dist/assets/index-*.js | head -1)
if [ $BUNDLE_SIZE -gt 204800 ]; then
  echo "ERROR: Main bundle exceeds 200KB budget"
  exit 1
fi
```

### 5.3 Optimization Techniques

The following optimization techniques MUST be applied:

#### Code Splitting

Route-based code splitting MUST be implemented for all page components:

```typescript
// ✅ CORRECT - Lazy load route components
import { lazy, Suspense } from 'react'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const DistrictDetailPage = lazy(() => import('./pages/DistrictDetailPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

function App() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/districts/:id" element={<DistrictDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Suspense>
  )
}

// ❌ FORBIDDEN - Static imports for route components
import DashboardPage from './pages/DashboardPage'
import DistrictDetailPage from './pages/DistrictDetailPage'
import AdminPage from './pages/AdminPage'
```

#### Lazy Loading

Non-critical components SHOULD be lazy loaded:

```typescript
// ✅ CORRECT - Lazy load heavy components
const DataVisualization = lazy(() => import('./components/DataVisualization'))
const ExportDialog = lazy(() => import('./components/ExportDialog'))

// Load on user interaction
const [showExport, setShowExport] = useState(false)

return (
  <>
    <button onClick={() => setShowExport(true)}>Export</button>
    {showExport && (
      <Suspense fallback={<DialogSkeleton />}>
        <ExportDialog onClose={() => setShowExport(false)} />
      </Suspense>
    )}
  </>
)
```

#### Image Optimization

Images MUST be optimized for delivery:

| Requirement       | Implementation                                             |
| ----------------- | ---------------------------------------------------------- |
| Modern formats    | Use WebP or AVIF with fallbacks                            |
| Responsive images | Use `srcset` and `sizes` attributes                        |
| Lazy loading      | Use `loading="lazy"` for below-fold images                 |
| Dimensions        | Always specify `width` and `height` to prevent CLS         |
| Compression       | Compress images to appropriate quality (80-85% for photos) |

```typescript
// ✅ CORRECT - Optimized image with responsive sources
<picture>
  <source srcset="/hero.avif" type="image/avif" />
  <source srcset="/hero.webp" type="image/webp" />
  <img
    src="/hero.jpg"
    alt="Dashboard overview"
    width={1200}
    height={600}
    loading="eager"  // Above-fold: eager
  />
</picture>

// ✅ CORRECT - Below-fold image with lazy loading
<img
  src="/chart.webp"
  alt="Performance chart"
  width={800}
  height={400}
  loading="lazy"
/>

// ❌ FORBIDDEN - Unoptimized image without dimensions
<img src="/large-image.png" alt="Chart" />
```

#### Font Optimization

Web fonts MUST be optimized:

```css
/* ✅ CORRECT - Font with display swap and preload */
@font-face {
  font-family: 'Montserrat';
  src: url('/fonts/Montserrat-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}

/* Preload in HTML head */
<link rel="preload" href="/fonts/Montserrat-Bold.woff2" as="font" type="font/woff2" crossorigin>
```

Font requirements:

- MUST use `woff2` format (best compression)
- MUST use `font-display: swap` or `font-display: optional`
- MUST subset fonts to include only required characters
- SHOULD preload critical fonts
- MUST NOT load more than 4 font files total

#### Compression

All text-based assets MUST be served with compression:

| Asset Type         | Compression                | Minimum Savings |
| ------------------ | -------------------------- | --------------- |
| JavaScript         | Brotli (preferred) or gzip | 70%+            |
| CSS                | Brotli (preferred) or gzip | 70%+            |
| HTML               | Brotli (preferred) or gzip | 60%+            |
| JSON API responses | gzip                       | 60%+            |

### 5.4 Measurement Requirements

Performance MUST be measured using the following methods:

#### Lighthouse CI

Lighthouse MUST be run in CI for every pull request:

| Audit          | Minimum Score | Target Score |
| -------------- | ------------- | ------------ |
| Performance    | 80            | 90+          |
| Accessibility  | 90            | 100          |
| Best Practices | 90            | 100          |
| SEO            | 80            | 90+          |

```yaml
# Example Lighthouse CI configuration
ci:
  collect:
    numberOfRuns: 3
    url:
      - http://localhost:3000/
      - http://localhost:3000/districts
  assert:
    assertions:
      categories:performance:
        - error
        - minScore: 0.8
      categories:accessibility:
        - error
        - minScore: 0.9
      first-contentful-paint:
        - warn
        - maxNumericValue: 2000
      largest-contentful-paint:
        - error
        - maxNumericValue: 2500
```

#### Real User Monitoring (RUM)

Production deployments SHOULD implement RUM to track:

| Metric | Collection Method  | Alerting Threshold |
| ------ | ------------------ | ------------------ |
| LCP    | web-vitals library | p75 > 2.5s         |
| FID    | web-vitals library | p75 > 100ms        |
| CLS    | web-vitals library | p75 > 0.1          |
| INP    | web-vitals library | p75 > 200ms        |
| TTFB   | web-vitals library | p75 > 800ms        |

```typescript
// ✅ CORRECT - RUM implementation with web-vitals
import { onLCP, onFID, onCLS, onINP, onTTFB } from 'web-vitals'

function sendToAnalytics(metric: Metric) {
  // Send to your analytics endpoint
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  })

  // Use sendBeacon for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/vitals', body)
  }
}

// Register all Core Web Vitals
onLCP(sendToAnalytics)
onFID(sendToAnalytics)
onCLS(sendToAnalytics)
onINP(sendToAnalytics)
onTTFB(sendToAnalytics)
```

#### Bundle Analysis

Bundle size MUST be analyzed on every build:

```typescript
// vite.config.ts - Enable bundle analysis
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
})
```

Bundle analysis requirements:

- MUST generate bundle size report on every build
- MUST track bundle size trends over time
- SHOULD alert when bundle size increases by > 10%
- MUST identify and document large dependencies

### 5.5 CI Performance Gates

The following CI gates MUST be enforced:

#### Bundle Size Gate

```yaml
# GitHub Actions example
- name: Check bundle size
  run: |
    npm run build
    npx bundlesize
  env:
    BUNDLESIZE_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Bundle size configuration:

```json
// package.json or bundlesize.config.json
{
  "bundlesize": [
    {
      "path": "./dist/assets/index-*.js",
      "maxSize": "100 KB",
      "compression": "gzip"
    },
    {
      "path": "./dist/assets/vendor-*.js",
      "maxSize": "100 KB",
      "compression": "gzip"
    },
    {
      "path": "./dist/assets/index-*.css",
      "maxSize": "50 KB",
      "compression": "gzip"
    }
  ]
}
```

#### Lighthouse CI Gate

```yaml
# GitHub Actions example
- name: Run Lighthouse CI
  uses: treosh/lighthouse-ci-action@v10
  with:
    configPath: ./lighthouserc.json
    uploadArtifacts: true
    temporaryPublicStorage: true
```

#### Performance Regression Detection

CI MUST detect performance regressions:

| Check                     | Threshold   | Action                 |
| ------------------------- | ----------- | ---------------------- |
| Bundle size increase      | > 5 KB      | Warning                |
| Bundle size increase      | > 20 KB     | Blocking               |
| Lighthouse score decrease | > 5 points  | Warning                |
| Lighthouse score decrease | > 10 points | Blocking               |
| New dependency added      | Any         | Requires justification |

```yaml
# Example regression detection
- name: Compare bundle sizes
  run: |
    CURRENT_SIZE=$(stat -f%z dist/assets/index-*.js)
    BASELINE_SIZE=$(cat .bundle-baseline)
    DIFF=$((CURRENT_SIZE - BASELINE_SIZE))

    if [ $DIFF -gt 20480 ]; then
      echo "ERROR: Bundle size increased by more than 20KB"
      exit 1
    elif [ $DIFF -gt 5120 ]; then
      echo "WARNING: Bundle size increased by more than 5KB"
    fi
```

### 5.6 Prohibited Patterns

The following patterns are **FORBIDDEN** as they negatively impact performance:

```typescript
// ❌ FORBIDDEN - Synchronous imports for route components
import HeavyComponent from './HeavyComponent'

// ❌ FORBIDDEN - Unoptimized images
<img src="/large-uncompressed.png" />

// ❌ FORBIDDEN - Blocking third-party scripts
<script src="https://example.com/analytics.js"></script>

// ❌ FORBIDDEN - CSS in JS that generates large runtime overhead
const StyledComponent = styled.div`
  /* Hundreds of lines of CSS */
`

// ❌ FORBIDDEN - Unbounded data fetching without pagination
const allData = await fetch('/api/all-records') // Could be thousands

// ❌ FORBIDDEN - Layout-causing operations in render
function Component() {
  document.body.style.overflow = 'hidden' // Causes layout thrashing
  return <div>...</div>
}
```

---

## 6. Backend Performance SLOs

This section defines mandatory performance Service Level Objectives for backend API services. These targets ensure consistent, responsive API behavior and efficient resource utilization.

### 6.1 API Latency Targets

All backend API endpoints MUST meet the following latency targets:

| Percentile | Target  | Maximum | Description                                    |
| ---------- | ------- | ------- | ---------------------------------------------- |
| **p50**    | < 200ms | < 300ms | Median response time (typical user experience) |
| **p95**    | < 500ms | < 750ms | 95th percentile (most users' worst case)       |
| **p99**    | < 1s    | < 2s    | 99th percentile (rare worst case)              |

#### Target Definitions

- **Target**: The goal for normal operation; exceeding this triggers investigation
- **Maximum**: The absolute limit; exceeding this is a **blocking issue** requiring immediate action

#### Latency Targets by Endpoint Type

Different endpoint types have different latency expectations based on their complexity:

| Endpoint Type               | p50 Target | p95 Target | p99 Target | Examples                                    |
| --------------------------- | ---------- | ---------- | ---------- | ------------------------------------------- |
| **Health checks**           | < 50ms     | < 100ms    | < 200ms    | `/health`, `/health/ready`                  |
| **Simple reads**            | < 100ms    | < 300ms    | < 500ms    | `/api/districts`, `/api/config`             |
| **Complex reads**           | < 200ms    | < 500ms    | < 1s       | `/api/districts/:id/stats`, `/api/rankings` |
| **Data mutations**          | < 300ms    | < 750ms    | < 1.5s     | `/api/snapshots`, `/api/config` (POST/PUT)  |
| **Long-running operations** | < 500ms    | < 2s       | < 5s       | `/api/backfill/start`, `/api/refresh`       |

#### Latency Measurement Requirements

Latency MUST be measured using the following methods:

- **Server-side timing**: Measure from request receipt to response completion
- **Structured logging**: Log request duration in milliseconds for every request
- **Cloud Monitoring**: Use Cloud Run built-in metrics for aggregated percentiles
- **Tracing**: Use distributed tracing for end-to-end latency analysis

```typescript
// ✅ CORRECT - Request timing middleware
app.use((req, res, next) => {
  const startTime = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - startTime
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      metric: {
        name: 'http_request_duration_ms',
        value: duration,
        unit: 'milliseconds',
        labels: {
          method: req.method,
          path: normalizePath(req.path),
          status: String(res.statusCode),
        },
      },
    })
  })

  next()
})
```

#### Latency Optimization Techniques

To achieve latency targets, the following techniques SHOULD be applied:

| Technique                 | Impact                           | Implementation                              |
| ------------------------- | -------------------------------- | ------------------------------------------- |
| **Connection pooling**    | Reduces connection overhead      | Use persistent connections to Firestore/GCS |
| **Response caching**      | Eliminates redundant computation | Use LRU cache with appropriate TTL          |
| **Query optimization**    | Reduces database latency         | Use indexes, limit result sets              |
| **Async operations**      | Prevents blocking                | Use non-blocking I/O for all external calls |
| **Request deduplication** | Reduces redundant work           | Deduplicate concurrent identical requests   |

#### Latency Alerting Thresholds

Alerts MUST be configured for latency degradation:

| Condition                 | Severity | Action              |
| ------------------------- | -------- | ------------------- |
| p50 > 300ms for 5 minutes | Warning  | Investigate         |
| p95 > 750ms for 5 minutes | High     | Notify team         |
| p99 > 2s for 5 minutes    | Critical | Page on-call        |
| Any request > 30s         | Critical | Investigate timeout |

### 6.2 Memory Budget

Backend services MUST operate within defined memory constraints to ensure stability and cost efficiency.

#### Default Memory Configuration

| Configuration              | Value  | Rationale                           |
| -------------------------- | ------ | ----------------------------------- |
| **Container memory limit** | 512Mi  | Default Cloud Run allocation        |
| **V8 heap limit**          | 384MB  | ~75% of container memory            |
| **Native memory budget**   | ~100MB | Buffers, streams, native modules    |
| **Overhead budget**        | ~28MB  | Node.js runtime, container overhead |

The memory budget formula:

```
Container Memory (512Mi) = V8 Heap (384MB) + Native Memory (~100MB) + Overhead (~28MB)
```

#### Memory Sizing Guidelines

| Container Memory | V8 Heap (`--max-old-space-size`) | Use Case                          |
| ---------------- | -------------------------------- | --------------------------------- |
| 256Mi            | 150MB                            | Lightweight services, simple APIs |
| 512Mi            | 384MB                            | Standard API services (default)   |
| 1Gi              | 768MB                            | Data processing, analytics        |
| 2Gi              | 1536MB                           | Heavy computation, large datasets |

**Rule**: `--max-old-space-size` SHOULD be set to approximately 75% of container memory to leave room for native memory and overhead.

#### Memory Configuration Requirements

Memory limits MUST be configured in the Dockerfile or Cloud Run deployment:

```dockerfile
# ✅ CORRECT - Set V8 heap limit in Dockerfile
ENV NODE_OPTIONS="--max-old-space-size=384"
```

```bash
# ✅ CORRECT - Set via Cloud Run deployment
gcloud run deploy toast-stats-backend \
  --memory 512Mi \
  --set-env-vars "NODE_OPTIONS=--max-old-space-size=384"
```

#### Memory Monitoring Requirements

Memory usage MUST be monitored to prevent OOM (Out of Memory) conditions:

| Metric                       | Source            | Alert Threshold          |
| ---------------------------- | ----------------- | ------------------------ |
| Container memory utilization | Cloud Run metrics | > 85% sustained          |
| V8 heap used                 | Custom metric     | > 90% of limit           |
| RSS (Resident Set Size)      | Custom metric     | > 95% of container limit |

```typescript
// ✅ CORRECT - Memory monitoring
import { memoryUsage } from 'process'

function logMemoryMetrics(): void {
  const usage = memoryUsage()

  logger.info('Memory metrics', {
    metric: {
      name: 'nodejs_memory_heap_used_bytes',
      value: usage.heapUsed,
      unit: 'bytes',
      labels: { type: 'heap_used' },
    },
  })

  logger.info('Memory metrics', {
    metric: {
      name: 'nodejs_memory_rss_bytes',
      value: usage.rss,
      unit: 'bytes',
      labels: { type: 'rss' },
    },
  })
}

// Log memory metrics periodically
setInterval(logMemoryMetrics, 60000) // Every minute
```

#### Memory Leak Prevention

To prevent memory leaks, the following patterns MUST be followed:

```typescript
// ❌ FORBIDDEN - Unbounded cache growth
const cache = new Map<string, Data>() // Can grow indefinitely!

// ✅ CORRECT - Bounded LRU cache
import { LRUCache } from 'lru-cache'

const cache = new LRUCache<string, Data>({
  max: 100, // Maximum 100 entries
  maxSize: 50 * 1024 * 1024, // 50MB maximum
  sizeCalculation: value => JSON.stringify(value).length,
  ttl: 5 * 60 * 1000, // 5 minute TTL
})

// ❌ FORBIDDEN - Event listener without cleanup
eventEmitter.on('data', handler) // Never removed!

// ✅ CORRECT - Event listener with cleanup
const handler = (data: Data) => {
  /* ... */
}
eventEmitter.on('data', handler)

// Cleanup on shutdown
process.on('SIGTERM', () => {
  eventEmitter.off('data', handler)
})

// ❌ FORBIDDEN - Accumulating data in closures
function createHandler() {
  const allData: Data[] = [] // Grows forever!
  return (data: Data) => {
    allData.push(data)
  }
}

// ✅ CORRECT - Bounded data accumulation
function createHandler(maxItems: number) {
  const recentData: Data[] = []
  return (data: Data) => {
    recentData.push(data)
    if (recentData.length > maxItems) {
      recentData.shift() // Remove oldest
    }
  }
}
```

### 6.3 Throughput Requirements

Backend services MUST handle expected traffic volumes without degradation.

#### Throughput Targets

| Metric                                 | Target    | Maximum   | Measurement                   |
| -------------------------------------- | --------- | --------- | ----------------------------- |
| **Requests per second (per instance)** | 50 RPS    | 100 RPS   | Cloud Run metrics             |
| **Concurrent requests (per instance)** | 80        | 100       | Cloud Run concurrency setting |
| **Requests per minute (total)**        | 3,000 RPM | 6,000 RPM | Aggregated across instances   |

#### Concurrency Configuration

Cloud Run concurrency MUST be configured based on workload characteristics:

| Workload Type       | Concurrency | Rationale                                |
| ------------------- | ----------- | ---------------------------------------- |
| CPU-intensive       | 10-20       | Limit parallel CPU work                  |
| Memory-intensive    | 20-40       | Prevent memory exhaustion                |
| I/O-bound (default) | 80          | Maximize throughput for async operations |
| Mixed workload      | 40-60       | Balance CPU and I/O                      |

```bash
# ✅ CORRECT - Set concurrency for I/O-bound service
gcloud run deploy toast-stats-backend \
  --concurrency 80

# ✅ CORRECT - Set concurrency for CPU-intensive service
gcloud run deploy analytics-service \
  --concurrency 20
```

#### Throughput Optimization Techniques

To achieve throughput targets, the following techniques SHOULD be applied:

| Technique                 | Impact                  | Implementation                              |
| ------------------------- | ----------------------- | ------------------------------------------- |
| **Request deduplication** | Reduces redundant work  | Deduplicate concurrent identical requests   |
| **Response streaming**    | Reduces memory pressure | Stream large responses instead of buffering |
| **Pagination**            | Limits response size    | Paginate large result sets                  |
| **Bounded concurrency**   | Prevents overload       | Use p-limit for parallel operations         |

```typescript
// ✅ CORRECT - Bounded concurrency with p-limit
import pLimit from 'p-limit'

const limit = pLimit(5) // Maximum 5 concurrent operations

async function processItems(items: Item[]): Promise<Result[]> {
  return Promise.all(items.map(item => limit(() => processItem(item))))
}
```

### 6.4 Error Rate SLOs

Backend services MUST maintain low error rates to ensure reliability.

#### Error Rate Targets

| Error Type                     | Target  | Maximum | Measurement                  |
| ------------------------------ | ------- | ------- | ---------------------------- |
| **5xx errors (server errors)** | < 0.1%  | < 1%    | Percentage of total requests |
| **4xx errors (client errors)** | < 5%    | < 10%   | Percentage of total requests |
| **Timeout errors**             | < 0.01% | < 0.1%  | Requests exceeding timeout   |
| **Availability**               | > 99.9% | > 99%   | Successful health checks     |

#### Error Rate Definitions

- **5xx errors**: Server-side failures (bugs, resource exhaustion, dependency failures)
- **4xx errors**: Client-side errors (validation failures, not found, unauthorized)
- **Timeout errors**: Requests that exceed the configured timeout
- **Availability**: Percentage of time the service responds to health checks

#### Error Rate Alerting

Alerts MUST be configured for error rate thresholds:

| Condition                        | Severity | Action       |
| -------------------------------- | -------- | ------------ |
| 5xx rate > 0.5% for 5 minutes    | Warning  | Investigate  |
| 5xx rate > 1% for 5 minutes      | High     | Notify team  |
| 5xx rate > 5% for 5 minutes      | Critical | Page on-call |
| Availability < 99% for 5 minutes | Critical | Page on-call |

#### Error Handling Requirements

To maintain error rate SLOs, the following patterns MUST be followed:

```typescript
// ✅ CORRECT - Graceful error handling with proper status codes
router.get('/api/districts/:id', async (req, res) => {
  try {
    const district = await storage.getDistrict(req.params.id)

    if (!district) {
      // 404 - Not found (4xx, expected)
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `District ${req.params.id} not found`,
        },
      })
      return
    }

    res.json(district)
  } catch (error) {
    // Log error for debugging
    logger.error('Failed to fetch district', error)

    // 500 - Internal error (5xx, unexpected)
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    })
  }
})

// ✅ CORRECT - Circuit breaker for external dependencies
import CircuitBreaker from 'opossum'

const storageBreaker = new CircuitBreaker(storage.getSnapshot, {
  timeout: 5000, // 5 second timeout
  errorThresholdPercentage: 50, // Open after 50% failures
  resetTimeout: 30000, // Try again after 30 seconds
})

storageBreaker.on('open', () => {
  logger.warn('Storage circuit breaker opened')
})

storageBreaker.on('halfOpen', () => {
  logger.info('Storage circuit breaker half-open, testing...')
})

storageBreaker.on('close', () => {
  logger.info('Storage circuit breaker closed')
})
```

#### Error Budget

The error budget defines how much unreliability is acceptable:

| SLO                | Error Budget (monthly)  | Calculation                            |
| ------------------ | ----------------------- | -------------------------------------- |
| 99.9% availability | 43.8 minutes downtime   | 30 days × 24 hours × 60 minutes × 0.1% |
| 99% availability   | 7.3 hours downtime      | 30 days × 24 hours × 1%                |
| < 1% error rate    | 1% of requests can fail | Total requests × 1%                    |

Error budget guidelines:

- When error budget is healthy (> 50% remaining), feature development proceeds normally
- When error budget is depleted (< 25% remaining), focus shifts to reliability improvements
- When error budget is exhausted, feature freezes may be implemented

### 6.5 Backend Performance Monitoring

Backend performance MUST be monitored continuously to ensure SLOs are met.

#### Required Metrics

| Metric                          | Collection Method                     | Retention |
| ------------------------------- | ------------------------------------- | --------- |
| Request latency (p50, p95, p99) | Structured logging + Cloud Monitoring | 30 days   |
| Request count by status code    | Structured logging + Cloud Monitoring | 30 days   |
| Memory utilization              | Cloud Run metrics                     | 30 days   |
| CPU utilization                 | Cloud Run metrics                     | 30 days   |
| Instance count                  | Cloud Run metrics                     | 30 days   |
| Error rate                      | Calculated from status codes          | 30 days   |

#### Dashboard Requirements

A backend performance dashboard MUST include:

| Widget              | Metric                 | Visualization               |
| ------------------- | ---------------------- | --------------------------- |
| Request rate        | Requests per second    | Time series                 |
| Latency percentiles | p50, p95, p99          | Time series with thresholds |
| Error rate          | 5xx percentage         | Time series with threshold  |
| Memory utilization  | Container memory %     | Gauge with threshold        |
| Instance count      | Active instances       | Time series                 |
| Availability        | Health check success % | Single stat                 |

#### Performance Review Cadence

Backend performance SHOULD be reviewed regularly:

| Review Type          | Frequency  | Focus                                    |
| -------------------- | ---------- | ---------------------------------------- |
| Real-time monitoring | Continuous | Alerts and anomalies                     |
| Daily review         | Daily      | Error spikes, latency trends             |
| Weekly review        | Weekly     | SLO compliance, capacity planning        |
| Monthly review       | Monthly    | Error budget, optimization opportunities |

### 6.6 Prohibited Backend Patterns

The following patterns are **FORBIDDEN** as they negatively impact backend performance:

```typescript
// ❌ FORBIDDEN - Synchronous blocking operations
import { readFileSync } from 'fs'
const data = readFileSync('/path/to/file') // Blocks event loop!

// ✅ CORRECT - Asynchronous operations
import { readFile } from 'fs/promises'
const data = await readFile('/path/to/file')

// ❌ FORBIDDEN - Unbounded parallel operations
const results = await Promise.all(
  items.map(item => processItem(item)) // Could be thousands!
)

// ✅ CORRECT - Bounded parallel operations
import pLimit from 'p-limit'
const limit = pLimit(10)
const results = await Promise.all(
  items.map(item => limit(() => processItem(item)))
)

// ❌ FORBIDDEN - No timeout on external calls
const response = await fetch(externalUrl) // Could hang forever!

// ✅ CORRECT - Timeout on external calls
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 5000)
try {
  const response = await fetch(externalUrl, { signal: controller.signal })
} finally {
  clearTimeout(timeout)
}

// ❌ FORBIDDEN - Loading entire dataset into memory
const allRecords = await db.collection('records').get() // Could be millions!

// ✅ CORRECT - Paginated data access
const pageSize = 100
let lastDoc = null
const records: Record[] = []

while (true) {
  let query = db.collection('records').limit(pageSize)
  if (lastDoc) {
    query = query.startAfter(lastDoc)
  }

  const snapshot = await query.get()
  if (snapshot.empty) break

  records.push(...snapshot.docs.map(doc => doc.data()))
  lastDoc = snapshot.docs[snapshot.docs.length - 1]

  if (snapshot.docs.length < pageSize) break
}

// ❌ FORBIDDEN - CPU-intensive operations on main thread
function computeHash(data: string): string {
  // Long-running CPU work blocks event loop
  return expensiveHashFunction(data)
}

// ✅ CORRECT - Offload CPU-intensive work
import { Worker } from 'worker_threads'

async function computeHash(data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./hash-worker.js', { workerData: data })
    worker.on('message', resolve)
    worker.on('error', reject)
  })
}
```

---

## 7. Node.js Memory Management

This section provides detailed guidance on Node.js memory management for the Toast-Stats backend. It complements the memory budget defined in Section 6.2 with Node.js-specific patterns and best practices.

### 7.1 V8 Memory Model

Understanding the V8 memory model is essential for effective memory management in Node.js applications.

#### Memory Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     NODE.JS MEMORY ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    RESIDENT SET SIZE (RSS)                         │ │
│  │                    Total memory allocated to process               │ │
│  │                                                                    │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │                      V8 HEAP MEMORY                          │ │ │
│  │  │              Managed by V8 garbage collector                 │ │ │
│  │  │                                                              │ │ │
│  │  │  ┌─────────────────┐  ┌─────────────────────────────────┐  │ │ │
│  │  │  │   NEW SPACE     │  │         OLD SPACE               │  │ │ │
│  │  │  │  (Young Gen)    │  │        (Old Gen)                │  │ │ │
│  │  │  │                 │  │                                 │  │ │ │
│  │  │  │ - Short-lived   │  │ - Long-lived objects            │  │ │ │
│  │  │  │   objects       │  │ - Survives multiple GC cycles   │  │ │ │
│  │  │  │ - Fast GC       │  │ - Controlled by                 │  │ │ │
│  │  │  │   (Scavenge)    │  │   --max-old-space-size          │  │ │ │
│  │  │  └─────────────────┘  └─────────────────────────────────┘  │ │ │
│  │  │                                                              │ │ │
│  │  │  ┌─────────────────┐  ┌─────────────────────────────────┐  │ │ │
│  │  │  │   CODE SPACE    │  │       LARGE OBJECT SPACE        │  │ │ │
│  │  │  │ Compiled code   │  │  Objects > 512KB                │  │ │ │
│  │  │  └─────────────────┘  └─────────────────────────────────┘  │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  │                                                                    │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │                   NATIVE MEMORY                              │ │ │
│  │  │           NOT managed by V8 garbage collector                │ │ │
│  │  │                                                              │ │ │
│  │  │  - Buffers (Buffer.alloc, Buffer.from)                       │ │ │
│  │  │  - Streams and file handles                                  │ │ │
│  │  │  - Native C++ addons                                         │ │ │
│  │  │  - External strings                                          │ │ │
│  │  │  - ArrayBuffer backing stores                                │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  │                                                                    │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │                   RUNTIME OVERHEAD                           │ │ │
│  │  │                                                              │ │ │
│  │  │  - Node.js runtime                                           │ │ │
│  │  │  - libuv event loop                                          │ │ │
│  │  │  - V8 engine overhead                                        │ │ │
│  │  │  - Stack memory                                              │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Key Memory Concepts

| Concept                     | Description                                             | Controlled By                      |
| --------------------------- | ------------------------------------------------------- | ---------------------------------- |
| **RSS (Resident Set Size)** | Total memory allocated to the Node.js process by the OS | Container memory limit             |
| **V8 Heap Total**           | Total heap memory allocated by V8                       | `--max-old-space-size` + new space |
| **V8 Heap Used**            | Heap memory currently in use by JavaScript objects      | Application code                   |
| **External Memory**         | Memory used by C++ objects bound to JavaScript          | Native modules, Buffers            |
| **Array Buffers**           | Memory for ArrayBuffer and TypedArray backing stores    | Application code                   |

#### Memory Metrics Explained

```typescript
import { memoryUsage } from 'process'

const usage = memoryUsage()

// RSS: Total memory allocated to the process
// This is what the container sees and limits
console.log(`RSS: ${usage.rss / 1024 / 1024} MB`)

// Heap Total: V8's total allocated heap
// May be less than --max-old-space-size until needed
console.log(`Heap Total: ${usage.heapTotal / 1024 / 1024} MB`)

// Heap Used: Currently used heap memory
// This is what your JavaScript objects consume
console.log(`Heap Used: ${usage.heapUsed / 1024 / 1024} MB`)

// External: Memory used by C++ objects (Buffers, etc.)
// NOT counted against V8 heap limit
console.log(`External: ${usage.external / 1024 / 1024} MB`)

// Array Buffers: Memory for ArrayBuffer backing stores
console.log(`Array Buffers: ${usage.arrayBuffers / 1024 / 1024} MB`)
```

#### RSS vs V8 Heap Relationship

The relationship between RSS and V8 heap is critical for container sizing:

```
RSS = V8 Heap Total + External Memory + Native Memory + Runtime Overhead
```

| Component        | Typical Size  | Notes                                |
| ---------------- | ------------- | ------------------------------------ |
| V8 Heap          | 50-75% of RSS | Controlled by `--max-old-space-size` |
| External/Native  | 10-30% of RSS | Buffers, streams, native modules     |
| Runtime Overhead | 50-100 MB     | Node.js, V8, libuv                   |

**Critical Rule**: The V8 heap limit (`--max-old-space-size`) MUST be set lower than the container memory limit to leave room for native memory and overhead.

### 7.2 Heap Configuration

Proper V8 heap configuration is essential for preventing Out of Memory (OOM) crashes and ensuring efficient garbage collection.

#### The --max-old-space-size Flag

The `--max-old-space-size` flag controls the maximum size of the V8 old generation heap in megabytes:

```bash
# Set maximum old space to 384MB
node --max-old-space-size=384 dist/index.js

# Or via NODE_OPTIONS environment variable
NODE_OPTIONS="--max-old-space-size=384" node dist/index.js
```

#### Configuration Guidelines

| Container Memory | Recommended `--max-old-space-size` | Calculation | Use Case              |
| ---------------- | ---------------------------------- | ----------- | --------------------- |
| 256Mi            | 150 MB                             | 256 × 0.60  | Lightweight services  |
| 512Mi            | 384 MB                             | 512 × 0.75  | Standard API services |
| 1Gi              | 768 MB                             | 1024 × 0.75 | Data processing       |
| 2Gi              | 1536 MB                            | 2048 × 0.75 | Heavy computation     |
| 4Gi              | 3072 MB                            | 4096 × 0.75 | Large datasets        |

**Rule**: Set `--max-old-space-size` to approximately **75%** of container memory for standard workloads, or **60%** for buffer-heavy workloads.

#### Configuration in Different Environments

**Dockerfile Configuration:**

```dockerfile
# ✅ CORRECT - Set heap limit relative to container memory
FROM node:22-alpine

# For 512Mi container
ENV NODE_OPTIONS="--max-old-space-size=384"

# ... rest of Dockerfile
```

**Cloud Run Deployment:**

```bash
# ✅ CORRECT - Set heap limit via environment variable
gcloud run deploy toast-stats-backend \
  --memory 512Mi \
  --set-env-vars "NODE_OPTIONS=--max-old-space-size=384"
```

**Package.json Scripts:**

```json
{
  "scripts": {
    "start": "node dist/index.js",
    "start:prod": "NODE_OPTIONS='--max-old-space-size=384' node dist/index.js"
  }
}
```

#### Heap Configuration Validation

Applications SHOULD validate heap configuration at startup:

```typescript
// ✅ CORRECT - Validate heap configuration at startup
import v8 from 'v8'

function validateHeapConfiguration(): void {
  const heapStats = v8.getHeapStatistics()
  const heapSizeLimit = heapStats.heap_size_limit
  const heapSizeLimitMB = Math.round(heapSizeLimit / 1024 / 1024)

  // Get container memory limit (if available)
  const containerMemoryMB = parseInt(
    process.env.CONTAINER_MEMORY_MB ?? '512',
    10
  )

  // Warn if heap limit is too high relative to container
  const heapRatio = heapSizeLimitMB / containerMemoryMB
  if (heapRatio > 0.85) {
    console.warn(
      `WARNING: V8 heap limit (${heapSizeLimitMB}MB) is ${Math.round(heapRatio * 100)}% ` +
        `of container memory (${containerMemoryMB}MB). Risk of OOM. ` +
        `Recommended: Set --max-old-space-size to ${Math.round(containerMemoryMB * 0.75)}MB`
    )
  }

  console.log(`V8 heap size limit: ${heapSizeLimitMB}MB`)
}

// Call at application startup
validateHeapConfiguration()
```

#### Garbage Collection Tuning

For most applications, default GC settings are appropriate. However, for specific workloads:

| Flag                    | Purpose                         | When to Use                     |
| ----------------------- | ------------------------------- | ------------------------------- |
| `--expose-gc`           | Allows manual GC triggering     | Testing, debugging only         |
| `--max-semi-space-size` | Controls new space size         | High object churn workloads     |
| `--optimize-for-size`   | Reduces memory at cost of speed | Memory-constrained environments |

**Warning**: Manual GC tuning is rarely needed and can hurt performance. Only tune GC settings with profiling data to justify changes.

### 7.3 Avoiding Unbounded Memory Growth

Unbounded memory growth is the most common cause of OOM crashes in Node.js applications. This section defines mandatory patterns to prevent memory leaks.

#### Common Sources of Memory Leaks

| Source               | Description                          | Prevention                             |
| -------------------- | ------------------------------------ | -------------------------------------- |
| **Unbounded caches** | Maps/objects that grow without limit | Use LRU cache with max size            |
| **Event listeners**  | Listeners added but never removed    | Always remove listeners on cleanup     |
| **Closures**         | Closures capturing large objects     | Avoid capturing unnecessary references |
| **Global state**     | Data accumulated in module scope     | Use bounded data structures            |
| **Timers**           | setInterval without clearInterval    | Always clear timers on shutdown        |
| **Streams**          | Streams not properly closed          | Always close/destroy streams           |

#### Mandatory Cache Patterns

All in-memory caches MUST be bounded with maximum size and TTL:

```typescript
// ❌ FORBIDDEN - Unbounded cache
const cache = new Map<string, Data>()

function getData(key: string): Data {
  if (!cache.has(key)) {
    cache.set(key, fetchData(key)) // Grows forever!
  }
  return cache.get(key)!
}

// ✅ CORRECT - Bounded LRU cache with TTL
import { LRUCache } from 'lru-cache'

const cache = new LRUCache<string, Data>({
  max: 1000, // Maximum 1000 entries
  maxSize: 50 * 1024 * 1024, // Maximum 50MB total size
  sizeCalculation: value => {
    // Calculate size of cached value
    return JSON.stringify(value).length
  },
  ttl: 5 * 60 * 1000, // 5 minute TTL
  updateAgeOnGet: true, // Reset TTL on access
  allowStale: false, // Don't serve stale data
})

function getData(key: string): Data | undefined {
  let data = cache.get(key)
  if (!data) {
    data = fetchData(key)
    cache.set(key, data)
  }
  return data
}
```

#### LRU Cache Configuration Requirements

| Parameter         | Requirement                      | Rationale                        |
| ----------------- | -------------------------------- | -------------------------------- |
| `max`             | MUST be set                      | Limits entry count               |
| `maxSize`         | SHOULD be set                    | Limits total memory              |
| `sizeCalculation` | MUST be set if using `maxSize`   | Accurate size tracking           |
| `ttl`             | SHOULD be set                    | Prevents stale data accumulation |
| `allowStale`      | SHOULD be `false` for most cases | Ensures data freshness           |

#### Event Listener Management

Event listeners MUST be properly managed to prevent memory leaks:

```typescript
// ❌ FORBIDDEN - Event listener without cleanup
class DataProcessor {
  constructor(private emitter: EventEmitter) {
    // Listener is never removed!
    emitter.on('data', this.handleData.bind(this))
  }

  handleData(data: Data): void {
    // Process data
  }
}

// ✅ CORRECT - Event listener with proper cleanup
class DataProcessor {
  private boundHandler: (data: Data) => void

  constructor(private emitter: EventEmitter) {
    this.boundHandler = this.handleData.bind(this)
    emitter.on('data', this.boundHandler)
  }

  handleData(data: Data): void {
    // Process data
  }

  // MUST be called when processor is no longer needed
  destroy(): void {
    this.emitter.off('data', this.boundHandler)
  }
}

// ✅ CORRECT - Using AbortController for cleanup
class DataProcessor {
  private abortController = new AbortController()

  constructor(private emitter: EventEmitter) {
    const { signal } = this.abortController

    emitter.on('data', this.handleData.bind(this), { signal })
  }

  handleData(data: Data): void {
    // Process data
  }

  destroy(): void {
    this.abortController.abort()
  }
}
```

#### Closure Memory Patterns

Closures can inadvertently capture large objects. Be explicit about what closures capture:

```typescript
// ❌ FORBIDDEN - Closure captures entire large object
function processLargeDataset(dataset: LargeDataset): () => Summary {
  // This closure captures the entire dataset!
  return () => {
    return { count: dataset.items.length }
  }
}

// ✅ CORRECT - Extract only needed data before creating closure
function processLargeDataset(dataset: LargeDataset): () => Summary {
  // Extract only what's needed
  const itemCount = dataset.items.length

  // Closure only captures the primitive value
  return () => {
    return { count: itemCount }
  }
}

// ❌ FORBIDDEN - Accumulating data in closure scope
function createAccumulator(): (item: Item) => void {
  const allItems: Item[] = [] // Grows unbounded!

  return (item: Item) => {
    allItems.push(item)
  }
}

// ✅ CORRECT - Bounded accumulation
function createAccumulator(maxItems: number): (item: Item) => void {
  const recentItems: Item[] = []

  return (item: Item) => {
    recentItems.push(item)
    // Keep only recent items
    while (recentItems.length > maxItems) {
      recentItems.shift()
    }
  }
}
```

#### Timer Management

Timers MUST be properly cleared to prevent memory leaks and zombie processes:

```typescript
// ❌ FORBIDDEN - Timer without cleanup
class HealthChecker {
  constructor() {
    // This timer runs forever, even after the checker is "destroyed"
    setInterval(() => this.check(), 30000)
  }

  check(): void {
    // Perform health check
  }
}

// ✅ CORRECT - Timer with proper cleanup
class HealthChecker {
  private intervalId: NodeJS.Timeout | null = null

  start(): void {
    if (this.intervalId) return // Prevent duplicate timers
    this.intervalId = setInterval(() => this.check(), 30000)
  }

  check(): void {
    // Perform health check
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}

// ✅ CORRECT - Using AbortSignal for timer cleanup
function startPeriodicTask(
  task: () => void,
  intervalMs: number,
  signal: AbortSignal
): void {
  const intervalId = setInterval(task, intervalMs)

  signal.addEventListener('abort', () => {
    clearInterval(intervalId)
  })
}

// Usage
const controller = new AbortController()
startPeriodicTask(() => console.log('tick'), 1000, controller.signal)

// Later, to stop:
controller.abort()
```

#### Memory Leak Detection

Applications SHOULD implement memory monitoring to detect leaks early:

```typescript
// ✅ CORRECT - Memory leak detection
import { memoryUsage } from 'process'

interface MemorySample {
  timestamp: number
  heapUsed: number
  rss: number
}

class MemoryMonitor {
  private samples: MemorySample[] = []
  private readonly maxSamples = 60 // Keep 1 hour of samples (1/min)
  private readonly leakThresholdMB = 50 // Alert if growth > 50MB/hour

  sample(): void {
    const usage = memoryUsage()
    this.samples.push({
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      rss: usage.rss,
    })

    // Keep bounded samples
    while (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }

    this.checkForLeak()
  }

  private checkForLeak(): void {
    if (this.samples.length < 10) return // Need enough samples

    const oldest = this.samples[0]
    const newest = this.samples[this.samples.length - 1]
    const heapGrowthMB = (newest.heapUsed - oldest.heapUsed) / 1024 / 1024
    const timeSpanHours = (newest.timestamp - oldest.timestamp) / 1000 / 60 / 60

    const growthRateMBPerHour = heapGrowthMB / timeSpanHours

    if (growthRateMBPerHour > this.leakThresholdMB) {
      console.warn(
        `Potential memory leak detected: heap growing at ${growthRateMBPerHour.toFixed(1)}MB/hour`
      )
    }
  }
}
```

### 7.4 Streaming Patterns

Streaming MUST be used when processing large datasets to avoid loading entire datasets into memory.

#### When to Use Streaming

| Data Size    | Approach           | Rationale                           |
| ------------ | ------------------ | ----------------------------------- |
| < 1 MB       | Load into memory   | Overhead of streaming not justified |
| 1-10 MB      | Consider streaming | Depends on concurrent requests      |
| > 10 MB      | MUST use streaming | Risk of memory exhaustion           |
| Unknown size | MUST use streaming | Cannot predict memory requirements  |

#### Stream Processing Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     STREAMING DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │  Source  │───►│Transform │───►│Transform │───►│   Destination    │  │
│  │  Stream  │    │ Stream 1 │    │ Stream 2 │    │     Stream       │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────────────┘  │
│       │               │               │                   │             │
│       ▼               ▼               ▼                   ▼             │
│   Read chunks    Process chunk   Process chunk      Write chunks       │
│   on demand      (parse, filter) (transform)        as available       │
│                                                                          │
│  MEMORY USAGE: Only current chunk in memory at any time                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### File Processing Streams

```typescript
// ❌ FORBIDDEN - Loading entire file into memory
import { readFile } from 'fs/promises'

async function processLargeFile(path: string): Promise<ProcessedData[]> {
  const content = await readFile(path, 'utf-8') // Entire file in memory!
  const lines = content.split('\n')
  return lines.map(line => processLine(line))
}

// ✅ CORRECT - Stream processing line by line
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

async function processLargeFile(path: string): Promise<void> {
  const fileStream = createReadStream(path)
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    await processLine(line) // Process one line at a time
  }
}

// ✅ CORRECT - Stream with transform for batch processing
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'

async function processLargeCSV(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const batchSize = 100
  let batch: Record[] = []

  const batchTransform = new Transform({
    objectMode: true,
    async transform(record, encoding, callback) {
      batch.push(record)

      if (batch.length >= batchSize) {
        const processed = await processBatch(batch)
        for (const item of processed) {
          this.push(item)
        }
        batch = []
      }

      callback()
    },
    async flush(callback) {
      // Process remaining items
      if (batch.length > 0) {
        const processed = await processBatch(batch)
        for (const item of processed) {
          this.push(item)
        }
      }
      callback()
    },
  })

  await pipeline(
    createReadStream(inputPath),
    csvParser(),
    batchTransform,
    csvStringifier(),
    createWriteStream(outputPath)
  )
}
```

#### HTTP Response Streaming

Large API responses SHOULD be streamed to reduce memory usage and improve time-to-first-byte:

```typescript
// ❌ FORBIDDEN - Building entire response in memory
router.get('/api/export', async (req, res) => {
  const allRecords = await db.collection('records').get() // All in memory!
  const data = allRecords.docs.map(doc => doc.data())
  res.json(data) // Serializes entire array
})

// ✅ CORRECT - Stream response as NDJSON
router.get('/api/export', async (req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Transfer-Encoding', 'chunked')

  const pageSize = 100
  let lastDoc: DocumentSnapshot | null = null

  while (true) {
    let query = db.collection('records').limit(pageSize)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }

    const snapshot = await query.get()
    if (snapshot.empty) break

    for (const doc of snapshot.docs) {
      // Write each record as a line of JSON
      res.write(JSON.stringify(doc.data()) + '\n')
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1]

    if (snapshot.docs.length < pageSize) break
  }

  res.end()
})

// ✅ CORRECT - Stream CSV export
import { stringify } from 'csv-stringify'

router.get('/api/export.csv', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="export.csv"')

  const stringifier = stringify({
    header: true,
    columns: ['id', 'name', 'value', 'timestamp'],
  })

  stringifier.pipe(res)

  const pageSize = 100
  let lastDoc: DocumentSnapshot | null = null

  while (true) {
    let query = db.collection('records').limit(pageSize)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }

    const snapshot = await query.get()
    if (snapshot.empty) break

    for (const doc of snapshot.docs) {
      stringifier.write(doc.data())
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1]

    if (snapshot.docs.length < pageSize) break
  }

  stringifier.end()
})
```

#### Stream Error Handling

Streams MUST handle errors properly to prevent resource leaks:

```typescript
// ✅ CORRECT - Proper stream error handling
import { pipeline } from 'stream/promises'

async function processStream(input: Readable, output: Writable): Promise<void> {
  try {
    await pipeline(input, transformStream, output)
  } catch (error) {
    // Pipeline automatically destroys all streams on error
    logger.error('Stream processing failed', error)
    throw error
  }
}

// ✅ CORRECT - Manual stream cleanup
function processStreamManual(input: Readable): Promise<Result> {
  return new Promise((resolve, reject) => {
    const results: Data[] = []

    input.on('data', chunk => {
      results.push(processChunk(chunk))
    })

    input.on('end', () => {
      resolve(aggregateResults(results))
    })

    input.on('error', error => {
      input.destroy() // Clean up the stream
      reject(error)
    })
  })
}
```

#### Backpressure Handling

Streams MUST implement backpressure to prevent memory exhaustion when producers are faster than consumers:

```typescript
// ❌ FORBIDDEN - Ignoring backpressure
async function copyData(source: Readable, dest: Writable): Promise<void> {
  for await (const chunk of source) {
    dest.write(chunk) // Ignores backpressure signal!
  }
  dest.end()
}

// ✅ CORRECT - Respecting backpressure
async function copyData(source: Readable, dest: Writable): Promise<void> {
  for await (const chunk of source) {
    const canContinue = dest.write(chunk)

    if (!canContinue) {
      // Wait for drain event before continuing
      await new Promise<void>(resolve => dest.once('drain', resolve))
    }
  }
  dest.end()
}

// ✅ CORRECT - Using pipeline (handles backpressure automatically)
import { pipeline } from 'stream/promises'

async function copyData(source: Readable, dest: Writable): Promise<void> {
  await pipeline(source, dest)
}
```

#### Stream Memory Limits

Configure stream buffers to prevent excessive memory usage:

```typescript
// ✅ CORRECT - Configure highWaterMark for memory control
import { createReadStream } from 'fs'

const stream = createReadStream(filePath, {
  highWaterMark: 64 * 1024, // 64KB buffer (default is 64KB)
})

// ✅ CORRECT - Custom transform with controlled buffering
import { Transform } from 'stream'

const transform = new Transform({
  highWaterMark: 16 * 1024, // 16KB buffer
  transform(chunk, encoding, callback) {
    // Process chunk
    callback(null, processedChunk)
  },
})
```

### 7.5 Pagination Requirements

All API endpoints returning collections MUST implement pagination to prevent unbounded memory usage and ensure consistent response times.

#### Pagination Strategy

| Strategy         | Use Case                       | Pros                             | Cons                                              |
| ---------------- | ------------------------------ | -------------------------------- | ------------------------------------------------- |
| **Offset-based** | Simple lists, UI tables        | Easy to implement, random access | Slow for large offsets, inconsistent with changes |
| **Cursor-based** | Large datasets, real-time data | Consistent, efficient            | No random access, more complex                    |
| **Keyset-based** | Sorted data, time-series       | Very efficient, consistent       | Requires sortable unique key                      |

**Recommendation**: Use cursor-based pagination for most API endpoints. Use offset-based only for small, static datasets.

#### Pagination Limits

| Parameter            | Minimum | Default | Maximum | Rationale                       |
| -------------------- | ------- | ------- | ------- | ------------------------------- |
| `limit` / `pageSize` | 1       | 20      | 100     | Prevents excessive memory usage |
| `offset`             | 0       | 0       | 10,000  | Prevents slow queries           |

#### Cursor-Based Pagination Implementation

```typescript
// ✅ CORRECT - Cursor-based pagination
interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    hasMore: boolean
    nextCursor: string | null
    prevCursor: string | null
  }
}

interface PaginationParams {
  cursor?: string
  limit?: number
  direction?: 'forward' | 'backward'
}

async function getDistricts(
  params: PaginationParams
): Promise<PaginatedResponse<District>> {
  const limit = Math.min(params.limit ?? 20, 100) // Enforce maximum
  const direction = params.direction ?? 'forward'

  let query = db
    .collection('districts')
    .orderBy('name')
    .limit(limit + 1) // Fetch one extra to check hasMore

  if (params.cursor) {
    const cursorDoc = await db.collection('districts').doc(params.cursor).get()
    if (cursorDoc.exists) {
      query =
        direction === 'forward'
          ? query.startAfter(cursorDoc)
          : query.endBefore(cursorDoc)
    }
  }

  const snapshot = await query.get()
  const docs = snapshot.docs

  // Check if there are more results
  const hasMore = docs.length > limit
  const data = docs.slice(0, limit).map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as District[]

  return {
    data,
    pagination: {
      hasMore,
      nextCursor: hasMore ? docs[limit - 1].id : null,
      prevCursor: data.length > 0 ? data[0].id : null,
    },
  }
}
```

#### Offset-Based Pagination Implementation

```typescript
// ✅ CORRECT - Offset-based pagination with limits
interface OffsetPaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    offset: number
    limit: number
    hasMore: boolean
  }
}

async function getDistrictsOffset(
  offset: number = 0,
  limit: number = 20
): Promise<OffsetPaginatedResponse<District>> {
  // Enforce limits
  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const safeOffset = Math.min(Math.max(offset, 0), 10000)

  // Get total count (cache this if expensive)
  const countSnapshot = await db.collection('districts').count().get()
  const total = countSnapshot.data().count

  // Get page of data
  const snapshot = await db
    .collection('districts')
    .orderBy('name')
    .offset(safeOffset)
    .limit(safeLimit)
    .get()

  const data = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as District[]

  return {
    data,
    pagination: {
      total,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: safeOffset + data.length < total,
    },
  }
}
```

#### API Response Format

Paginated endpoints MUST return consistent response structures:

```typescript
// ✅ CORRECT - Consistent pagination response format
interface ApiPaginatedResponse<T> {
  data: T[]
  meta: {
    pagination: {
      // Cursor-based
      cursor?: string
      nextCursor?: string | null
      prevCursor?: string | null

      // Offset-based
      offset?: number
      limit: number
      total?: number

      // Common
      hasMore: boolean
      count: number  // Items in current page
    }
  }
}

// Example response
{
  "data": [
    { "id": "d1", "name": "District 1" },
    { "id": "d2", "name": "District 2" }
  ],
  "meta": {
    "pagination": {
      "cursor": "d2",
      "nextCursor": "d3",
      "prevCursor": null,
      "limit": 20,
      "hasMore": true,
      "count": 2
    }
  }
}
```

#### Pagination Validation

All pagination parameters MUST be validated:

```typescript
import { z } from 'zod'

// ✅ CORRECT - Pagination parameter validation
const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(['forward', 'backward']).default('forward'),
})

const OffsetPaginationSchema = z.object({
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Usage in route handler
router.get('/api/districts', async (req, res) => {
  const result = CursorPaginationSchema.safeParse(req.query)

  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'INVALID_PAGINATION',
        message: 'Invalid pagination parameters',
        details: result.error.flatten(),
      },
    })
  }

  const { cursor, limit, direction } = result.data
  const response = await getDistricts({ cursor, limit, direction })
  res.json(response)
})
```

#### Prohibited Pagination Patterns

```typescript
// ❌ FORBIDDEN - No pagination on collection endpoints
router.get('/api/districts', async (req, res) => {
  const snapshot = await db.collection('districts').get()
  res.json(snapshot.docs.map(doc => doc.data())) // Could be thousands!
})

// ❌ FORBIDDEN - Unlimited page size
router.get('/api/districts', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 1000 // No maximum!
  // ...
})

// ❌ FORBIDDEN - Fetching all then slicing in memory
router.get('/api/districts', async (req, res) => {
  const allDocs = await db.collection('districts').get() // All in memory!
  const page = allDocs.docs.slice(offset, offset + limit)
  // ...
})

// ✅ CORRECT - Database-level pagination
router.get('/api/districts', async (req, res) => {
  const { limit, cursor } = validatePagination(req.query)

  let query = db
    .collection('districts')
    .orderBy('name')
    .limit(limit + 1)

  if (cursor) {
    query = query.startAfter(cursor)
  }

  const snapshot = await query.get()
  // ...
})
```

---

## 8. Concurrency and Backpressure

This section defines mandatory patterns for managing concurrency and implementing backpressure in Node.js applications running on Cloud Run. Proper concurrency management prevents overload, ensures stable performance under load, and avoids common pitfalls that lead to service degradation.

### 8.1 Cloud Run Concurrency

Cloud Run allows multiple concurrent requests to be processed by a single container instance. Understanding and properly configuring concurrency is essential for optimal performance and resource utilization.

#### Concurrency Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLOUD RUN CONCURRENCY MODEL                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    INCOMING REQUESTS                              │   │
│  │                                                                    │   │
│  │    ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐        │   │
│  │    │R1 │ │R2 │ │R3 │ │R4 │ │R5 │ │R6 │ │R7 │ │R8 │ │R9 │ ...    │   │
│  │    └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘        │   │
│  └──────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼───────────┘   │
│         │     │     │     │     │     │     │     │     │               │
│         ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    CLOUD RUN LOAD BALANCER                        │   │
│  │                                                                    │   │
│  │  Distributes requests based on:                                   │   │
│  │  - Instance concurrency setting                                   │   │
│  │  - Current instance load                                          │   │
│  │  - Instance availability                                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│         │           │           │           │                           │
│         ▼           ▼           ▼           ▼                           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ Instance 1 │ │ Instance 2 │ │ Instance 3 │ │ Instance N │           │
│  │            │ │            │ │            │ │            │           │
│  │ Concurrency│ │ Concurrency│ │ Concurrency│ │ Concurrency│           │
│  │ = 80       │ │ = 80       │ │ = 80       │ │ = 80       │           │
│  │            │ │            │ │            │ │            │           │
│  │ ┌──┐ ┌──┐  │ │ ┌──┐ ┌──┐  │ │ ┌──┐ ┌──┐  │ │ ┌──┐ ┌──┐  │           │
│  │ │R1│ │R2│  │ │ │R3│ │R4│  │ │ │R5│ │R6│  │ │ │R7│ │R8│  │           │
│  │ └──┘ └──┘  │ │ └──┘ └──┘  │ │ └──┘ └──┘  │ │ └──┘ └──┘  │           │
│  │   ...      │ │   ...      │ │   ...      │ │   ...      │           │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘           │
│                                                                          │
│  KEY INSIGHT: Each instance handles up to N concurrent requests         │
│  Node.js event loop processes all requests on a single thread           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Cloud Run Concurrency Settings

The `--concurrency` flag controls how many requests a single instance can handle simultaneously:

| Concurrency Setting | Use Case                           | Memory Impact       | CPU Impact          |
| ------------------- | ---------------------------------- | ------------------- | ------------------- |
| **1**               | CPU-intensive, stateful operations | Minimal per-request | Maximum per-request |
| **10-20**           | CPU-bound with some I/O            | Moderate            | High                |
| **40-60**           | Mixed CPU and I/O workloads        | Moderate-High       | Moderate            |
| **80** (default)    | I/O-bound operations               | High                | Low-Moderate        |
| **100-250**         | Lightweight, fast I/O operations   | Very High           | Low                 |
| **1000** (max)      | Proxy/gateway services             | Extreme             | Minimal             |

#### Concurrency Configuration Requirements

Concurrency MUST be configured based on workload characteristics:

```bash
# ✅ CORRECT - I/O-bound service (default)
gcloud run deploy toast-stats-backend \
  --concurrency 80 \
  --memory 512Mi \
  --cpu 1

# ✅ CORRECT - CPU-intensive analytics service
gcloud run deploy analytics-service \
  --concurrency 20 \
  --memory 1Gi \
  --cpu 2

# ✅ CORRECT - Memory-intensive data processing
gcloud run deploy data-processor \
  --concurrency 40 \
  --memory 2Gi \
  --cpu 1
```

#### Concurrency Calculation Formula

To determine optimal concurrency, use this formula:

```
Optimal Concurrency = Container Memory / (Base Memory + Per-Request Memory)
```

| Container Memory | Base Memory | Per-Request Memory | Recommended Concurrency |
| ---------------- | ----------- | ------------------ | ----------------------- |
| 256Mi            | 100MB       | 2MB                | ~75                     |
| 512Mi            | 150MB       | 4MB                | ~80                     |
| 1Gi              | 200MB       | 8MB                | ~100                    |
| 2Gi              | 300MB       | 10MB               | ~170                    |

**Rule**: Concurrency SHOULD be set such that `Base Memory + (Concurrency × Per-Request Memory) < 85% of Container Memory`.

#### Request Handling Guidelines

When handling concurrent requests, the following patterns MUST be followed:

```typescript
// ❌ FORBIDDEN - Blocking the event loop
router.get('/api/compute', (req, res) => {
  // This blocks ALL concurrent requests!
  const result = expensiveSynchronousComputation(req.query.data)
  res.json(result)
})

// ✅ CORRECT - Non-blocking async operations
router.get('/api/compute', async (req, res) => {
  // Yields to event loop, allowing other requests to proceed
  const result = await computeAsync(req.query.data)
  res.json(result)
})

// ✅ CORRECT - Offload CPU-intensive work to worker threads
import { Worker } from 'worker_threads'

router.get('/api/heavy-compute', async (req, res) => {
  const result = await runInWorker(req.query.data)
  res.json(result)
})

async function runInWorker(data: string): Promise<Result> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./compute-worker.js', { workerData: data })
    worker.on('message', resolve)
    worker.on('error', reject)
  })
}
```

#### Concurrency Monitoring

Concurrency utilization MUST be monitored to detect capacity issues:

| Metric                | Source             | Alert Threshold            |
| --------------------- | ------------------ | -------------------------- |
| Active request count  | Cloud Run metrics  | > 90% of concurrency limit |
| Request queue time    | Structured logging | > 100ms average            |
| Instance count at max | Cloud Run metrics  | Sustained at max instances |
| Request timeouts      | Cloud Run metrics  | > 0.1% of requests         |

### 8.2 Bounded Concurrency Patterns

When processing multiple items or making parallel external calls, concurrency MUST be bounded to prevent resource exhaustion and cascading failures.

#### The p-limit Pattern

The `p-limit` library MUST be used for bounded concurrency in parallel operations:

```typescript
import pLimit from 'p-limit'

// ✅ CORRECT - Bounded parallel processing
const limit = pLimit(5) // Maximum 5 concurrent operations

async function processItems(items: Item[]): Promise<Result[]> {
  return Promise.all(items.map(item => limit(() => processItem(item))))
}

// ❌ FORBIDDEN - Unbounded parallel processing
async function processItemsUnbounded(items: Item[]): Promise<Result[]> {
  // Could spawn thousands of concurrent operations!
  return Promise.all(items.map(item => processItem(item)))
}
```

#### Concurrency Limits by Operation Type

Different operations require different concurrency limits:

| Operation Type             | Recommended Limit      | Rationale                                       |
| -------------------------- | ---------------------- | ----------------------------------------------- |
| **Database queries**       | 5-10                   | Prevent connection pool exhaustion              |
| **External API calls**     | 3-5                    | Respect rate limits, prevent cascading failures |
| **File I/O operations**    | 10-20                  | Balance throughput with file descriptor limits  |
| **CPU-intensive tasks**    | 1-2 per CPU core       | Prevent CPU saturation                          |
| **Memory-intensive tasks** | Based on memory budget | Prevent OOM                                     |

#### Advanced p-limit Patterns

```typescript
import pLimit from 'p-limit'

// ✅ CORRECT - Different limits for different resource types
const dbLimit = pLimit(10) // Database operations
const apiLimit = pLimit(5) // External API calls
const cpuLimit = pLimit(2) // CPU-intensive work

async function processDistrict(districtId: string): Promise<DistrictData> {
  // Fetch from database with DB concurrency limit
  const district = await dbLimit(() =>
    db.collection('districts').doc(districtId).get()
  )

  // Call external API with API concurrency limit
  const externalData = await apiLimit(() => fetchExternalData(districtId))

  // Process with CPU concurrency limit
  const computed = await cpuLimit(() =>
    computeStatistics(district, externalData)
  )

  return computed
}

// ✅ CORRECT - Nested concurrency control
async function processAllDistricts(districtIds: string[]): Promise<void> {
  const outerLimit = pLimit(10) // Process 10 districts at a time

  await Promise.all(
    districtIds.map(id => outerLimit(() => processDistrict(id)))
  )
}
```

#### Semaphore Pattern for Resource Protection

For protecting shared resources, use a semaphore pattern:

```typescript
// ✅ CORRECT - Semaphore for connection pool protection
class ConnectionPool {
  private semaphore: pLimit.Limit
  private connections: Connection[] = []

  constructor(maxConnections: number) {
    this.semaphore = pLimit(maxConnections)
  }

  async withConnection<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
    return this.semaphore(async () => {
      const conn = await this.acquireConnection()
      try {
        return await fn(conn)
      } finally {
        this.releaseConnection(conn)
      }
    })
  }

  private async acquireConnection(): Promise<Connection> {
    // Get or create connection
    return this.connections.pop() ?? (await this.createConnection())
  }

  private releaseConnection(conn: Connection): void {
    this.connections.push(conn)
  }

  private async createConnection(): Promise<Connection> {
    // Create new connection
    return new Connection()
  }
}

// Usage
const pool = new ConnectionPool(10)

async function queryDatabase(sql: string): Promise<Result> {
  return pool.withConnection(async conn => {
    return conn.query(sql)
  })
}
```

### 8.3 Backpressure Handling

Backpressure is a mechanism to slow down producers when consumers cannot keep up. Proper backpressure handling prevents memory exhaustion and ensures system stability under load.

#### Backpressure Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      BACKPRESSURE FLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WITHOUT BACKPRESSURE:                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                        │
│  │ Producer │────►│  Buffer  │────►│ Consumer │                        │
│  │ (Fast)   │     │ (Grows!) │     │ (Slow)   │                        │
│  └──────────┘     └──────────┘     └──────────┘                        │
│       │                │                                                │
│       │                ▼                                                │
│       │         MEMORY EXHAUSTION                                       │
│       │                                                                 │
│  WITH BACKPRESSURE:                                                     │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                        │
│  │ Producer │◄───►│  Buffer  │────►│ Consumer │                        │
│  │ (Slowed) │     │ (Bounded)│     │ (Slow)   │                        │
│  └──────────┘     └──────────┘     └──────────┘                        │
│       │                │                │                               │
│       │                │                │                               │
│       ▼                ▼                ▼                               │
│   Waits when       Fixed size      Signals when                        │
│   buffer full      (highWaterMark) ready for more                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Stream Backpressure

Node.js streams have built-in backpressure support. It MUST be respected:

```typescript
import { Readable, Writable } from 'stream'

// ❌ FORBIDDEN - Ignoring backpressure
async function copyIgnoringBackpressure(
  source: Readable,
  dest: Writable
): Promise<void> {
  for await (const chunk of source) {
    dest.write(chunk) // Ignores return value!
  }
  dest.end()
}

// ✅ CORRECT - Respecting backpressure
async function copyWithBackpressure(
  source: Readable,
  dest: Writable
): Promise<void> {
  for await (const chunk of source) {
    const canContinue = dest.write(chunk)

    if (!canContinue) {
      // Buffer is full, wait for drain
      await new Promise<void>(resolve => dest.once('drain', resolve))
    }
  }
  dest.end()
}

// ✅ CORRECT - Using pipeline (recommended)
import { pipeline } from 'stream/promises'

async function copyWithPipeline(
  source: Readable,
  dest: Writable
): Promise<void> {
  await pipeline(source, dest) // Handles backpressure automatically
}
```

#### Queue-Based Backpressure

For request processing, implement queue-based backpressure:

```typescript
// ✅ CORRECT - Bounded queue with backpressure
class BoundedQueue<T> {
  private queue: T[] = []
  private waitingConsumers: Array<(item: T) => void> = []
  private waitingProducers: Array<() => void> = []

  constructor(private readonly maxSize: number) {}

  async enqueue(item: T): Promise<void> {
    if (this.queue.length >= this.maxSize) {
      // Queue full, wait for space
      await new Promise<void>(resolve => {
        this.waitingProducers.push(resolve)
      })
    }

    // Check if consumer is waiting
    const consumer = this.waitingConsumers.shift()
    if (consumer) {
      consumer(item)
    } else {
      this.queue.push(item)
    }
  }

  async dequeue(): Promise<T> {
    if (this.queue.length === 0) {
      // Queue empty, wait for item
      return new Promise<T>(resolve => {
        this.waitingConsumers.push(resolve)
      })
    }

    const item = this.queue.shift()!

    // Signal waiting producer
    const producer = this.waitingProducers.shift()
    if (producer) {
      producer()
    }

    return item
  }

  get size(): number {
    return this.queue.length
  }

  get isFull(): boolean {
    return this.queue.length >= this.maxSize
  }
}

// Usage
const requestQueue = new BoundedQueue<Request>(100)

// Producer (request handler)
router.post('/api/process', async (req, res) => {
  if (requestQueue.isFull) {
    // Return 503 Service Unavailable with Retry-After
    res
      .status(503)
      .set('Retry-After', '5')
      .json({ error: { code: 'SERVICE_BUSY', message: 'Server is busy' } })
    return
  }

  await requestQueue.enqueue(req.body)
  res.status(202).json({ status: 'queued' })
})

// Consumer (background processor)
async function processQueue(): Promise<void> {
  while (true) {
    const request = await requestQueue.dequeue()
    await processRequest(request)
  }
}
```

#### HTTP Backpressure Responses

When the service is overloaded, proper HTTP responses MUST be returned:

| Condition        | HTTP Status             | Headers          | Response                                  |
| ---------------- | ----------------------- | ---------------- | ----------------------------------------- |
| Queue full       | 503 Service Unavailable | `Retry-After: N` | `{ "error": { "code": "SERVICE_BUSY" } }` |
| Rate limited     | 429 Too Many Requests   | `Retry-After: N` | `{ "error": { "code": "RATE_LIMITED" } }` |
| Timeout imminent | 504 Gateway Timeout     | -                | `{ "error": { "code": "TIMEOUT" } }`      |

```typescript
// ✅ CORRECT - Backpressure-aware request handler
import pLimit from 'p-limit'

const processingLimit = pLimit(50) // Max 50 concurrent processing operations
let activeRequests = 0
const MAX_QUEUE_DEPTH = 100

router.post('/api/heavy-operation', async (req, res) => {
  // Check if we're at capacity
  if (activeRequests >= MAX_QUEUE_DEPTH) {
    res
      .status(503)
      .set('Retry-After', '10')
      .json({
        error: {
          code: 'SERVICE_BUSY',
          message: 'Server is at capacity, please retry later',
          retryAfter: 10,
        },
      })
    return
  }

  activeRequests++

  try {
    const result = await processingLimit(async () => {
      return await heavyOperation(req.body)
    })
    res.json(result)
  } finally {
    activeRequests--
  }
})
```

### 8.4 Common Node.js Pitfalls

This section documents common Node.js performance pitfalls and mandatory patterns to avoid them.

#### Pitfall 1: Blocking the Event Loop

The Node.js event loop is single-threaded. Blocking operations prevent ALL concurrent requests from being processed.

```typescript
// ❌ FORBIDDEN - Synchronous file operations
import { readFileSync, writeFileSync } from 'fs'

function processFile(path: string): Data {
  const content = readFileSync(path, 'utf-8') // BLOCKS!
  const processed = transform(content)
  writeFileSync(outputPath, processed) // BLOCKS!
  return processed
}

// ✅ CORRECT - Asynchronous file operations
import { readFile, writeFile } from 'fs/promises'

async function processFile(path: string): Promise<Data> {
  const content = await readFile(path, 'utf-8') // Non-blocking
  const processed = transform(content)
  await writeFile(outputPath, processed) // Non-blocking
  return processed
}

// ❌ FORBIDDEN - CPU-intensive synchronous computation
function computeHash(data: string): string {
  // Long-running CPU work blocks event loop
  let hash = 0
  for (let i = 0; i < data.length * 1000000; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i % data.length)) | 0
  }
  return hash.toString(16)
}

// ✅ CORRECT - Offload to worker thread
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'

async function computeHashAsync(data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { data } })
    worker.on('message', resolve)
    worker.on('error', reject)
  })
}

if (!isMainThread) {
  // Worker thread code
  const { data } = workerData
  const hash = computeHashSync(data)
  parentPort?.postMessage(hash)
}
```

#### Pitfall 2: Unbounded Promise.all

`Promise.all` with large arrays can spawn thousands of concurrent operations, exhausting memory and connections.

```typescript
// ❌ FORBIDDEN - Unbounded parallel operations
async function fetchAllUsers(userIds: string[]): Promise<User[]> {
  // Could spawn 10,000+ concurrent database queries!
  return Promise.all(userIds.map(id => fetchUser(id)))
}

// ✅ CORRECT - Bounded parallel operations
import pLimit from 'p-limit'

const limit = pLimit(10)

async function fetchAllUsers(userIds: string[]): Promise<User[]> {
  return Promise.all(userIds.map(id => limit(() => fetchUser(id))))
}

// ✅ CORRECT - Batch processing for very large sets
async function fetchAllUsersBatched(userIds: string[]): Promise<User[]> {
  const batchSize = 100
  const results: User[] = []

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(id => limit(() => fetchUser(id)))
    )
    results.push(...batchResults)
  }

  return results
}
```

#### Pitfall 3: Missing Timeouts

Operations without timeouts can hang indefinitely, consuming resources and blocking request completion.

```typescript
// ❌ FORBIDDEN - No timeout on external call
async function fetchExternalData(url: string): Promise<Data> {
  const response = await fetch(url) // Could hang forever!
  return response.json()
}

// ✅ CORRECT - Timeout with AbortController
async function fetchExternalData(
  url: string,
  timeoutMs: number = 5000
): Promise<Data> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// ✅ CORRECT - Generic timeout wrapper
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId!)
  }
}

// Usage
const result = await withTimeout(fetchData(), 5000, 'Data fetch timed out')
```

#### Pitfall 4: Memory Leaks from Closures and Listeners

Closures and event listeners can inadvertently retain references to large objects.

```typescript
// ❌ FORBIDDEN - Closure retains large object
function createProcessor(largeDataset: LargeData[]): () => number {
  // Closure captures entire largeDataset!
  return () => {
    return largeDataset.length
  }
}

// ✅ CORRECT - Extract only needed data
function createProcessor(largeDataset: LargeData[]): () => number {
  const count = largeDataset.length // Extract primitive
  return () => count
}

// ❌ FORBIDDEN - Event listener never removed
class DataService {
  constructor(private eventBus: EventEmitter) {
    // This listener is never removed!
    eventBus.on('data', data => this.handleData(data))
  }

  handleData(data: Data): void {
    // Process data
  }
}

// ✅ CORRECT - Proper cleanup with AbortController
class DataService {
  private abortController = new AbortController()

  constructor(private eventBus: EventEmitter) {
    const { signal } = this.abortController
    eventBus.on('data', this.handleData.bind(this), { signal })
  }

  handleData(data: Data): void {
    // Process data
  }

  destroy(): void {
    this.abortController.abort()
  }
}
```

#### Pitfall 5: Unhandled Promise Rejections

Unhandled promise rejections can cause memory leaks and unexpected behavior.

```typescript
// ❌ FORBIDDEN - Fire-and-forget async operation
function triggerBackgroundTask(): void {
  processInBackground() // Promise rejection is lost!
}

// ✅ CORRECT - Handle errors in background tasks
function triggerBackgroundTask(): void {
  processInBackground().catch(error => {
    logger.error('Background task failed', error)
  })
}

// ✅ CORRECT - Global unhandled rejection handler (safety net)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Application-specific handling
})
```

#### Pitfall Summary Table

| Pitfall                   | Symptom                               | Prevention                                        |
| ------------------------- | ------------------------------------- | ------------------------------------------------- |
| **Blocking event loop**   | High latency, timeouts                | Use async APIs, worker threads                    |
| **Unbounded Promise.all** | Memory exhaustion, connection errors  | Use p-limit for bounded concurrency               |
| **Missing timeouts**      | Hanging requests, resource exhaustion | Always set timeouts on external calls             |
| **Closure memory leaks**  | Growing memory over time              | Extract primitives, avoid capturing large objects |
| **Listener memory leaks** | Growing memory, duplicate handlers    | Use AbortController, implement cleanup            |
| **Unhandled rejections**  | Silent failures, memory leaks         | Always handle promise rejections                  |

### 8.5 Diagnostics and Tooling

Proper diagnostics and tooling are essential for identifying and resolving performance issues. This section specifies mandatory monitoring, profiling, and debugging requirements.

#### Required Metrics Collection

The following metrics MUST be collected for concurrency and performance monitoring:

| Metric                      | Collection Method                | Purpose                    |
| --------------------------- | -------------------------------- | -------------------------- |
| **Event loop lag**          | `perf_hooks` or `event-loop-lag` | Detect blocking operations |
| **Active handles/requests** | `process._getActiveHandles()`    | Detect resource leaks      |
| **Heap usage**              | `process.memoryUsage()`          | Monitor memory consumption |
| **GC metrics**              | `--expose-gc` + `perf_hooks`     | Understand GC impact       |
| **Request concurrency**     | Custom counter                   | Monitor load distribution  |
| **Queue depth**             | Custom metric                    | Detect backpressure needs  |

#### Event Loop Monitoring

Event loop lag MUST be monitored to detect blocking operations:

```typescript
// ✅ CORRECT - Event loop lag monitoring
import { monitorEventLoopDelay } from 'perf_hooks'

const histogram = monitorEventLoopDelay({ resolution: 20 })
histogram.enable()

// Log event loop metrics periodically
setInterval(() => {
  const stats = {
    min: histogram.min / 1e6, // Convert to ms
    max: histogram.max / 1e6,
    mean: histogram.mean / 1e6,
    p50: histogram.percentile(50) / 1e6,
    p99: histogram.percentile(99) / 1e6,
  }

  logger.info('Event loop metrics', {
    metric: {
      name: 'nodejs_eventloop_lag_ms',
      value: stats.mean,
      unit: 'milliseconds',
      labels: { percentile: 'mean' },
    },
  })

  // Alert on high event loop lag
  if (stats.p99 > 100) {
    logger.warn('High event loop lag detected', { stats })
  }

  histogram.reset()
}, 60000) // Every minute
```

#### Memory Diagnostics

Memory usage MUST be tracked and logged:

```typescript
// ✅ CORRECT - Comprehensive memory monitoring
import { memoryUsage } from 'process'
import v8 from 'v8'

interface MemoryMetrics {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  heapSizeLimit: number
  heapUsedPercent: number
}

function collectMemoryMetrics(): MemoryMetrics {
  const usage = memoryUsage()
  const heapStats = v8.getHeapStatistics()

  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss,
    heapSizeLimit: heapStats.heap_size_limit,
    heapUsedPercent: (usage.heapUsed / heapStats.heap_size_limit) * 100,
  }
}

// Log memory metrics periodically
setInterval(() => {
  const metrics = collectMemoryMetrics()

  logger.info('Memory metrics', {
    heapUsedMB: Math.round(metrics.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(metrics.heapTotal / 1024 / 1024),
    rssMB: Math.round(metrics.rss / 1024 / 1024),
    heapUsedPercent: Math.round(metrics.heapUsedPercent),
  })

  // Alert on high memory usage
  if (metrics.heapUsedPercent > 85) {
    logger.warn('High heap usage', {
      heapUsedPercent: metrics.heapUsedPercent,
    })
  }
}, 60000)
```

#### Request Tracing

Distributed tracing MUST be implemented for request correlation:

```typescript
// ✅ CORRECT - Request tracing middleware
import { randomUUID } from 'crypto'
import { AsyncLocalStorage } from 'async_hooks'

interface RequestContext {
  requestId: string
  traceId: string
  spanId: string
  startTime: number
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>()

export function tracingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const context: RequestContext = {
    requestId: req.get('X-Request-ID') ?? randomUUID(),
    traceId: req.get('X-Cloud-Trace-Context')?.split('/')[0] ?? randomUUID(),
    spanId: randomUUID().substring(0, 16),
    startTime: Date.now(),
  }

  // Set response headers for correlation
  res.set('X-Request-ID', context.requestId)

  // Run request with context
  asyncLocalStorage.run(context, () => {
    res.on('finish', () => {
      const duration = Date.now() - context.startTime
      logger.info('Request completed', {
        requestId: context.requestId,
        traceId: context.traceId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      })
    })

    next()
  })
}

// Get current request context
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore()
}
```

#### Profiling Tools

The following profiling tools SHOULD be available for debugging:

| Tool                  | Purpose                       | When to Use               |
| --------------------- | ----------------------------- | ------------------------- |
| **Node.js Inspector** | CPU profiling, heap snapshots | Development, staging      |
| **Clinic.js**         | Performance analysis suite    | Development               |
| **0x**                | Flame graph generation        | CPU bottleneck analysis   |
| **heapdump**          | Heap snapshot generation      | Memory leak investigation |
| **v8-profiler-next**  | Programmatic profiling        | Production debugging      |

#### Production Debugging Endpoints

For production debugging, the following diagnostic endpoints MAY be implemented with appropriate access controls:

```typescript
// ✅ CORRECT - Diagnostic endpoints (admin-only)
import { memoryUsage } from 'process'
import v8 from 'v8'

// Health check with diagnostics
router.get('/health/diagnostics', requireAdmin, (req, res) => {
  const memory = memoryUsage()
  const heapStats = v8.getHeapStatistics()

  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
      rssMB: Math.round(memory.rss / 1024 / 1024),
      externalMB: Math.round(memory.external / 1024 / 1024),
      heapSizeLimitMB: Math.round(heapStats.heap_size_limit / 1024 / 1024),
    },
    handles: {
      active: process._getActiveHandles?.().length ?? 'unavailable',
      requests: process._getActiveRequests?.().length ?? 'unavailable',
    },
    versions: process.versions,
  })
})

// Heap snapshot endpoint (use with caution)
router.post('/admin/heap-snapshot', requireAdmin, async (req, res) => {
  const filename = `heap-${Date.now()}.heapsnapshot`

  // Write heap snapshot
  v8.writeHeapSnapshot(filename)

  logger.warn('Heap snapshot created', { filename })
  res.json({ filename, message: 'Heap snapshot created' })
})
```

#### Alerting Thresholds

The following alerting thresholds MUST be configured:

| Metric                | Warning | Critical | Action                             |
| --------------------- | ------- | -------- | ---------------------------------- |
| Event loop lag (p99)  | > 50ms  | > 100ms  | Investigate blocking operations    |
| Heap usage            | > 75%   | > 90%    | Check for memory leaks             |
| Active handles        | > 1000  | > 5000   | Check for resource leaks           |
| Request queue depth   | > 50    | > 100    | Scale up or implement backpressure |
| Error rate            | > 1%    | > 5%     | Investigate errors                 |
| Request latency (p99) | > 1s    | > 2s     | Optimize slow endpoints            |

---

## 9. Implementation Patterns and Guardrails

This section provides ready-to-use implementation patterns and deployment guardrails for achieving performance SLOs. These patterns are designed to be copy-paste ready while following all conventions defined in this document.

### 9.1 Bounded Concurrency Implementation

All parallel operations MUST use bounded concurrency to prevent resource exhaustion. The `p-limit` library is the standard solution for this requirement.

#### Standard p-limit Configuration

```typescript
import pLimit from 'p-limit'

// ✅ CORRECT - Create bounded concurrency limits by resource type
const limits = {
  database: pLimit(10), // Database operations
  externalApi: pLimit(5), // External API calls
  fileSystem: pLimit(20), // File I/O operations
  cpuIntensive: pLimit(2), // CPU-bound work (per core)
  memoryIntensive: pLimit(5), // Memory-heavy operations
}

// ✅ CORRECT - Use appropriate limit for each operation type
async function processDistrictData(districtId: string): Promise<DistrictData> {
  // Database fetch with database limit
  const rawData = await limits.database(() =>
    db.collection('districts').doc(districtId).get()
  )

  // External API call with API limit
  const enrichedData = await limits.externalApi(() =>
    fetchExternalEnrichment(districtId)
  )

  // CPU-intensive computation with CPU limit
  const computed = await limits.cpuIntensive(() =>
    computeStatistics(rawData, enrichedData)
  )

  return computed
}
```

#### Batch Processing with Bounded Concurrency

```typescript
// ✅ CORRECT - Process large arrays with bounded concurrency
async function processAllItems<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrencyLimit: number = 10
): Promise<R[]> {
  const limit = pLimit(concurrencyLimit)

  return Promise.all(items.map(item => limit(() => processor(item))))
}

// ✅ CORRECT - Batch processing with progress tracking
async function processBatchedWithProgress<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    concurrency?: number
    batchSize?: number
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<R[]> {
  const { concurrency = 10, batchSize = 100, onProgress } = options
  const limit = pLimit(concurrency)
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(item => limit(() => processor(item)))
    )
    results.push(...batchResults)
    onProgress?.(results.length, items.length)
  }

  return results
}

// Usage example
const districts = await processBatchedWithProgress(
  districtIds,
  fetchDistrictData,
  {
    concurrency: 5,
    batchSize: 50,
    onProgress: (done, total) => {
      logger.info(`Progress: ${done}/${total} districts processed`)
    },
  }
)
```

#### Concurrency Limit Configuration Table

| Operation Type         | Recommended Limit | Maximum Limit | Rationale                                       |
| ---------------------- | ----------------- | ------------- | ----------------------------------------------- |
| Database queries       | 10                | 20            | Prevent connection pool exhaustion              |
| External API calls     | 5                 | 10            | Respect rate limits, prevent cascading failures |
| File I/O operations    | 20                | 50            | Balance throughput with file descriptor limits  |
| CPU-intensive tasks    | 2 per core        | 4 per core    | Prevent CPU saturation                          |
| Memory-intensive tasks | 5                 | 10            | Prevent OOM based on memory budget              |
| Network requests       | 10                | 25            | Prevent socket exhaustion                       |

#### Prohibited Concurrency Patterns

```typescript
// ❌ FORBIDDEN - Unbounded Promise.all
async function processAll(items: Item[]): Promise<Result[]> {
  return Promise.all(items.map(item => processItem(item)))
}

// ❌ FORBIDDEN - No concurrency control on external calls
async function fetchAllData(urls: string[]): Promise<Data[]> {
  return Promise.all(urls.map(url => fetch(url)))
}

// ❌ FORBIDDEN - Nested unbounded concurrency
async function processNested(groups: Group[]): Promise<void> {
  await Promise.all(
    groups.map(async group => {
      await Promise.all(group.items.map(item => processItem(item)))
    })
  )
}
```

### 9.2 LRU Cache Implementation

All in-memory caches MUST use the `lru-cache` library with proper configuration to prevent unbounded memory growth.

#### Standard LRU Cache Configuration

```typescript
import { LRUCache } from 'lru-cache'

// ✅ CORRECT - Fully configured LRU cache
interface CacheConfig {
  maxEntries: number
  maxSizeBytes: number
  ttlMs: number
  name: string
}

function createCache<K extends string, V>(config: CacheConfig): LRUCache<K, V> {
  return new LRUCache<K, V>({
    // Maximum number of entries
    max: config.maxEntries,

    // Maximum total size in bytes
    maxSize: config.maxSizeBytes,

    // Size calculation function (REQUIRED when using maxSize)
    sizeCalculation: (value: V): number => {
      return JSON.stringify(value).length
    },

    // Time-to-live in milliseconds
    ttl: config.ttlMs,

    // Reset TTL when item is accessed
    updateAgeOnGet: true,

    // Don't serve stale data
    allowStale: false,

    // Dispose callback for cleanup
    dispose: (value: V, key: K, reason: string) => {
      logger.debug(`Cache entry disposed: ${key}`, {
        reason,
        cacheName: config.name,
      })
    },
  })
}
```

#### Cache Configuration by Data Type

| Cache Type        | Max Entries | Max Size | TTL        | Update on Get |
| ----------------- | ----------- | -------- | ---------- | ------------- |
| Snapshot metadata | 100         | 10 MB    | 5 minutes  | Yes           |
| District data     | 200         | 50 MB    | 10 minutes | Yes           |
| Rankings          | 50          | 20 MB    | 5 minutes  | Yes           |
| Configuration     | 20          | 5 MB     | 30 minutes | Yes           |
| API responses     | 500         | 100 MB   | 2 minutes  | No            |
| Computed results  | 100         | 25 MB    | 15 minutes | Yes           |

#### Cache Factory Pattern

```typescript
// ✅ CORRECT - Centralized cache factory
class CacheFactory {
  private static caches = new Map<string, LRUCache<string, unknown>>()

  static getSnapshotCache(): LRUCache<string, Snapshot> {
    return this.getOrCreate('snapshots', {
      maxEntries: 100,
      maxSizeBytes: 10 * 1024 * 1024, // 10 MB
      ttlMs: 5 * 60 * 1000, // 5 minutes
      name: 'snapshots',
    })
  }

  static getDistrictCache(): LRUCache<string, District> {
    return this.getOrCreate('districts', {
      maxEntries: 200,
      maxSizeBytes: 50 * 1024 * 1024, // 50 MB
      ttlMs: 10 * 60 * 1000, // 10 minutes
      name: 'districts',
    })
  }

  static getRankingsCache(): LRUCache<string, Rankings> {
    return this.getOrCreate('rankings', {
      maxEntries: 50,
      maxSizeBytes: 20 * 1024 * 1024, // 20 MB
      ttlMs: 5 * 60 * 1000, // 5 minutes
      name: 'rankings',
    })
  }

  private static getOrCreate<V>(
    name: string,
    config: CacheConfig
  ): LRUCache<string, V> {
    if (!this.caches.has(name)) {
      this.caches.set(name, createCache<string, V>(config))
    }
    return this.caches.get(name) as LRUCache<string, V>
  }

  static clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear()
    }
    logger.info('All caches cleared')
  }

  static getStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {}
    for (const [name, cache] of this.caches) {
      stats[name] = {
        size: cache.size,
        calculatedSize: cache.calculatedSize,
        max: cache.max,
        maxSize: cache.maxSize,
      }
    }
    return stats
  }
}
```

#### Cache with Request Deduplication

```typescript
// ✅ CORRECT - Cache with request deduplication to prevent thundering herd
class DeduplicatingCache<K extends string, V> {
  private cache: LRUCache<K, V>
  private pending = new Map<K, Promise<V>>()

  constructor(config: CacheConfig) {
    this.cache = createCache<K, V>(config)
  }

  async get(key: K, fetcher: () => Promise<V>): Promise<V> {
    // Check cache first
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      return cached
    }

    // Check for pending request (deduplication)
    const pending = this.pending.get(key)
    if (pending) {
      return pending
    }

    // Create new request
    const promise = fetcher()
      .then(result => {
        this.cache.set(key, result)
        this.pending.delete(key)
        return result
      })
      .catch(error => {
        this.pending.delete(key)
        throw error
      })

    this.pending.set(key, promise)
    return promise
  }

  invalidate(key: K): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.pending.clear()
  }
}

// Usage
const districtCache = new DeduplicatingCache<string, District>({
  maxEntries: 200,
  maxSizeBytes: 50 * 1024 * 1024,
  ttlMs: 10 * 60 * 1000,
  name: 'districts',
})

async function getDistrict(id: string): Promise<District> {
  return districtCache.get(id, () => fetchDistrictFromDatabase(id))
}
```

#### Prohibited Cache Patterns

```typescript
// ❌ FORBIDDEN - Unbounded Map cache
const cache = new Map<string, Data>()

// ❌ FORBIDDEN - Object as cache without size limits
const cache: Record<string, Data> = {}

// ❌ FORBIDDEN - LRU cache without maxSize when caching variable-size data
const cache = new LRUCache<string, Data>({ max: 100 }) // Missing maxSize!

// ❌ FORBIDDEN - LRU cache without TTL for time-sensitive data
const cache = new LRUCache<string, Data>({ max: 100, maxSize: 1000000 })

// ❌ FORBIDDEN - Cache without sizeCalculation when using maxSize
const cache = new LRUCache<string, Data>({
  max: 100,
  maxSize: 1000000,
  // Missing sizeCalculation!
})
```

### 9.3 Timeout Patterns

All external operations MUST have timeouts configured to prevent resource exhaustion from hanging requests.

#### Standard Timeout Configuration

| Operation Type     | Default Timeout | Maximum Timeout | Rationale                       |
| ------------------ | --------------- | --------------- | ------------------------------- |
| Health checks      | 5s              | 10s             | Quick response required         |
| Database queries   | 10s             | 30s             | Prevent connection hogging      |
| External API calls | 5s              | 15s             | Respect external service limits |
| File operations    | 30s             | 60s             | Large files may take time       |
| Background jobs    | 300s            | 600s            | Long-running operations         |
| HTTP requests      | 30s             | 60s             | Standard request timeout        |

#### Timeout Wrapper Utility

```typescript
// ✅ CORRECT - Generic timeout wrapper
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new TimeoutError(
          `Operation '${operationName}' timed out after ${timeoutMs}ms`
        )
      )
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId!)
  }
}

// Custom timeout error for proper error handling
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

// Usage
const result = await withTimeout(
  fetchExternalData(url),
  5000,
  'fetchExternalData'
)
```

#### Fetch with Timeout using AbortController

```typescript
// ✅ CORRECT - Fetch with AbortController timeout
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Fetch to ${url} timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// Usage with retry
export async function fetchWithRetry(
  url: string,
  options: {
    timeoutMs?: number
    maxRetries?: number
    retryDelayMs?: number
  } = {}
): Promise<Response> {
  const { timeoutMs = 5000, maxRetries = 3, retryDelayMs = 1000 } = options

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, {}, timeoutMs)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1) // Exponential backoff
        logger.warn(`Fetch attempt ${attempt} failed, retrying in ${delay}ms`, {
          url,
          error: lastError.message,
        })
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
```

#### Database Operation Timeouts

```typescript
// ✅ CORRECT - Firestore query with timeout
import { Firestore } from '@google-cloud/firestore'

export async function queryWithTimeout<T>(
  query: FirebaseFirestore.Query<T>,
  timeoutMs: number = 10000
): Promise<FirebaseFirestore.QuerySnapshot<T>> {
  return withTimeout(query.get(), timeoutMs, 'Firestore query')
}

// ✅ CORRECT - Database operation wrapper with timeout
class DatabaseService {
  private readonly defaultTimeout = 10000

  async getDocument<T>(
    collection: string,
    docId: string,
    timeoutMs: number = this.defaultTimeout
  ): Promise<T | null> {
    const docRef = db.collection(collection).doc(docId)

    const snapshot = await withTimeout(
      docRef.get(),
      timeoutMs,
      `getDocument(${collection}/${docId})`
    )

    return snapshot.exists ? (snapshot.data() as T) : null
  }

  async queryDocuments<T>(
    collection: string,
    queryFn: (
      ref: FirebaseFirestore.CollectionReference
    ) => FirebaseFirestore.Query,
    timeoutMs: number = this.defaultTimeout
  ): Promise<T[]> {
    const collectionRef = db.collection(collection)
    const query = queryFn(collectionRef)

    const snapshot = await withTimeout(
      query.get(),
      timeoutMs,
      `queryDocuments(${collection})`
    )

    return snapshot.docs.map(doc => doc.data() as T)
  }
}
```

#### Prohibited Timeout Patterns

```typescript
// ❌ FORBIDDEN - No timeout on external calls
const response = await fetch(externalUrl)

// ❌ FORBIDDEN - No timeout on database operations
const snapshot = await db.collection('data').get()

// ❌ FORBIDDEN - Timeout without cleanup
const timeoutId = setTimeout(() => {
  /* abort */
}, 5000)
await someOperation()
// Missing clearTimeout!

// ❌ FORBIDDEN - Swallowing timeout errors
try {
  await withTimeout(operation(), 5000, 'operation')
} catch (error) {
  // Silent failure!
}
```

### 9.4 Deployment Guardrails

This section defines mandatory deployment configuration guardrails for Cloud Run services to ensure performance SLOs are met.

#### Container Sizing Requirements

| Environment     | Memory | CPU | V8 Heap | Concurrency | Max Instances |
| --------------- | ------ | --- | ------- | ----------- | ------------- |
| Development     | N/A    | N/A | N/A     | N/A         | N/A           |
| Staging         | 512Mi  | 1   | 384MB   | 80          | 2             |
| Production      | 512Mi  | 1   | 384MB   | 80          | 10            |
| Heavy workload  | 1Gi    | 2   | 768MB   | 40          | 10            |
| Data processing | 2Gi    | 2   | 1536MB  | 20          | 5             |

#### Cloud Run Deployment Template

```bash
# ✅ CORRECT - Production deployment with all guardrails
gcloud run deploy toast-stats-backend \
  --image gcr.io/${PROJECT_ID}/toast-stats-backend:${IMAGE_TAG} \
  --region us-central1 \
  --platform managed \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,NODE_OPTIONS=--max-old-space-size=384" \
  --service-account toast-stats-backend@${PROJECT_ID}.iam.gserviceaccount.com \
  --execution-environment gen2 \
  --cpu-boost
```

#### Autoscaling Configuration

```yaml
# ✅ CORRECT - Cloud Run autoscaling configuration
spec:
  template:
    metadata:
      annotations:
        # Scale to zero for cost optimization
        autoscaling.knative.dev/minScale: '0'
        # Maximum instances to prevent runaway costs
        autoscaling.knative.dev/maxScale: '10'
        # Target concurrency utilization (80% of max)
        autoscaling.knative.dev/target: '64'
        # Scale up aggressively, scale down conservatively
        autoscaling.knative.dev/scaleDownDelay: '60s'
```

#### Autoscaling Guardrails Table

| Parameter        | Development | Staging | Production | Rationale             |
| ---------------- | ----------- | ------- | ---------- | --------------------- |
| `minScale`       | N/A         | 0       | 0          | Cost optimization     |
| `maxScale`       | N/A         | 2       | 10         | Prevent runaway costs |
| `target`         | N/A         | 64      | 64         | 80% of concurrency    |
| `scaleDownDelay` | N/A         | 30s     | 60s        | Prevent thrashing     |
| `cpu-boost`      | N/A         | Yes     | Yes        | Faster cold starts    |

#### Memory and CPU Relationship

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MEMORY/CPU SIZING GUIDELINES                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Container Memory    V8 Heap (75%)    CPU    Concurrency    Use Case    │
│  ─────────────────   ─────────────    ───    ───────────    ────────    │
│  256Mi               150MB            0.5    75             Lightweight  │
│  512Mi               384MB            1      80             Standard     │
│  1Gi                 768MB            1-2    60-100         Data heavy   │
│  2Gi                 1536MB           2      40-80          Processing   │
│  4Gi                 3072MB           2-4    20-40          Analytics    │
│                                                                          │
│  FORMULA: V8 Heap = Container Memory × 0.75                             │
│  FORMULA: Concurrency = Container Memory / (Base + Per-Request Memory)  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Request Timeout Configuration

| Endpoint Type | Cloud Run Timeout | Application Timeout | Rationale               |
| ------------- | ----------------- | ------------------- | ----------------------- |
| Health checks | 10s               | 5s                  | Quick response required |
| Standard API  | 60s               | 30s                 | Buffer for retries      |
| Data refresh  | 300s              | 240s                | Long-running operations |
| Backfill      | 600s              | 540s                | Batch processing        |
| Export        | 300s              | 240s                | Large data exports      |

#### Prohibited Deployment Patterns

```bash
# ❌ FORBIDDEN - No memory limit specified
gcloud run deploy service --image gcr.io/project/image

# ❌ FORBIDDEN - No max instances (unlimited scaling)
gcloud run deploy service --image gcr.io/project/image --memory 512Mi

# ❌ FORBIDDEN - V8 heap larger than container memory
gcloud run deploy service \
  --memory 512Mi \
  --set-env-vars "NODE_OPTIONS=--max-old-space-size=600"

# ❌ FORBIDDEN - Concurrency too high for memory
gcloud run deploy service \
  --memory 256Mi \
  --concurrency 200

# ❌ FORBIDDEN - No timeout specified
gcloud run deploy service --image gcr.io/project/image --memory 512Mi
```

### 9.5 Load Testing Requirements

Load testing MUST be performed before deploying significant changes to production. This section defines mandatory load testing requirements and CI gates.

#### Load Testing Scenarios

| Scenario        | Description              | Target            | Pass Criteria                    |
| --------------- | ------------------------ | ----------------- | -------------------------------- |
| **Baseline**    | Normal traffic pattern   | 50 RPS            | p95 < 500ms, 0% errors           |
| **Peak load**   | 2x normal traffic        | 100 RPS           | p95 < 750ms, < 0.1% errors       |
| **Stress test** | 3x normal traffic        | 150 RPS           | p95 < 1s, < 1% errors            |
| **Soak test**   | Normal traffic, extended | 50 RPS for 1 hour | No memory growth, stable latency |
| **Spike test**  | Sudden traffic burst     | 0 → 100 RPS       | Recovery < 30s                   |

#### Load Testing Configuration

```typescript
// ✅ CORRECT - k6 load test configuration
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')
const latencyP95 = new Trend('latency_p95')

// Test configuration
export const options = {
  scenarios: {
    // Baseline test
    baseline: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
    // Peak load test
    peak: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      startTime: '6m',
    },
    // Stress test
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 150,
      maxVUs: 300,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '3m', target: 150 },
        { duration: '2m', target: 50 },
      ],
      startTime: '12m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  // Test critical endpoints
  const endpoints = [
    { url: `${BASE_URL}/api/health`, name: 'health' },
    { url: `${BASE_URL}/api/districts`, name: 'districts' },
    { url: `${BASE_URL}/api/districts/42`, name: 'district_detail' },
  ]

  for (const endpoint of endpoints) {
    const response = http.get(endpoint.url, {
      tags: { name: endpoint.name },
    })

    const success = check(response, {
      'status is 200': r => r.status === 200,
      'response time < 500ms': r => r.timings.duration < 500,
    })

    errorRate.add(!success)
    latencyP95.add(response.timings.duration)
  }

  sleep(1)
}
```

#### CI Performance Gates

Performance gates MUST be enforced in CI pipelines:

```yaml
# ✅ CORRECT - GitHub Actions performance gate
name: Performance Tests

on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main]

jobs:
  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup k6
        uses: grafana/setup-k6-action@v1

      - name: Deploy to staging
        run: |
          # Deploy to staging environment
          ./scripts/deploy-staging.sh

      - name: Run baseline load test
        run: |
          k6 run \
            --out json=results.json \
            --env BASE_URL=${{ secrets.STAGING_URL }} \
            tests/load/baseline.js

      - name: Check performance thresholds
        run: |
          # Parse results and check thresholds
          node scripts/check-performance.js results.json

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: results.json
```

#### Performance Gate Thresholds

| Metric                    | Warning    | Blocking    | Measurement        |
| ------------------------- | ---------- | ----------- | ------------------ |
| p95 latency increase      | > 10%      | > 25%       | vs baseline        |
| p99 latency increase      | > 15%      | > 30%       | vs baseline        |
| Error rate                | > 0.1%     | > 1%        | Absolute           |
| Memory growth             | > 10%      | > 25%       | Over test duration |
| Bundle size increase      | > 5 KB     | > 20 KB     | vs main branch     |
| Lighthouse score decrease | > 5 points | > 10 points | vs main branch     |

#### Performance Regression Detection Script

```typescript
// scripts/check-performance.js
// ✅ CORRECT - Performance threshold checker

interface K6Results {
  metrics: {
    http_req_duration: {
      values: {
        p95: number
        p99: number
        avg: number
      }
    }
    http_req_failed: {
      values: {
        rate: number
      }
    }
  }
}

interface Thresholds {
  p95_max_ms: number
  p99_max_ms: number
  error_rate_max: number
}

const THRESHOLDS: Thresholds = {
  p95_max_ms: 500,
  p99_max_ms: 1000,
  error_rate_max: 0.01,
}

function checkPerformance(results: K6Results): boolean {
  const { http_req_duration, http_req_failed } = results.metrics

  const checks = [
    {
      name: 'p95 latency',
      value: http_req_duration.values.p95,
      threshold: THRESHOLDS.p95_max_ms,
      unit: 'ms',
    },
    {
      name: 'p99 latency',
      value: http_req_duration.values.p99,
      threshold: THRESHOLDS.p99_max_ms,
      unit: 'ms',
    },
    {
      name: 'Error rate',
      value: http_req_failed.values.rate,
      threshold: THRESHOLDS.error_rate_max,
      unit: '%',
    },
  ]

  let passed = true

  for (const check of checks) {
    const status = check.value <= check.threshold ? '✅' : '❌'
    console.log(
      `${status} ${check.name}: ${check.value.toFixed(2)}${check.unit} ` +
        `(threshold: ${check.threshold}${check.unit})`
    )

    if (check.value > check.threshold) {
      passed = false
    }
  }

  return passed
}

// Main execution
const resultsFile = process.argv[2]
if (!resultsFile) {
  console.error('Usage: node check-performance.js <results.json>')
  process.exit(1)
}

const results: K6Results = JSON.parse(
  require('fs').readFileSync(resultsFile, 'utf-8')
)

const passed = checkPerformance(results)
process.exit(passed ? 0 : 1)
```

#### Load Testing Requirements Summary

| Requirement    | Frequency             | Blocking | Owner |
| -------------- | --------------------- | -------- | ----- |
| Baseline test  | Every PR              | Yes      | CI    |
| Peak load test | Weekly                | No       | Team  |
| Stress test    | Before major releases | Yes      | Team  |
| Soak test      | Monthly               | No       | Team  |
| Spike test     | Before major releases | No       | Team  |

#### Prohibited Load Testing Patterns

```typescript
// ❌ FORBIDDEN - Load testing production directly
const BASE_URL = 'https://production.example.com'

// ❌ FORBIDDEN - No thresholds defined
export const options = {
  vus: 100,
  duration: '5m',
  // Missing thresholds!
}

// ❌ FORBIDDEN - Unrealistic test scenarios
export const options = {
  vus: 10000, // Way beyond expected traffic
  duration: '1h',
}

// ❌ FORBIDDEN - Testing without cleanup
export default function () {
  http.post(`${BASE_URL}/api/data`, { data: 'test' })
  // Creates test data that's never cleaned up!
}
```

---

## 10. Final Rules

> **Performance is a feature, not an afterthought.**  
> **All parallel operations MUST use bounded concurrency with p-limit.**  
> **All in-memory caches MUST use LRU with max size, max entries, and TTL.**  
> **All external operations MUST have timeouts configured.**  
> **Container memory, CPU, and V8 heap MUST be properly sized and aligned.**  
> **Autoscaling MUST have min and max instance limits configured.**  
> **Load testing MUST be performed before major releases.**  
> **CI gates MUST enforce performance thresholds.**  
> **Memory growth MUST be monitored and bounded.**  
> **Measure before optimizing—assumptions are not evidence.**
