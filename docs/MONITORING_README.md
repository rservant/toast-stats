# Brand Compliance Monitoring System

## Quick Start

The brand compliance monitoring system provides comprehensive tracking and reporting for Toastmasters brand guidelines adherence.

### Setup

1. **Initialize monitoring system:**

   ```bash
   cd frontend
   npm run monitor:setup
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.monitoring.example .env.local
   # Edit .env.local with your specific configuration
   ```

3. **Add monitoring to your app:**

   ```typescript
   // In your main App.tsx or index.tsx
   import { initializeMonitoring } from './utils/monitoring/init'

   // Initialize monitoring
   initializeMonitoring()
   ```

### Available Commands

- `npm run audit:brand-compliance` - Run comprehensive brand compliance audit
- `npm run validate:brand-compliance` - Quick validation check
- `npm run test:brand-compliance` - Run brand compliance tests
- `npm run report:compliance` - Generate compliance report
- `npm run report:performance` - Generate performance report

### Dashboard Integration

Add the monitoring dashboard to your admin interface:

```typescript
import BrandMonitoringDashboard from './components/brand/BrandMonitoringDashboard'

function AdminPage() {
  return (
    <div>
      <h1>Brand Compliance Dashboard</h1>
      <BrandMonitoringDashboard autoRefresh={true} />
    </div>
  )
}
```

## Key Features

### Real-time Monitoring

- Continuous brand compliance tracking
- Performance metrics collection
- Automated violation detection
- Alert generation for critical issues

### Comprehensive Reporting

- Real-time compliance reports
- Weekly trend analysis
- Monthly performance summaries
- Automated stakeholder reporting

### Performance Tracking

- Font loading performance
- CSS bundle size monitoring
- Validation overhead measurement
- Memory usage tracking

### Alert System

- Configurable thresholds
- Multiple severity levels
- Console, API, and webhook notifications
- Automated issue escalation

## Metrics Tracked

### Brand Compliance

- **Color Compliance Rate**: Percentage using only brand colors
- **Typography Compliance Rate**: Correct font usage percentage
- **Accessibility Score**: WCAG AA compliance percentage
- **Touch Target Compliance**: 44px minimum requirement adherence
- **Overall Compliance Score**: Weighted average of all metrics

### Performance

- **Font Loading Time**: Average time to load brand fonts
- **CSS Bundle Size**: Total size of brand-related CSS
- **Validation Overhead**: Time spent on compliance checks
- **Memory Usage**: JavaScript heap utilization

## Configuration

### Monitoring Configuration (`frontend/src/config/monitoring.json`)

```json
{
  "monitoring": {
    "enabled": true,
    "reportingInterval": 60000,
    "performanceTracking": true,
    "autoReporting": true
  },
  "alertThresholds": {
    "compliance": {
      "minOverallScore": 85,
      "maxViolations": 10
    },
    "performance": {
      "maxFontLoadTime": 3000,
      "maxCSSBundleSize": 500000
    }
  }
}
```

### Environment Variables

```bash
# Enable/disable monitoring
MONITORING_ENABLED=true

# Alert thresholds
MONITORING_MIN_COMPLIANCE_SCORE=85
MONITORING_MAX_VIOLATIONS=10

# Performance thresholds
MONITORING_MAX_FONT_LOAD_TIME=3000
MONITORING_MAX_BUNDLE_SIZE=500000

# Notification endpoints
MONITORING_WEBHOOK_URL=https://your-webhook-url
MONITORING_API_ENDPOINT=/api/monitoring
```

## CI/CD Integration

The system includes GitHub Actions workflow for automated monitoring:

- **Pull Request Checks**: Compliance audit on every PR
- **Daily Monitoring**: Scheduled compliance reports
- **Performance Tracking**: Bundle size analysis on main branch
- **Security Scanning**: Vulnerability detection

## Maintenance

### Daily Tasks

- Review compliance dashboard
- Check for critical alerts
- Verify monitoring system status

### Weekly Tasks

- Analyze weekly compliance report
- Review violation patterns
- Plan corrective actions

### Monthly Tasks

- Comprehensive compliance audit
- Performance benchmarking
- System maintenance and updates

## Troubleshooting

### Common Issues

1. **High Violation Counts**
   - Check recent code changes
   - Review most common violation types
   - Apply automatic fixes where possible

2. **Performance Issues**
   - Analyze font loading metrics
   - Review CSS bundle size
   - Optimize validation overhead

3. **Monitoring System Issues**
   - Verify browser compatibility
   - Check console for errors
   - Review configuration settings

### Getting Help

- Review documentation in `docs/BRAND_COMPLIANCE_MONITORING.md`
- Check maintenance procedures in `docs/BRAND_MAINTENANCE_PROCEDURES.md`
- Contact the Brand Compliance Team for support

## API Reference

### Monitoring Functions

```typescript
import {
  trackBrandCompliance,
  generateComplianceReport,
  getComplianceHistory,
  generateWeeklyReport,
  generateMonthlyReport,
} from './utils/brandMonitoring'

// Track current compliance
const metrics = trackBrandCompliance()

// Generate detailed report
const report = generateComplianceReport()

// Get historical data
const history = getComplianceHistory()
```

### React Hooks

```typescript
import { useBrandMonitoring } from './utils/brandMonitoring'

function MyComponent() {
  const { trackCompliance, generateReport } = useBrandMonitoring()

  // Use monitoring functions in your component
}
```

## Contributing

When contributing to the monitoring system:

1. Follow TypeScript best practices
2. Add tests for new monitoring features
3. Update documentation for configuration changes
4. Test monitoring system changes thoroughly
5. Consider performance impact of new metrics

## License

This monitoring system is part of the Toastmasters brand compliance implementation and follows the same licensing terms as the main application.
