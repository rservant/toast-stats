import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import districtRoutes from './routes/districts.js'
import { authenticateToken } from './middleware/auth.js'
import { logger } from './utils/logger.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// CORS configuration
const corsOptions = {
  origin:
    process.env.NODE_ENV === 'production'
      ? process.env.CORS_ORIGIN || false
      : '*',
  credentials: true,
  optionsSuccessStatus: 200,
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json())

// Request logging
if (process.env.NODE_ENV === 'production') {
  app.use(logger.requestLogger())
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  })
})

// API routes
app.get('/api', (_req, res) => {
  res.json({ message: 'Toastmasters District Visualizer API' })
})

// Auth routes
app.use('/api/auth', authRoutes)

// District routes
app.use('/api/districts', districtRoutes)

// Protected test endpoint
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({
    message: 'This is a protected endpoint',
    user: req.user,
  })
})

// Error handling middleware
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error('Unhandled error', err)

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'An internal error occurred'
            : err.message,
      },
    })
  }
)

const server = app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    healthCheck: `http://localhost:${PORT}/health`,
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })
})
