import { describe, expect } from 'vitest'
import { axe, toHaveNoViolations } from 'jest-axe'
import React from 'react'
import { testComponentVariants } from './utils'
import StatCard from '../components/StatCard'

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations)

// Axe synchronization to prevent concurrent runs
let axeRunning = false
const axeQueue: Array<() => Promise<void>> = []

const runAxeSynchronized = async (container: Element): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    const wrappedFn = async () => {
      try {
        const results = await axe(container)
        resolve(results)
      } catch (error) {
        reject(error)
      } finally {
        axeRunning = false
        // Process next item in queue
        const next = axeQueue.shift()
        if (next) {
          axeRunning = true
          next()
        }
      }
    }

    if (axeRunning) {
      // Add to queue
      axeQueue.push(wrappedFn)
    } else {
      // Run immediately
      axeRunning = true
      wrappedFn()
    }
  })
}

describe('Accessibility Tests', () => {
  // Migrate StatCard tests to use shared utilities with synchronized axe runs
  testComponentVariants(
    StatCard as unknown as React.ComponentType<Record<string, unknown>>,
    [
      {
        name: 'with complete data',
        props: {
          name: 'Total Members',
          value: 1250,
          change: 50,
          changePercent: 4.2,
          trend: 'positive' as const,
        },
        customAssertion: async container => {
          const results = await runAxeSynchronized(container)
          expect(results).toHaveNoViolations()
        },
      },
      {
        name: 'with loading state',
        props: {
          name: 'Total Members',
          value: 1250,
          isLoading: true,
        },
        customAssertion: async container => {
          const results = await runAxeSynchronized(container)
          expect(results).toHaveNoViolations()
        },
      },
    ],
    {
      skipAccessibilityCheck: true, // Skip the built-in accessibility check since we're doing our own
    }
  )
})
