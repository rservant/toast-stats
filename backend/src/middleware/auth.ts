import type { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/AuthService.js'

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        username: string
      }
    }
  }
}

const authService = new AuthService()

/**
 * Middleware to validate JWT token from Authorization header
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: {
          code: 'NO_TOKEN',
          message: 'Authentication token is required',
        },
      })
      return
    }

    // Validate token
    const payload = authService.validateToken(token)

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      username: payload.username,
    }

    next()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed'

    if (message.includes('expired')) {
      res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired',
        },
      })
      return
    }

    if (message.includes('revoked')) {
      res.status(401).json({
        error: {
          code: 'TOKEN_REVOKED',
          message: 'Authentication token has been revoked',
        },
      })
      return
    }

    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
      },
    })
  }
}
