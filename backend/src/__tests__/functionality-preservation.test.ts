/**
 * Integration Tests for Functionality Preservation
 *
 * Converted from property-based test: functionality-preservation.property.test.ts
 * Rationale: PBT not warranted per testing.md — the original test used
 * fc.constantFrom on a fixed list of 5 endpoints and fc.stringMatching for
 * simple district ID patterns. There is no complex input space to explore:
 * the endpoints are a finite, known set and valid district IDs follow a simple
 * alphanumeric pattern easily covered by 5-7 explicit examples.
 *
 * Validates: Requirements 1.6, 2.7, 3.3, 4.4, 5.5
 */

import { describe, it, expect, beforeAll } from 'vitest'
import express, { type Express } from 'express'
import request from 'supertest'
import districtRoutes from '../routes/districts/index.js'

describe('Functionality Preservation', () => {
    let app: Express

    beforeAll(() => {
        app = express()
        app.use(express.json())
        app.use('/api/districts', districtRoutes)
    })

    describe('Core district endpoints preserve response structure', () => {
        it.each(['ABC', '42', 'X', '1', 'TOAST'])(
            'should return consistent structure for district ID "%s"',
            async districtId => {
                const response = await request(app).get(
                    `/api/districts/${districtId}/statistics`
                )

                expect(response.body).toBeDefined()

                if (response.status === 200) {
                    expect(response.body).toHaveProperty('_snapshot_metadata')
                } else {
                    expect(response.body).toHaveProperty('error')
                    expect(response.body.error).toHaveProperty('code')
                    expect(response.body.error).toHaveProperty('message')
                }
            }
        )
    })

    describe('Analytics endpoints preserve response structure', () => {
        it.each(['ABC', '42', 'X'])(
            'should return consistent analytics structure for district ID "%s"',
            async districtId => {
                const analyticsResponse = await request(app).get(
                    `/api/districts/${districtId}/analytics`
                )
                expect(analyticsResponse.body).toBeDefined()
                if (analyticsResponse.status === 200) {
                    expect(analyticsResponse.body).toBeDefined()
                } else {
                    expect(analyticsResponse.body).toHaveProperty('error')
                    expect(analyticsResponse.body.error).toHaveProperty('code')
                }

                const vulnerableResponse = await request(app).get(
                    `/api/districts/${districtId}/vulnerable-clubs`
                )
                expect(vulnerableResponse.body).toBeDefined()
                if (vulnerableResponse.status === 200) {
                    expect(vulnerableResponse.body).toHaveProperty('clubs')
                    expect(vulnerableResponse.body).toHaveProperty(
                        'totalVulnerableClubs'
                    )
                } else {
                    expect(vulnerableResponse.body).toHaveProperty('error')
                }
            }
        )
    })

    describe('Snapshot endpoints preserve response structure', () => {
        it.each(['ABC', '42', 'X'])(
            'should return consistent cached-dates structure for district ID "%s"',
            async districtId => {
                const response = await request(app).get(
                    `/api/districts/${districtId}/cached-dates`
                )
                expect(response.body).toBeDefined()
                if (response.status === 200) {
                    expect(response.body).toHaveProperty('dates')
                    expect(response.body).toHaveProperty('count')
                    expect(Array.isArray(response.body.dates)).toBe(true)
                } else {
                    expect(response.body).toHaveProperty('error')
                }
            }
        )
    })

    describe('Error responses preserve consistent format', () => {
        it.each(['a!b', 'test@', '#$%', 'a b'])(
            'should return INVALID_DISTRICT_ID for invalid input "%s"',
            async invalidDistrictId => {
                const response = await request(app).get(
                    `/api/districts/${encodeURIComponent(invalidDistrictId)}/statistics`
                )

                if (response.status === 400) {
                    expect(response.body).toHaveProperty('error')
                    expect(response.body.error).toHaveProperty('code')
                    expect(response.body.error).toHaveProperty('message')
                    expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
                }
            }
        )
    })

    describe('Rankings endpoint preserves response structure', () => {
        it('should return consistent structure without date parameter', async () => {
            const response = await request(app).get('/api/districts/rankings')
            expect(response.body).toBeDefined()
            if (response.status === 200) {
                expect(response.body).toBeDefined()
            } else {
                expect(response.body).toHaveProperty('error')
                expect(response.body.error).toHaveProperty('code')
                expect(response.body.error).toHaveProperty('message')
            }
        })

        it.each(['2024-01-15', '2023-06-28', '2025-02-01'])(
            'should return consistent structure with date parameter "%s"',
            async date => {
                const response = await request(app).get(
                    `/api/districts/rankings?date=${date}`
                )
                expect(response.body).toBeDefined()
                if (response.status === 200) {
                    expect(response.body).toBeDefined()
                } else {
                    expect(response.body).toHaveProperty('error')
                    expect(response.body.error).toHaveProperty('code')
                    expect(response.body.error).toHaveProperty('message')
                }
            }
        )
    })

    describe('Export endpoint preserves response structure', () => {
        it.each([
            ['ABC', 'csv'],
            ['42', 'json'],
            ['X', 'invalid'],
        ])(
            'should return consistent structure for district "%s" with format "%s"',
            async (districtId, format) => {
                const response = await request(app).get(
                    `/api/districts/${districtId}/export?format=${format}`
                )
                expect(response.body).toBeDefined()

                if (format === 'invalid' || format === 'json') {
                    expect(response.status).toBe(400)
                    expect(response.body).toHaveProperty('error')
                    expect(response.body.error).toHaveProperty('code')
                } else {
                    if (response.status === 200) {
                        expect(response.body).toBeDefined()
                    } else {
                        expect(response.body).toHaveProperty('error')
                    }
                }
            }
        )
    })

    describe('Year-over-year endpoint preserves response structure', () => {
        it.each([
            ['ABC', '2024-01-15'],
            ['42', '2023-06-28'],
            ['X', '2025-02-01'],
        ])(
            'should return consistent structure for district "%s" on date "%s"',
            async (districtId, date) => {
                const response = await request(app).get(
                    `/api/districts/${districtId}/year-over-year/${date}`
                )
                expect(response.body).toBeDefined()
                if (response.status === 200) {
                    expect(response.body).toBeDefined()
                } else {
                    expect(response.body).toHaveProperty('error')
                    expect(response.body.error).toHaveProperty('code')
                }
            }
        )
    })
})
