import express, { type Express } from 'express'
import cors from 'cors'

// Set environment variable before any imports
process.env.USE_MOCK_DATA = 'true'
process.env.NODE_ENV = 'test'

import districtRoutes from '../routes/districts.js'

export function createTestApp(): Express {
  // Ensure the environment variable is set
  if (process.env.USE_MOCK_DATA !== 'true') {
    throw new Error('Mock data environment variable not set properly')
  }

  if (process.env.NODE_ENV !== 'test') {
    throw new Error('NODE_ENV must be set to test')
  }

  const app = express()

  // Middleware
  app.use(cors())
  app.use(express.json())

  // Routes
  app.use('/api/districts', districtRoutes)

  return app
}
