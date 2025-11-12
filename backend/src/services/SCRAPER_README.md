# Toastmasters Dashboard Scraper

This service uses Playwright to scrape real data from the Toastmasters public dashboards at https://dashboards.toastmasters.org.

## Architecture

### Components

1. **ToastmastersScraper** (`ToastmastersScraper.ts`)
   - Low-level Playwright automation
   - Handles browser management
   - Downloads CSV files from dashboard pages
   - Parses CSV into JavaScript objects

2. **RealToastmastersAPIService** (`RealToastmastersAPIService.ts`)
   - High-level API matching our application's interface
   - Transforms scraped CSV data into our internal format
   - Handles data aggregation and calculations

3. **MockToastmastersAPIService** (`MockToastmastersAPIService.ts`)
   - Provides fake data for development/testing
   - Matches the same interface as RealToastmastersAPIService

## Configuration

Set these environment variables in `backend/.env`:

```bash
# Toastmasters Dashboard URL
TOASTMASTERS_DASHBOARD_URL=https://dashboards.toastmasters.org

# Use mock data (true) or real scraping (false)
USE_MOCK_DATA=true
```

## Usage

### Development Mode (Mock Data)

```bash
# In backend/.env
USE_MOCK_DATA=true
```

This uses `MockToastmastersAPIService` which returns fake data instantly without any web scraping.

### Production Mode (Real Scraping)

```bash
# In backend/.env
USE_MOCK_DATA=false
```

This uses `RealToastmastersAPIService` which scrapes live data from the Toastmasters dashboards.

## Available Data Sources

The scraper can fetch data from these dashboard pages:

### 1. All Districts Summary
- **URL**: `https://dashboards.toastmasters.org/`
- **Data**: Cross-district summary with membership, payments, growth metrics
- **Method**: `scraper.getAllDistricts()`

### 2. District Performance
- **URL**: `https://dashboards.toastmasters.org/District.aspx?id={DISTRICT_ID}`
- **Data**: District-level summary with Division → Area → Club hierarchy
- **Method**: `scraper.getDistrictPerformance(districtId)`

### 3. Division & Area Performance
- **URL**: `https://dashboards.toastmasters.org/Division.aspx?id={DISTRICT_ID}`
- **Data**: Division goals and Area breakdowns
- **Method**: `scraper.getDivisionPerformance(districtId)`

### 4. Club Performance
- **URL**: `https://dashboards.toastmasters.org/Club.aspx?id={DISTRICT_ID}`
- **Data**: Club-level metrics (membership, growth, training, recognition)
- **Method**: `scraper.getClubPerformance(districtId)`

## How It Works

1. **Browser Launch**: Playwright launches a Chromium browser (headless in production)
2. **Page Navigation**: Navigate to the target dashboard page
3. **CSV Export**: Click the "Export CSV" button and capture the download
4. **CSV Parsing**: Parse the CSV content into JavaScript objects
5. **Data Transformation**: Transform the raw CSV data into our API format
6. **Caching**: Results are cached to avoid repeated scraping

## Performance Considerations

### Caching
- All scraped data is cached for 15 minutes (configurable via `CACHE_TTL`)
- This reduces load on Toastmasters servers
- Improves response times for repeated requests

### Browser Reuse
- The browser instance is reused across multiple requests
- Reduces startup overhead
- Automatically closed when the service is shut down

### Rate Limiting
- Built-in rate limiting prevents excessive requests
- Configurable via `RATE_LIMIT_*` environment variables

## Limitations

### Current Implementation

1. **Historical Data**: Currently only fetches current data. Historical data would require scraping year-specific URLs like `https://dashboards.toastmasters.org/2014-2015/Default.aspx`

2. **Educational Awards**: Not yet implemented. Would require additional scraping logic.

3. **Daily Reports**: Not yet implemented. May require a different data source.

### CSV Column Mapping

The scraper attempts to handle various CSV column names:
- `District` / `District ID` / `district`
- `District Name` / `Name` / `name`
- `Club Number` / `Club` / `ID`
- `Club Name` / `Name`
- `Member Count` / `Members` / `To Date`
- `Status`
- `Distinguished`

If the Toastmasters dashboard changes their CSV format, the column mapping may need updates.

## Troubleshooting

### Browser Not Found

If you see "Executable doesn't exist" errors:

```bash
cd backend
npx playwright install chromium
```

### Timeout Errors

If scraping times out, increase the timeout:

```typescript
// In ToastmastersScraper.ts
this.config = {
  timeout: 60000, // Increase to 60 seconds
}
```

### CSV Parsing Errors

Check the logs to see the actual CSV content:

```typescript
logger.debug('CSV content', { csvContent })
```

Then update the column mapping in `RealToastmastersAPIService.ts`.

### Memory Issues

If running multiple concurrent scrapes causes memory issues:
- Ensure browser instances are properly closed
- Reduce concurrent request limits
- Increase server memory allocation

## Testing

### Manual Testing

```bash
# Start backend with real scraping
USE_MOCK_DATA=false npm run dev:backend

# Test endpoints
curl http://localhost:5001/api/districts
curl http://localhost:5001/api/districts/61/statistics
curl http://localhost:5001/api/districts/61/clubs
```

### Switching Between Mock and Real Data

```bash
# Use mock data (fast, no scraping)
USE_MOCK_DATA=true npm run dev:backend

# Use real data (slower, actual scraping)
USE_MOCK_DATA=false npm run dev:backend
```

## Future Enhancements

1. **Historical Data Support**: Scrape year-specific URLs for historical analysis
2. **Educational Awards**: Implement scraping for awards data
3. **Daily Reports**: Integrate with Daily Reports system
4. **Parallel Scraping**: Fetch multiple districts concurrently
5. **Error Recovery**: Better handling of partial failures
6. **Data Validation**: Validate scraped data against expected schemas
7. **Monitoring**: Add metrics for scraping success/failure rates

## Security & Ethics

- **Public Data Only**: Only scrapes publicly available dashboard data
- **No Authentication**: No credentials required (public dashboards)
- **Rate Limiting**: Respects server resources with built-in rate limiting
- **Caching**: Minimizes requests through aggressive caching
- **User Agent**: Identifies itself as "ToastmastersDistrictVisualizer"

## Dependencies

- `playwright`: Browser automation
- `csv-parse`: CSV parsing
- `chromium`: Browser engine (installed via Playwright)
