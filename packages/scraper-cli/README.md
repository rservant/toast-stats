# Scraper CLI

Standalone command-line tool for scraping Toastmasters dashboard data.

## Overview

This package provides a standalone CLI tool that scrapes data from the Toastmasters dashboard and stores it in the Raw CSV Cache. It is designed to operate independently from the backend application, enabling separate scheduling and management of scraping operations.

## Requirements

- Node.js >= 18.0.0
- Playwright (installed automatically)

## Installation

```bash
# From the repository root
npm install

# Build the package
npm run build:scraper-cli
```

## Usage

### Scrape Command

```bash
# Scrape all districts for today
scraper-cli scrape

# Scrape for a specific date
scraper-cli scrape --date 2025-01-10

# Scrape specific districts
scraper-cli scrape --districts 57,58,59

# Force re-scrape even if cache exists
scraper-cli scrape --force

# Enable verbose logging
scraper-cli scrape --verbose

# Set custom timeout (in seconds)
scraper-cli scrape --timeout 600

# Use alternative configuration file
scraper-cli scrape --config /path/to/config.json
```

### Status Command

```bash
# Check cache status for today
scraper-cli status

# Check cache status for a specific date
scraper-cli status --date 2025-01-10
```

## Exit Codes

| Code | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| 0    | All districts scraped successfully                        |
| 1    | Some districts failed, others succeeded (partial failure) |
| 2    | All districts failed or fatal error occurred              |

## Output Format

The CLI outputs a JSON summary to stdout on completion:

```json
{
  "timestamp": "2025-01-11T12:00:00.000Z",
  "date": "2025-01-10",
  "status": "success",
  "districts": {
    "total": 10,
    "succeeded": 10,
    "failed": 0,
    "skipped": 0
  },
  "cache": {
    "directory": "./cache/raw-csv",
    "filesCreated": 40,
    "totalSize": 1234567
  },
  "errors": [],
  "duration_ms": 45000
}
```

## Configuration

The CLI reads configuration from:

1. Environment variables
2. Configuration file (specified with `--config`)
3. Default district configuration from the backend

### Environment Variables

- `TOASTMASTERS_DASHBOARD_URL`: Base URL for the dashboard (default: https://dashboards.toastmasters.org)
- `CACHE_DIR`: Directory for storing cached CSV files (default: ./cache/raw-csv)

## Architecture

This package is part of the scraper-cli separation architecture:

```
┌─────────────────┐     ┌─────────────────┐
│  Scraper CLI    │────▶│  Raw CSV Cache  │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    Backend      │
                        │ (SnapshotBuilder)│
                        └─────────────────┘
```

The Scraper CLI operates independently and writes to the shared Raw CSV Cache. The backend reads from this cache to create snapshots without performing any scraping operations.

## Development

```bash
# Run in development mode
npm run dev --workspace=@toastmasters/scraper-cli

# Run tests
npm run test:scraper-cli

# Type check
npm run typecheck --workspace=@toastmasters/scraper-cli
```

## License

Private - Internal use only
