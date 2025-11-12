import { Router, type Request, type Response } from 'express'
import { AuthService } from '../services/AuthService.js'
import { clearCacheOnLogout } from '../middleware/cache.js'
import type {
  LoginRequest,
  RefreshRequest,
  LogoutRequest,
} from '../types/auth.js'

const router = Router()
const authService = new AuthService()

/**
 * POST /api/auth/login
 * Authenticate user with Toastmasters credentials
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as LoginRequest

    // Validate request body
    if (!username || !password) {
      res.status(400).json({
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Username and password are required',
        },
      })
      return
    }

    // Authenticate user
    const result = await authService.login(username, password)

    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed'

    if (message.includes('Invalid credentials')) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      })
      return
    }

    res.status(500).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'An error occurred during authentication',
      },
    })
  }
})

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { token } = req.body as RefreshRequest

    // Validate request body
    if (!token) {
      res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Token is required',
        },
      })
      return
    }

    // Refresh token
    const result = await authService.refreshToken(token)

    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token refresh failed'

    if (message.includes('expired')) {
      res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired and cannot be refreshed',
        },
      })
      return
    }

    if (message.includes('Invalid token') || message.includes('revoked')) {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or revoked token',
        },
      })
      return
    }

    res.status(500).json({
      error: {
        code: 'REFRESH_ERROR',
        message: 'An error occurred during token refresh',
      },
    })
  }
})

/**
 * POST /api/auth/logout
 * Logout user by invalidating token
 */
router.post('/logout', clearCacheOnLogout(), async (req: Request, res: Response) => {
  try {
    const { token } = req.body as LogoutRequest

    // Validate request body
    if (!token) {
      res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Token is required',
        },
      })
      return
    }

    // Logout user
    await authService.logout(token)

    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout failed'

    if (message.includes('Invalid token') || message.includes('expired')) {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
        },
      })
      return
    }

    res.status(500).json({
      error: {
        code: 'LOGOUT_ERROR',
        message: 'An error occurred during logout',
      },
    })
  }
})

export default router
