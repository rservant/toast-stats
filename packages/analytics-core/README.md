# @toastmasters/analytics-core

Shared analytics computation logic for Toastmasters statistics.

## Overview

This package contains the core analytics computation algorithms extracted from the backend, making them usable by both `scraper-cli` (for pre-computing analytics) and `backend` (for validation).

## Installation

This is a private package within the monorepo. It's automatically available to other workspace packages.

```bash
# From the monorepo root
npm install
```

## Usage

### ESM (recommended)

```typescript
import {
  ANALYTICS_SCHEMA_VERSION,
  isCompatibleVersion,
  type DistrictAnalytics,
  type IAnalyticsComputer,
} from '@toastmasters/analytics-core'
```

### CommonJS

```javascript
const {
  ANALYTICS_SCHEMA_VERSION,
  isCompatibleVersion,
} = require('@toastmasters/analytics-core')
```

## Exports

### Version Management

- `ANALYTICS_SCHEMA_VERSION` - Current schema version for analytics files
- `COMPUTATION_VERSION` - Current computation algorithm version
- `isCompatibleVersion(version)` - Check if a file version is compatible

### Types

- `DistrictAnalytics` - Complete district analytics structure
- `MembershipTrendData` - Membership trend time series
- `ClubHealthData` - Club health classifications
- `PreComputedAnalyticsFile<T>` - Wrapper for pre-computed files
- `AnalyticsManifest` - Manifest of generated analytics files

### Interfaces

- `IAnalyticsComputer` - Interface for analytics computation
- `IDataTransformer` - Interface for CSV-to-snapshot transformation

## Development

```bash
# Build the package
npm run build

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

## Architecture

This package is part of the pre-computed analytics pipeline:

```
Raw CSV → Snapshot → Pre-Computed Analytics → Backend Serving
         ↑                    ↑
         └── DataTransformer  └── AnalyticsComputer
```

Both `DataTransformer` and `AnalyticsComputer` implementations use the interfaces defined in this package to ensure consistent behavior across scraper-cli and backend.
