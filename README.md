# Toastmasters District Statistics Visualizer

A web application for visualizing Toastmasters district statistics with an intuitive interface for viewing and analyzing district-level performance data.

## Project Structure

This is a monorepo containing:

- `frontend/` - React + TypeScript + Vite application
- `backend/` - Node.js + Express + TypeScript API server
- `packages/scraper-cli/` - Standalone CLI tool for scraping Toastmasters dashboard data

## Prerequisites

- Node.js 18+ and npm

## Getting Started

### Installation

Install dependencies for both frontend and backend:

```bash
npm install
```

### Configuration

1. Copy the example environment files:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

2. Update the environment variables in the `.env` files as needed.

#### Cache Configuration

The application uses a unified cache configuration system. Set the `CACHE_DIR` environment variable to configure where cached data is stored:

```bash
# Development (relative path)
CACHE_DIR=./cache

# Production (absolute path)
CACHE_DIR=/var/cache/toastmasters
```

For detailed cache configuration examples for different deployment scenarios, see [docs/CACHE_CONFIGURATION.md](./docs/CACHE_CONFIGURATION.md).

### Development

Run both frontend and backend in development mode:

```bash
# Run frontend (in one terminal)
npm run dev:frontend

# Run backend (in another terminal)
npm run dev:backend
```

The frontend will be available at `http://localhost:3000` and the backend at `http://localhost:5001`.

### Building for Production

Build both projects:

```bash
npm run build:frontend
npm run build:backend
```

### Code Quality

Format code with Prettier:

```bash
npm run format
```

Lint code:

```bash
npm run lint
```

## Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- TailwindCSS
- React Router
- TanStack Query (React Query)
- Recharts
- Axios

### Backend

- Node.js
- Express
- TypeScript
- JWT for authentication
- Node-cache for caching
- Axios for external API calls

## Data Source

The application fetches data from the public Toastmasters dashboards at https://dashboards.toastmasters.org.

### Architecture Overview

The system uses a **two-process architecture** that separates data acquisition from data serving:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Scraper CLI    │────▶│  Raw CSV Cache  │◀────│    Backend      │
│  (scrapes data) │     │  (shared cache) │     │ (serves data)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Scraper CLI** (`packages/scraper-cli/`): Standalone tool that scrapes Toastmasters dashboard and writes to the Raw CSV Cache
2. **Backend** (`backend/`): Reads from the cache and creates snapshots using SnapshotBuilder (no scraping)

This separation enables:
- Independent scheduling of scraping operations
- Backend remains responsive during scraping
- Scraping failures don't affect data serving
- Easier testing and maintenance

### Running the Scraper

```bash
# Scrape all configured districts for today
npm run scraper-cli -- scrape

# Scrape for a specific date
npm run scraper-cli -- scrape --date 2025-01-10

# Scrape specific districts
npm run scraper-cli -- scrape --districts 57,58,59

# Check cache status
npm run scraper-cli -- status
```

### Mock Data vs Real Data

- **Mock Data** (default): Fast, fake data for development
- **Real Data**: Uses scraper-cli to collect live data from Toastmasters dashboards

Toggle between them in `backend/.env`:

```bash
USE_MOCK_DATA=true   # Use mock data (fast)
USE_MOCK_DATA=false  # Use real data from cache (requires scraper-cli to populate cache)
```

## Features

- User authentication (placeholder for development)
- District selection and statistics viewing
- Membership statistics visualization
- Club performance metrics
- Educational achievement tracking
- Daily report viewing and analysis
- Data export functionality
- Responsive design for all devices
- Accessibility compliant

For detailed project status and implementation information, see [PROJECT_STATUS.md](./PROJECT_STATUS.md).

## Project History

This project has evolved through multiple phases of development. Completed specifications have been archived in `.kiro/specs/archive/` for historical reference:

**Archived Specifications:**

- **toastmasters-district-visualizer**: Original project specification
- **district-level-data**: District analytics features
- **data-refresh-architecture**: Snapshot-based data architecture
- **unified-backfill-service**: Historical data collection
- **raw-csv-cache-system**: CSV caching infrastructure
- **club-health-classification**: Club health scoring
- **district-scoped-data-collection**: Per-district data collection
- **codebase-cleanup**: Code quality improvements
- **remove-district-cache-manager**: Legacy cache removal
- **analytics-engine-migration**: Analytics module extraction
- **analytics-engine-refactor**: Analytics modular architecture (5 specialized modules)
- **raw-csv-cache-refactor**: Cache security and integrity extraction
- **refresh-service-refactor**: Closing period and normalization extraction
- **admin-routes-refactor**: Admin routes modular architecture
- **scraper-cli-separation**: Separated scraping into standalone CLI tool

Active specifications for ongoing maintenance are located in `.kiro/specs/`.

## Deployment

For production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Quick deployment options:

- **Node.js/PM2**: Build and run with process manager
- **Static Hosting**: Build frontend and deploy to Vercel/Netlify

### Cache Management

The application uses a versioned cache system to track changes in data format and calculations. When deploying updates that change cached data structure:

- Review [backend/CACHE_MIGRATION_GUIDE.md](./backend/CACHE_MIGRATION_GUIDE.md) for migration instructions
- Check [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for cache clearing requirements
- Current cache version: **v2** (Borda count scoring system)

## Testing

Run tests:

```bash
# Frontend tests
npm run test:frontend

# Backend tests
npm run test:backend

# Scraper CLI tests
npm run test:scraper-cli
```

## License

Private
