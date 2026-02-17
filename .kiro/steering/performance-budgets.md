# Performance Budgets Steering Document

**Status:** Authoritative  
**Applies to:** All code affecting application performance  
**Owner:** Development Team

---

## 1. Frontend Performance Targets

### Core Web Vitals

| Metric | Target (p75) | Maximum  |
| ------ | ------------ | -------- |
| LCP    | < 1.5s       | < 2.5s   |
| FID    | < 50ms       | < 100ms  |
| CLS    | < 0.05       | < 0.1    |
| INP    | < 100ms      | < 200ms  |

### Time to Interactive

| Page Type         | Target | Maximum |
| ----------------- | ------ | ------- |
| Landing/Dashboard | < 2.5s | < 4s    |
| Data-heavy pages  | < 3.5s | < 5s    |
| Admin pages       | < 4s   | < 6s    |

### Bundle Size Budgets (Compressed)

| Asset                          | Budget  |
| ------------------------------ | ------- |
| JavaScript (Total)             | 200 KB  |
| JavaScript (Main Bundle)       | 100 KB  |
| JavaScript (Vendor Bundle)     | 100 KB  |
| CSS (Total)                    | 50 KB   |
| Images (Per Page, initial)     | 500 KB  |
| Fonts (Total)                  | 100 KB  |
| HTML Document                  | 50 KB   |

Budget increases require documented justification.

### Lighthouse CI Minimums

| Audit          | Minimum | Target |
| -------------- | ------- | ------ |
| Performance    | 80      | 90+    |
| Accessibility  | 90      | 100    |
| Best Practices | 90      | 100    |
| SEO            | 80      | 90+    |

---

## 2. Backend Performance Targets

### API Latency

| Percentile | Target  | Maximum |
| ---------- | ------- | ------- |
| p50        | < 200ms | < 300ms |
| p95        | < 500ms | < 750ms |
| p99        | < 1s    | < 2s    |

### Latency by Endpoint Type

| Endpoint Type     | p50 Target | p95 Target |
| ----------------- | ---------- | ---------- |
| Health checks     | < 50ms     | < 100ms    |
| Simple reads      | < 100ms    | < 300ms    |
| Complex reads     | < 200ms    | < 500ms    |
| Data mutations    | < 300ms    | < 750ms    |
| Long-running ops  | < 500ms    | < 2s       |

### Error Rate Targets

| Error Type  | Target | Maximum |
| ----------- | ------ | ------- |
| 5xx errors  | < 0.1% | < 1%    |
| 4xx errors  | < 5%   | < 10%   |

### Throughput

| Metric              | Target    | Maximum   |
| ------------------- | --------- | --------- |
| RPS (per instance)  | 50        | 100       |
| Concurrent requests | 80        | 100       |
| RPM (total)         | 3,000     | 6,000     |

---

## 3. Memory Budget

Container: 512Mi. V8 heap: 384MB (`--max-old-space-size=384`). Native: ~100MB. Overhead: ~28MB.

- In-memory cache total SHOULD NOT exceed 25% of container memory
- Individual caches SHOULD NOT exceed 50MB
- Alert at: container > 85%, V8 heap > 90%, RSS > 95%

---

## 4. CI Gates

| Check                     | Threshold | Action   |
| ------------------------- | --------- | -------- |
| Bundle size increase      | > 5 KB    | Warning  |
| Bundle size increase      | > 20 KB   | Blocking |
| Lighthouse score decrease | > 5 pts   | Warning  |
| Lighthouse score decrease | > 10 pts  | Blocking |
| New dependency added      | Any       | Justify  |

---

## 5. Required Optimizations

- Route-based code splitting with `React.lazy()` (static imports for routes are FORBIDDEN)
- Images: WebP/AVIF, `loading="lazy"` below fold, explicit `width`/`height`
- Fonts: woff2 only, `font-display: swap`, max 4 font files
- All text assets served with Brotli or gzip compression
