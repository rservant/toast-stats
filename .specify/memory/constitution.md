# Toast Stats Constitution
<!-- Dynamic Web Application Specification & Development Framework -->

## Core Principles

### I. Monorepo with Clear Separation of Concerns

Frontend and backend are separate packages within a monorepo structure. Each maintains its own build system, dependencies, and test suite. The frontend (React/Vite) and backend (Node/Express) communicate via REST APIs only. Shared types are defined in interfaces but implemented independently per package.

### II. Type-Safe Development (Non-Negotiable)

All code must be written in TypeScript with strict mode enabled. Type definitions drive API contracts between frontend and backend. Frontend-backend communication uses shared type definitions where applicable. Runtime validation complements static typing.

### III. Test-First with Comprehensive Coverage

Unit tests written with Vitest for both frontend and backend. All features must include unit tests before merge. Integration tests required for API contract changes. Component tests required for UI components affecting user workflows. Coverage targets: >80% for business logic, >70% overall.

### IV. Accessibility as a First-Class Feature

All UI components must be WCAG 2.1 AA compliant (documented in frontend/ACCESSIBILITY.md). Semantic HTML required. Testing includes axe-core accessibility audits. Color contrast, keyboard navigation, and screen reader support non-negotiable.

### V. Performance Optimization Throughout

Frontend: Code splitting via Vite, lazy loading of routes, component memoization. Backend: Caching with node-cache and TTL management, rate limiting on endpoints. Data visualization with Recharts optimized for large datasets. Load time targets: LCP <2.5s, FID <100ms.

### VI. Data-Driven Development

Application fetches real data from Toastmasters dashboards via Playwright web scraper. Mock data available for rapid development. Cache versioning system (currently v2 with Borda count scoring) tracks data format changes. Cache migrations documented and managed via CACHE_MIGRATION_GUIDE.md.

## Technology Stack & Standards

### Frontend Stack

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite with source maps for production
- **Styling**: TailwindCSS with PostCSS
- **Routing**: React Router 6+ with lazy loading
- **Data Fetching**: TanStack Query (React Query) with caching strategy
- **Visualizations**: Recharts for district statistics charts
- **HTTP Client**: Axios with interceptors for auth/error handling
- **Testing**: Vitest + React Testing Library + jest-axe
- **Code Quality**: ESLint + Prettier (shared config)
- **Deployment**: Docker containerization + nginx reverse proxy

### Backend Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with CORS and rate limiting
- **Authentication**: JWT tokens (HS256 algorithm)
- **Data Fetching**: Playwright for web scraping, Axios for API calls
- **Caching**: node-cache with configurable TTL (default 900s)
- **Rate Limiting**: express-rate-limit middleware
- **Testing**: Vitest + Supertest for API testing
- **Code Quality**: ESLint + Prettier (shared config)
- **Deployment**: Docker containerization

### Environment Configuration

Backend requires: NODE_ENV, PORT, JWT_SECRET, TOASTMASTERS_DASHBOARD_URL, CORS_ORIGIN, CACHE_TTL
Frontend requires: VITE_API_URL (defaults to /api in dev, must be configured for production)
All sensitive values managed via .env files, never committed to repo

## Development Workflow

### Code Quality Gates

1. **Pre-commit**: Prettier formatting and ESLint validation required
2. **Pull Request**:
   - All tests must pass (unit + integration)
   - No regressions in existing functionality
   - TypeScript strict mode compliance
   - Code coverage maintained or improved
3. **Merge**: Only after approval and CI/CD pipeline success

### API Contract Management

API changes require TypeScript interface updates first. Backend routes typed with request/response shapes. Frontend API services consume and validate responses. Breaking changes to API must follow semantic versioning and include migration guide.

### Cache Strategy

Data is cached server-side with versioned keys. Cache version increments on data format changes. Manual cache clearing documented in DEPLOYMENT_CHECKLIST.md. TTL configurable per endpoint, default 15 minutes (900s).

### Testing Requirements

- New features require unit tests
- API changes require integration tests
- UI component changes require component tests
- All tests run before merge to main
- Coverage reports generated on CI/CD

## Performance & Security Standards

### Performance Targets

- Frontend LCP (Largest Contentful Paint): < 2.5 seconds
- Frontend FID (First Input Delay): < 100 milliseconds
- Backend API response time: < 200ms (excluding external scraping)
- Cache hit rate: > 80% for repeated queries
- Support 1000+ concurrent users without degradation

### Security Requirements

- JWT_SECRET minimum 32 characters (generated via crypto.randomBytes or openssl)
- CORS_ORIGIN strictly configured for production (not wildcards)
- All external API calls via HTTPS
- Rate limiting: 100 requests per 15 minutes per IP default
- No secrets in .env.example or committed code
- Regular dependency updates via npm audit

### Deployment Standards

- Docker images for both frontend and backend
- Docker Compose for local development and deployment orchestration
- Kubernetes manifests in k8s/ for cloud deployments
- Health check endpoints at /health for both services
- Zero-downtime deployments supported via rolling updates

## Data Model & Entities

### Core Entities

- **District**: Toastmasters district with membership and club statistics
- **Club**: Individual clubs within districts with member counts
- **Member**: District/club member information
- **DailyReport**: Timestamped daily snapshots of district statistics

### Data Flow

1. Backend scraper fetches data from Toastmasters dashboards (Playwright)
2. Data normalized and cached with versioned keys
3. Frontend queries via /api/districts, /api/districts/:id, /api/dailyReports
4. Frontend visualizes via Recharts components

## Error Handling & Logging

### Error Handling Philosophy

- Frontend: User-friendly error messages with fallback to cached data
- Backend: Structured error responses with appropriate HTTP status codes
- All API errors include error code, message, and details for debugging
- Client-side validation prevents invalid requests; server validates all inputs

### Logging Standards

- Backend logs structured JSON format for production
- Frontend logs to console in development, errors sent to backend in production
- All authentication attempts logged
- Cache misses and evictions logged for monitoring
- Sensitive data (passwords, tokens) never logged

## Governance & Amendments

### Constitution Enforceability

This constitution supersedes all other development practices and guidelines. All PRs/MRs must verify compliance with these principles. Violations should be addressed before merge.

### Amendment Process

Amendments require:

1. Documentation of proposed change and rationale
2. Discussion with team leads
3. Migration plan for existing code (if applicable)
4. Updated date and version tracking

### Reference Documents

- Frontend-specific practices: frontend/ACCESSIBILITY.md, frontend/PERFORMANCE_OPTIMIZATIONS.md, frontend/ERROR_HANDLING_IMPLEMENTATION.md
- Backend practices: backend/CACHE_MIGRATION_GUIDE.md
- Deployment practices: DEPLOYMENT.md, DEPLOYMENT_CHECKLIST.md, DEPLOYMENT_SUMMARY.md
- Development setup: README.md**Version**: 1.0.0 | **Created**: 2025-11-25 | **Last Updated**: 2025-11-25
