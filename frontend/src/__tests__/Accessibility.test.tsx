import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe, toHaveNoViolations } from 'jest-axe'
import LoginPage from '../pages/LoginPage'
import { AuthProvider } from '../context/AuthContext'
import StatCard from '../components/StatCard'

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations as any)

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{component}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Accessibility Tests', () => {
  it('LoginPage should have no accessibility violations', async () => {
    const { container } = renderWithProviders(<LoginPage />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('StatCard should have no accessibility violations', async () => {
    const { container } = render(
      <StatCard name="Total Members" value={1250} change={50} changePercent={4.2} trend="positive" />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('StatCard with loading state should have no accessibility violations', async () => {
    const { container } = render(<StatCard name="Total Members" value={1250} isLoading={true} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
