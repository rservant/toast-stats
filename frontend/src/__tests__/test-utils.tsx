import React from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import { ProgramYearProvider } from '../contexts/ProgramYearContext'

// Ensure a minimal localStorage is available in the test environment
// Some test setups (or JSDOM versions) may not provide a working localStorage
const globalObj = globalThis as Record<string, unknown>
if (
  typeof globalObj.localStorage === 'undefined' ||
  typeof (globalObj.localStorage as { getItem?: unknown }).getItem !==
    'function'
) {
  const store: Record<string, string> = {}
  globalObj.localStorage = {
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
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    },
  }
}

// Ensure sessionStorage is available in the test environment
if (
  typeof globalObj.sessionStorage === 'undefined' ||
  typeof (globalObj.sessionStorage as { getItem?: unknown }).getItem !==
    'function'
) {
  const store: Record<string, string> = {}
  globalObj.sessionStorage = {
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
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    },
  }
}

interface RenderOptions {
  initialEntries?: string[]
  isAuthenticated?: boolean
}

export const renderWithProviders = (
  ui: React.ReactElement,
  { initialEntries = ['/'], isAuthenticated = true }: RenderOptions = {}
) => {
  // Set up authentication state before rendering
  if (isAuthenticated) {
    sessionStorage.setItem('auth_token', 'test-token')
  } else {
    sessionStorage.removeItem('auth_token')
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  // Create a memory router for testing
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: ui,
      },
    ],
    {
      initialEntries,
    }
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProgramYearProvider>
          <RouterProvider router={router} />
        </ProgramYearProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default renderWithProviders
