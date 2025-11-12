import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import districtRoutes from './routes/districts.js'
import { authenticateToken } from './middleware/auth.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
