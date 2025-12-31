# Toastmasters District Statistics Visualizer

A web application for visualizing Toastmasters district statistics with an intuitive interface for viewing and analyzing district-level performance data.

## Project Structure

This is a monorepo containing:

- `frontend/` - React + TypeScript + Vite application
- `backend/` - Node.js + Express + TypeScript API server

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

The application can fetch data from the public Toastmasters dashboards at https://dashboards.toastmasters.org using a Playwright-based web scraper.

### Mock Data vs Real Data

- **Mock Data** (default): Fast, fake data for development
- **Real Data**: Scrapes live data from Toastmasters dashboards

Toggle between them in `backend/.env`:

```bash
USE_MOCK_DATA=true   # Use mock data (fast)
USE_MOCK_DATA=false  # Use real scraping (slower, requires Playwright)
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

This project has evolved through multiple phases of development. Completed specifications have been archived in `.kiro/specs-archive/` for historical reference:

- **toastmasters-district-visualizer**: Original project specification (fully implemented)
- **district-level-data**: District analytics features (fully implemented)

Active specifications for ongoing maintenance are located in `.kiro/specs/` and `specs/`.

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
```

## License

Private
