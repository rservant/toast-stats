import { describe, it, expect } from 'vitest'
import { MembershipAnalyticsModule } from '../MembershipAnalyticsModule.js'

describe('MembershipAnalyticsModule — Growth Velocity (#219)', () => {
  const module = new MembershipAnalyticsModule()

  describe('calculateGrowthVelocity', () => {
    it('should return zero velocity for empty trend', () => {
      const result = module.calculateGrowthVelocity([])
      expect(result).toEqual({
        velocity: 0,
        acceleration: 0,
        trend: 'stable',
      })
    })

    it('should return zero velocity for single data point', () => {
      const result = module.calculateGrowthVelocity([
        { date: '2025-07-01', count: 100 },
      ])
      expect(result).toEqual({
        velocity: 0,
        acceleration: 0,
        trend: 'stable',
      })
    })

    it('should calculate positive velocity for growing membership', () => {
      const trend = [
        { date: '2025-07-01', count: 100 },
        { date: '2025-08-01', count: 110 },
        { date: '2025-09-01', count: 120 },
        { date: '2025-10-01', count: 130 },
      ]
      const result = module.calculateGrowthVelocity(trend)
      expect(result.velocity).toBe(10)
      expect(result.trend).toBe('stable')
    })

    it('should calculate negative velocity for declining membership', () => {
      const trend = [
        { date: '2025-07-01', count: 130 },
        { date: '2025-08-01', count: 120 },
        { date: '2025-09-01', count: 110 },
        { date: '2025-10-01', count: 100 },
      ]
      const result = module.calculateGrowthVelocity(trend)
      expect(result.velocity).toBe(-10)
      expect(result.trend).toBe('stable')
    })

    it('should detect accelerating growth', () => {
      // Growth rate increasing: 5, 10, 15 members/month
      const trend = [
        { date: '2025-07-01', count: 100 },
        { date: '2025-08-01', count: 105 },
        { date: '2025-09-01', count: 115 },
        { date: '2025-10-01', count: 130 },
      ]
      const result = module.calculateGrowthVelocity(trend)
      expect(result.velocity).toBe(10)
      expect(result.acceleration).toBeGreaterThan(0)
      expect(result.trend).toBe('accelerating')
    })

    it('should detect decelerating growth', () => {
      // Growth rate decreasing: 15, 10, 5 members/month
      const trend = [
        { date: '2025-07-01', count: 100 },
        { date: '2025-08-01', count: 115 },
        { date: '2025-09-01', count: 125 },
        { date: '2025-10-01', count: 130 },
      ]
      const result = module.calculateGrowthVelocity(trend)
      expect(result.velocity).toBe(10)
      expect(result.acceleration).toBeLessThan(0)
      expect(result.trend).toBe('decelerating')
    })

    it('should handle two data points', () => {
      const trend = [
        { date: '2025-07-01', count: 100 },
        { date: '2025-08-01', count: 112 },
      ]
      const result = module.calculateGrowthVelocity(trend)
      expect(result.velocity).toBe(12)
      expect(result.acceleration).toBe(0)
      expect(result.trend).toBe('stable')
    })
  })
})
