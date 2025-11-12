import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createTestApp } from './setup.js'

describe('Auth API Integration Tests', () => {
  const app = createTestApp()

  describe('POST /api/auth/login', () => {
    it('should return token for valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123',
        })
        .expect(200)

      expect(response.body).toHaveProperty('token')
      expect(response.body).toHaveProperty('expiresIn')
      expect(typeof response.body.token).toBe('string')
      expect(typeof response.body.expiresIn).toBe('number')
    })

    it('should return 400 when username is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123',
        })
        .expect(400)

      expect(response.body.error.code).toBe('MISSING_CREDENTIALS')
    })

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
        })
        .expect(400)

      expect(response.body.error.code).toBe('MISSING_CREDENTIALS')
    })

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: '   ',
          password: 'password123',
        })
        .expect(401)

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS')
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('should refresh valid token', async () => {
      // First login to get a token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123',
        })

      const { token } = loginResponse.body

      // Wait a moment to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Refresh the token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ token })
        .expect(200)

      expect(response.body).toHaveProperty('token')
      expect(response.body).toHaveProperty('expiresIn')
    })

    it('should return 400 when token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ token: 'invalid-token' })
        .expect(401)

      expect(response.body.error.code).toBe('INVALID_TOKEN')
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should logout with valid token', async () => {
      // First login to get a token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123',
        })

      const { token } = loginResponse.body

      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ token })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should return 400 when token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({})
        .expect(400)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ token: 'invalid-token' })
        .expect(401)

      expect(response.body.error.code).toBe('INVALID_TOKEN')
    })
  })
})
