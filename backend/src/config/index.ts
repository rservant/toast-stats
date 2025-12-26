import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  toastmastersDashboardUrl:
    process.env.TOASTMASTERS_DASHBOARD_URL ||
    'https://dashboard.toastmasters.org',
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '900', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  reconciliation: {
    configFilePath:
      process.env.RECONCILIATION_CONFIG_FILE || 'reconciliation-config.json',
    cacheKey: process.env.RECONCILIATION_CACHE_KEY || 'reconciliation:config',
    cacheTTL: parseInt(
      process.env.RECONCILIATION_CONFIG_CACHE_TTL || '3600',
      10
    ),
  },
} as const
