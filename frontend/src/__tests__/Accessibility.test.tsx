import { describe, it, expect } from 'vitest'
import { axe, toHaveNoViolations } from 'jest-axe'
import React from 'react'
import { renderWithProviders, testComponentVariants } from './utils'
import LoginPage from '../pages/LoginPage'
import { AuthProvider } from '../context/AuthContext'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import StatCard from '../components/StatCard'

// Extend expect with jest-axe matchers
// @ts-expect-error - jest-axe types are not perfectly compatible with vitest expect
expect.extend(toHaveNoViolations)

describe('Accessibility Tests', () => {
  it('LoginPage should have no accessibility violations', async () => {
    const { container } = renderWithProviders(<LoginPage />, {
      skipRouter: true,
      customProviders: [
        ({ children }) => {
          const queryClient = new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
          return (
            <QueryClientProvider client={queryClient}>
              <BrowserRouter>
                <AuthProvider>{children}</AuthProvider>
              </BrowserRouter>
            </QueryClientProvider>
          )
        },
      ],
    })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  // Migrate StatCard tests to use shared utilities
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
          const results = await axe(container)
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
          const results = await axe(container)
          expect(results).toHaveNoViolations()
        },
      },
    ]
  )
})
