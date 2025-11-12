import { describe, it, expect, beforeEach } from 'vitest'
import { AuthService } from '../AuthService.js'

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    authService = new AuthService()
  })

  describe('login', () => {
    it('should return token and expiresIn for valid credentials', async () => {
      const result = await authService.login('testuser', 'password123')

      expect(result).toHaveProperty('token')
      expect(result).toHaveProperty('expiresIn')
      expect(typeof result.token).toBe('string')
      expect(typeof result.expiresIn).toBe('number')
      expect(result.token.length).toBeGreaterThan(0)
    })

    it('should throw error when username is empty', async () => {
      await expect(authService.login('', 'password123')).rejects.toThrow(
        'Username and password are required'
      )
    })

    it('should throw error when password is empty', async () => {
      await expect(authService.login('testuser', '')).rejects.toThrow(
        'Username and password are required'
      )
    })

    it('should throw error when username is only whitespace', async () => {
      await expect(authService.login('   ', 'password123')).rejects.toThrow(
        'Invalid credentials'
      )
    })

    it('should throw error when password is only whitespace', async () => {
      await expect(authService.login('testuser', '   ')).rejects.toThrow(
        'Invalid credentials'
      )
    })
  })

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const { token } = await authService.login('testuser', 'password123')
      const payload = authService.validateToken(token)

      expect(payload).toHaveProperty('username', 'testuser')
      expect(payload).toHaveProperty('userId')
      expect(payload).toHaveProperty('iat')
      expect(payload).toHaveProperty('exp')
    })

    it('should throw error for invalid token', () => {
      expect(() => authService.validateToken('invalid-token')).toThrow(
        'Invalid token'
      )
    })

    it('should throw error for blacklisted token', async () => {
      const { token } = await authService.login('testuser', 'password123')
      await authService.logout(token)

      expect(() => authService.validateToken(token)).toThrow(
        'Token has been revoked'
      )
    })
  })

  describe('refreshToken', () => {
    it('should generate new token and blacklist old token', async () => {
      const { token: oldToken } = await authService.login(
        'testuser',
        'password123'
      )
      
      // Wait a moment to ensure different timestamp in JWT
      await new Promise((resolve) => setTimeout(resolve, 1100))
      
      const { token: newToken, expiresIn } =
        await authService.refreshToken(oldToken)

      expect(newToken).toBeDefined()
      expect(typeof newToken).toBe('string')
      expect(typeof expiresIn).toBe('number')

      // Old token should be blacklisted
      expect(() => authService.validateToken(oldToken)).toThrow(
        'Token has been revoked'
      )

      // New token should be valid
      const payload = authService.validateToken(newToken)
      expect(payload.username).toBe('testuser')
    })

    it('should throw error when refreshing invalid token', async () => {
      await expect(
        authService.refreshToken('invalid-token')
      ).rejects.toThrow('Invalid token')
    })
  })

  describe('logout', () => {
    it('should blacklist token on logout', async () => {
      const { token } = await authService.login('testuser', 'password123')

      await authService.logout(token)

      expect(() => authService.validateToken(token)).toThrow(
        'Token has been revoked'
      )
    })

    it('should throw error when logging out with invalid token', async () => {
      await expect(authService.logout('invalid-token')).rejects.toThrow(
        'Invalid token'
      )
    })
  })
})
