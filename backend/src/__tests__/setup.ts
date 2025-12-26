import express, { type Express } from 'express'
import cors from 'cors'
import districtRoutes from '../routes/districts.js'

export function createTestApp(): Express {
  // Force mock data for tests
  process.env.USE_MOCK_DATA = 'true'

  const app = express()

  // Middleware
  app.use(cors())
  app.use(express.json())

  // Routes
  app.use('/api/districts', districtRoutes)

  return app
}
