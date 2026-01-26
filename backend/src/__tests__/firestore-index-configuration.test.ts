/**
 * Unit tests for Firestore Index Configuration Validation
 *
 * Feature: firestore-index-fix
 *
 * These tests validate that the Firestore index configuration files
 * exist and follow the Firebase CLI schema requirements.
 *
 * Requirements validated:
 * - 1.5: Index configuration stored in firestore.indexes.json following Firebase CLI conventions
 * - 1.6: Firebase configuration references the Firestore indexes file
 */

import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Paths relative to the project root (backend's parent directory)
const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const FIRESTORE_INDEXES_PATH = path.join(PROJECT_ROOT, 'firestore.indexes.json')
const FIREBASE_JSON_PATH = path.join(PROJECT_ROOT, 'firebase.json')

/**
 * TypeScript interfaces for Firebase index configuration schema
 * Based on Firebase CLI conventions
 */
interface IndexField {
  fieldPath: string
  order?: 'ASCENDING' | 'DESCENDING'
  arrayConfig?: 'CONTAINS'
}

interface FirestoreIndex {
  collectionGroup: string
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP'
  fields: IndexField[]
}

interface FieldOverride {
  collectionGroup: string
  fieldPath: string
  indexes: Array<{
    order?: 'ASCENDING' | 'DESCENDING'
    arrayConfig?: 'CONTAINS'
    queryScope?: 'COLLECTION' | 'COLLECTION_GROUP'
  }>
}

interface FirestoreIndexConfig {
  indexes: FirestoreIndex[]
  fieldOverrides: FieldOverride[]
}

interface FirebaseConfig {
  firestore?: {
    indexes?: string
    rules?: string
  }
  hosting?: unknown
  [key: string]: unknown
}

describe('Feature: firestore-index-fix - Index Configuration Validation', () => {
  describe('firestore.indexes.json', () => {
    it('should exist at the project root', () => {
      const exists = fs.existsSync(FIRESTORE_INDEXES_PATH)
      expect(exists).toBe(true)
    })

    it('should be valid JSON', () => {
      const content = fs.readFileSync(FIRESTORE_INDEXES_PATH, 'utf-8')
      expect(() => JSON.parse(content)).not.toThrow()
    })

    describe('Firebase schema compliance', () => {
      let config: FirestoreIndexConfig

      beforeAll(() => {
        const content = fs.readFileSync(FIRESTORE_INDEXES_PATH, 'utf-8')
        config = JSON.parse(content) as FirestoreIndexConfig
      })

      it('should have an indexes array', () => {
        expect(config).toHaveProperty('indexes')
        expect(Array.isArray(config.indexes)).toBe(true)
      })

      it('should have a fieldOverrides array', () => {
        expect(config).toHaveProperty('fieldOverrides')
        expect(Array.isArray(config.fieldOverrides)).toBe(true)
      })

      it('should have valid index structure for each index', () => {
        for (const index of config.indexes) {
          // Each index must have collectionGroup
          expect(index).toHaveProperty('collectionGroup')
          expect(typeof index.collectionGroup).toBe('string')
          expect(index.collectionGroup.length).toBeGreaterThan(0)

          // Each index must have queryScope
          expect(index).toHaveProperty('queryScope')
          expect(['COLLECTION', 'COLLECTION_GROUP']).toContain(index.queryScope)

          // Each index must have fields array
          expect(index).toHaveProperty('fields')
          expect(Array.isArray(index.fields)).toBe(true)
          expect(index.fields.length).toBeGreaterThan(0)

          // Each field must have valid structure
          for (const field of index.fields) {
            expect(field).toHaveProperty('fieldPath')
            expect(typeof field.fieldPath).toBe('string')

            // Field must have either order or arrayConfig
            const hasOrder =
              field.order === 'ASCENDING' || field.order === 'DESCENDING'
            const hasArrayConfig = field.arrayConfig === 'CONTAINS'
            expect(hasOrder || hasArrayConfig).toBe(true)
          }
        }
      })
    })

    describe('Required indexes (Requirements 1.1, 1.2, 1.3)', () => {
      let config: FirestoreIndexConfig

      beforeAll(() => {
        const content = fs.readFileSync(FIRESTORE_INDEXES_PATH, 'utf-8')
        config = JSON.parse(content) as FirestoreIndexConfig
      })

      it('should define index for snapshots collection with __name__ descending (Requirement 1.1)', () => {
        const snapshotsNameIndex = config.indexes.find(
          index =>
            index.collectionGroup === 'snapshots' &&
            index.fields.length === 1 &&
            index.fields[0]?.fieldPath === '__name__' &&
            index.fields[0]?.order === 'DESCENDING'
        )

        expect(snapshotsNameIndex).toBeDefined()
        expect(snapshotsNameIndex?.queryScope).toBe('COLLECTION')
      })

      it('should define composite index for snapshots with metadata.status + __name__ descending (Requirement 1.2)', () => {
        const snapshotsCompositeIndex = config.indexes.find(
          index =>
            index.collectionGroup === 'snapshots' &&
            index.fields.length === 2 &&
            index.fields.some(
              f => f.fieldPath === 'metadata.status' && f.order === 'ASCENDING'
            ) &&
            index.fields.some(
              f => f.fieldPath === '__name__' && f.order === 'DESCENDING'
            )
        )

        expect(snapshotsCompositeIndex).toBeDefined()
        expect(snapshotsCompositeIndex?.queryScope).toBe('COLLECTION')
      })

      it('should define index for history subcollection with timestamp descending (Requirement 1.3)', () => {
        const historyIndex = config.indexes.find(
          index =>
            index.collectionGroup === 'history' &&
            index.fields.length === 1 &&
            index.fields[0]?.fieldPath === 'timestamp' &&
            index.fields[0]?.order === 'DESCENDING'
        )

        expect(historyIndex).toBeDefined()
        expect(historyIndex?.queryScope).toBe('COLLECTION')
      })

      it('should have exactly 3 required indexes defined', () => {
        // This ensures we don't have missing or extra indexes
        expect(config.indexes.length).toBe(3)
      })
    })
  })

  describe('firebase.json', () => {
    it('should exist at the project root', () => {
      const exists = fs.existsSync(FIREBASE_JSON_PATH)
      expect(exists).toBe(true)
    })

    it('should be valid JSON', () => {
      const content = fs.readFileSync(FIREBASE_JSON_PATH, 'utf-8')
      expect(() => JSON.parse(content)).not.toThrow()
    })

    describe('Firestore indexes reference (Requirement 1.6)', () => {
      let config: FirebaseConfig

      beforeAll(() => {
        const content = fs.readFileSync(FIREBASE_JSON_PATH, 'utf-8')
        config = JSON.parse(content) as FirebaseConfig
      })

      it('should have a firestore configuration section', () => {
        expect(config).toHaveProperty('firestore')
        expect(typeof config.firestore).toBe('object')
      })

      it('should reference firestore.indexes.json in the firestore configuration', () => {
        expect(config.firestore).toHaveProperty('indexes')
        expect(config.firestore?.indexes).toBe('firestore.indexes.json')
      })

      it('should reference an existing indexes file', () => {
        const indexesPath = config.firestore?.indexes
        expect(indexesPath).toBeDefined()

        // Verify the referenced file exists
        const fullPath = path.join(PROJECT_ROOT, indexesPath as string)
        const exists = fs.existsSync(fullPath)
        expect(exists).toBe(true)
      })
    })
  })
})
