import { describe, it, expect } from 'vitest'
import { CspExtractorService } from '../services/cspExtractorService.js'

describe('CspExtractorService', () => {
  it('counts CSP clubs when field is "CSP Achieved"', () => {
    const svc = new CspExtractorService()
    const rows = [
      { 'Club Name': 'A', 'CSP Achieved': 'Yes' },
      { 'Club Name': 'B', 'CSP Achieved': 'No' },
      { 'Club Name': 'C', 'CSP Achieved': 'TRUE' }
    ]

    const res = svc.extractCspCount(rows)
    expect(res.csp_count).toBe(2)
    expect(res.total_clubs).toBe(3)
    expect(res.csp_field_name).toBe('CSP Achieved')
  })

  it('handles alternative column names and values', () => {
    const svc = new CspExtractorService()
    const rows = [
      { name: 'A', CSP: 'X' },
      { name: 'B', CSP: '' },
      { name: 'C', CSP: '1' }
    ]

    const res = svc.extractCspCount(rows)
    expect(res.csp_count).toBe(2)
    expect(res.total_clubs).toBe(3)
    expect(res.csp_field_name).toBe('CSP')
  })

  it('returns zero and null field when no CSP field found', () => {
    const svc = new CspExtractorService()
    const rows = [ { name: 'A' }, { name: 'B' } ]

    const res = svc.extractCspCount(rows)
    expect(res.csp_count).toBe(0)
    expect(res.csp_field_name).toBe(null)
  })
})
