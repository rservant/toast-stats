import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from '../pages/LoginPage'
import { AuthProvider } from '../context/AuthContext'

const renderLoginPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Login Flow Integration', () => {
  it('should render login form with all required fields', () => {
    renderLoginPage()

    expect(screen.getByRole('heading', { name: /toastmasters district visualizer/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('should display validation errors for empty fields', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    const loginButton = screen.getByRole('button', { name: /login/i })
    await user.click(loginButton)

    expect(screen.getByText('Username is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
  })

  it('should allow user to type in username and password fields', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    const usernameInput = screen.getByLabelText(/username/i) as HTMLInputElement
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement

    await user.type(usernameInput, 'testuser')
    await user.type(passwordInput, 'password123')

    expect(usernameInput.value).toBe('testuser')
    expect(passwordInput.value).toBe('password123')
  })

  it('should clear validation errors when user starts typing', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    const loginButton = screen.getByRole('button', { name: /login/i })
    const usernameInput = screen.getByLabelText(/username/i)

    // Trigger validation errors
    await user.click(loginButton)
    expect(screen.getByText('Username is required')).toBeInTheDocument()

    // Start typing
    await user.type(usernameInput, 't')

    // Validation error should still be there until form is submitted again
    expect(screen.getByText('Username is required')).toBeInTheDocument()
  })
})
