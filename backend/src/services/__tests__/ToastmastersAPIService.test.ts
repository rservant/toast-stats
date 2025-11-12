import { describe, it, expect, beforeEach } from 'vitest'
import { ToastmastersAPIService } from '../ToastmastersAPIService.js'

describe('ToastmastersAPIService', () => {
  let apiService: ToastmastersAPIService

  beforeEach(() => {
    apiService = new ToastmastersAPIService()
  })

  describe('isAuthenticated', () => {
    it('should return false when not authenticated', () => {
      expect(apiService.isAuthenticated()).toBe(false)
    })
  })

  describe('transformResponse', () => {
    it('should transform data using provided transformer function', () => {
      const inputData = { count: 5, items: ['a', 'b', 'c'] }
      const transformer = (data: typeof inputData) => ({
        total: data.count,
        list: data.items,
      })

      const result = apiService.transformResponse(inputData, transformer)

      expect(result).toEqual({
        total: 5,
        list: ['a', 'b', 'c'],
      })
    })

    it('should handle complex transformations', () => {
      interface ApiResponse {
        users: Array<{ id: number; name: string }>
      }

      const inputData: ApiResponse = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      }

      const transformer = (data: ApiResponse) => ({
        userCount: data.users.length,
        userNames: data.users.map((u) => u.name),
      })

      const result = apiService.transformResponse(inputData, transformer)

      expect(result).toEqual({
        userCount: 2,
        userNames: ['Alice', 'Bob'],
      })
    })

    it('should throw error when transformer fails', () => {
      const inputData = { value: 42 }
      const faultyTransformer = () => {
        throw new Error('Transformation error')
      }

      expect(() =>
        apiService.transformResponse(inputData, faultyTransformer)
      ).toThrow('Failed to transform API response')
    })
  })
})
