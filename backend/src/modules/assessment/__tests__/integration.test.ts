import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import assessmentRoutes from '../routes/assessmentRoutes.js'
import { deleteMonthlyAssessment } from '../storage/assessmentStore.js'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/assessment', assessmentRoutes)
  return app
}

const app = createApp()

describe('Assessment API Integration Tests', () => {
  const districtNumber = 61
  const programYear = '2024-2025'
  const month = 'March'

  beforeAll(async () => {
    // Ensure there's no pre-existing assessment (idempotent)
    await deleteMonthlyAssessment(districtNumber, programYear, month)
  })

  afterAll(async () => {
    // Clean up created assessment
    await deleteMonthlyAssessment(districtNumber, programYear, month)
  })

  it('GET /api/assessment/available-dates/:districtId returns dates', async () => {
    const res = await request(app)
      .get(`/api/assessment/available-dates/${districtNumber}`)
      .expect(200)

    expect(res.body).toHaveProperty('success', true)
    expect(res.body.data).toHaveProperty('available_dates')
    expect(Array.isArray(res.body.data.available_dates)).toBe(true)
  })

  it('POST /api/assessment/generate creates a new assessment (201)', async () => {
    const res = await request(app).post('/api/assessment/generate').send({
      district_number: districtNumber,
      program_year: programYear,
      month,
    })

    // Debug output when unexpected status occurs
    if (res.status !== 201)
      console.error('generate-res', res.status, JSON.stringify(res.body))

    expect(res.status).toBe(201)

    expect(res.body).toHaveProperty('success', true)
    expect(res.body.data.assessment).toHaveProperty(
      'district_number',
      districtNumber
    )
    expect(res.body.data.assessment).toHaveProperty('program_year', programYear)
    expect(res.body.data.assessment).toHaveProperty('month', month)
  })

  it('POST /api/assessment/generate should fail for duplicate generation', async () => {
    const res = await request(app)
      .post('/api/assessment/generate')
      .send({
        district_number: districtNumber,
        program_year: programYear,
        month,
      })
      .expect(400)

    expect(res.body).toHaveProperty('error')
    expect(res.body.error.code).toBeDefined()
  })

  it('GET monthly assessment returns audit_trail and immutable flag', async () => {
    const res = await request(app).get(
      `/api/assessment/monthly/${districtNumber}/${programYear}/${month}`
    )

    if (res.status !== 200)
      console.error('monthly-get', res.status, JSON.stringify(res.body))

    expect(res.status).toBe(200)

    expect(res.body).toHaveProperty('success', true)
    expect(res.body.data).toHaveProperty('assessment')
    expect(res.body.data).toHaveProperty('audit_trail')
    expect(res.body.data).toHaveProperty('immutable', true)
    expect(res.body.data).toHaveProperty('read_only', true)
  })
})
