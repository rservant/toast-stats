import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import type {
  LoginResponse,
  RefreshResponse,
  TokenPayload,
} from '../types/auth.js'

export class AuthService {
  private blacklistedTokens: Set<string> = new Set()

  /**
   * Authenticate user with Toastmasters credentials
   * In production, this would validate against the Toastmasters dashboard API
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    // Validate input
    if (!username || !password) {
      throw new Error('Username and password are required')
    }

    // TODO: In production, validate credentials against Toastmasters dashboard API
    // For now, we'll accept any non-empty credentials
    // This is a placeholder that will be replaced when integrating with ToastmastersAPIService

    if (username.trim().length === 0 || password.trim().length === 0) {
      throw new Error('Invalid credentials')
    }

    // Generate JWT token
    const token = this.generateToken(username)
    const expiresIn = this.getTokenExpirationTime()

    return {
      token,
      expiresIn,
    }
  }

  /**
   * Validate JWT token
   */
  validateToken(token: string): TokenPayload {
    // Check if token is blacklisted
    if (this.blacklistedTokens.has(token)) {
      throw new Error('Token has been revoked')
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload
      return decoded
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired')
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token')
      }
      throw new Error('Token validation failed')
    }
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(token: string): Promise<RefreshResponse> {
    // Validate the existing token
    const payload = this.validateToken(token)

    // Generate new token with same user info
    const newToken = this.generateToken(payload.username)
    const expiresIn = this.getTokenExpirationTime()

    // Blacklist the old token
    this.blacklistedTokens.add(token)

    return {
      token: newToken,
      expiresIn,
    }
  }

  /**
   * Logout user by blacklisting token
   */
  async logout(token: string): Promise<void> {
    // Validate token before blacklisting
    this.validateToken(token)

    // Add token to blacklist
    this.blacklistedTokens.add(token)
  }

  /**
   * Generate JWT token for user
   */
  private generateToken(username: string): string {
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId: this.generateUserId(username),
      username,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as any)
  }

  /**
   * Get token expiration time in seconds
   */
  private getTokenExpirationTime(): number {
    const expiresIn = config.jwt.expiresIn
    if (typeof expiresIn === 'number') {
      return expiresIn
    }

    // Parse string format like '1h', '30m', etc.
    const match = expiresIn.match(/^(\d+)([smhd])$/)
    if (!match) {
      return 3600 // Default to 1 hour
    }

    const value = parseInt(match[1], 10)
    const unit = match[2]

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    }

    return value * (multipliers[unit] || 3600)
  }

  /**
   * Generate user ID from username
   * In production, this would come from the Toastmasters API
   */
  private generateUserId(username: string): string {
    return `user_${Buffer.from(username).toString('base64')}`
  }
}
