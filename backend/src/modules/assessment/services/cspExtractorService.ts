import fs from 'fs'
import path from 'path'

type ClubData = {
  [key: string]: string | number | undefined
}

type ExtractResult = {
  csp_count: number
  clubs_with_csp: ClubData[]
  total_clubs: number
  csp_field_name: string | null
}

/**
 * CspExtractorService
 *
 * Parses cached Club.aspx CSV payloads (already parsed into objects) and
 * identifies the column used to signal CSP achievement. Returns counts and
 * metadata about the parsing result.
 */
export class CspExtractorService {
  private mapping: {
    csv_columns_to_check: string[]
    valid_true_values: string[]
    valid_false_values: string[]
  }

  constructor(mappingPath?: string) {
    const p =
      mappingPath ??
      path.join(
        process.cwd(),
        'backend',
        'src',
        'modules',
        'assessment',
        'config',
        'cspMapping.json'
      )
    try {
      // Synchronously read config at startup (it's small)
      // We do this so that unit tests can override mappingPath if needed
      // Prefer await in actual runtime but keep synchronous-ish behavior
      const buf = Buffer.from(fs.readFileSync ? fs.readFileSync(p) : '')
      // If fs.readFileSync not available (jest environment), fallback to async in caller
      this.mapping = JSON.parse(buf.toString())
    } catch {
      // Default fallback mapping
      this.mapping = {
        csv_columns_to_check: [
          'CSP Achieved',
          'CSP',
          'Competent Toastmaster Speaker Program',
          'Speaker Program Achieved',
          'competent_speaker_program',
          'csp_achieved',
          'achievement_status',
        ],
        valid_true_values: ['Yes', 'TRUE', 'true', 'X', '1', 'achieved'],
        valid_false_values: [
          'No',
          'FALSE',
          'false',
          ' ',
          '0',
          'not_achieved',
          '',
        ],
      }
    }
  }

  /**
   * Identify likely CSP column name in club record objects (case-insensitive)
   */
  private findCspColumn(headers: string[]): string | null {
    const normalized = headers.map(h => h.trim().toLowerCase())

    // Check mappings first
    for (const candidate of this.mapping.csv_columns_to_check) {
      const idx = normalized.findIndex(h => h === candidate.toLowerCase())
      if (idx >= 0) return headers[idx]
    }

    // Fallback: any header containing 'csp' or 'competent' or 'speaker' + 'program'
    for (let i = 0; i < normalized.length; i++) {
      const h = normalized[i]
      if (
        h.includes('csp') ||
        (h.includes('competent') && h.includes('speaker')) ||
        h.includes('speaker program')
      ) {
        return headers[i]
      }
    }

    return null
  }

  /**
   * Normalize a raw value and determine if it qualifies as 'true' for CSP
   */
  private isTrueValue(v: unknown): boolean {
    if (v === null || v === undefined) return false
    const s = String(v).trim()
    if (s.length === 0) return false
    const normal = s.toLowerCase()
    return this.mapping.valid_true_values
      .map(x => x.toLowerCase())
      .includes(normal)
  }

  /**
   * Extract CSP count from an array of club record objects
   */
  extractCspCount(clubRecords: Record<string, unknown>[]): ExtractResult {
    const total_clubs = clubRecords.length

    if (total_clubs === 0) {
      return {
        csp_count: 0,
        clubs_with_csp: [],
        total_clubs: 0,
        csp_field_name: null,
      }
    }

    const headers = Object.keys(clubRecords[0])
    const cspField = this.findCspColumn(headers)

    if (!cspField) {
      return {
        csp_count: 0,
        clubs_with_csp: [],
        total_clubs,
        csp_field_name: null,
      }
    }

    const clubs_with_csp: ClubData[] = []
    let csp_count = 0

    for (const rec of clubRecords) {
      const val = rec[cspField]
      if (this.isTrueValue(val)) {
        csp_count++
        clubs_with_csp.push(rec as ClubData)
      }
    }

    return { csp_count, clubs_with_csp, total_clubs, csp_field_name: cspField }
  }
}

// Compatibility export
export default CspExtractorService
