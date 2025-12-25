import React from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { BackfillProvider } from '../contexts/BackfillContext'
import { ProgramYearProvider } from '../contexts/ProgramYearContext'

// Ensure a minimal localStorage is available in the test environment
// Some test setups (or JSDOM versions) may not provide a working localStorage
if (typeof (globalThis as any).localStorage === 'undefined' || typeof (globalThis as any).localStorage.getItem !== 'function') {
  const store: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
  }
}

export const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProgramYearProvider>
          <BackfillProvider>{ui}</BackfillProvider>
        </ProgramYearProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default renderWithProviders
