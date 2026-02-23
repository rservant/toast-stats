import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteFooter from '../SiteFooter'

describe('SiteFooter', () => {
  it('renders a footer with contentinfo role', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('contains the unofficial disclaimer text', () => {
    render(<SiteFooter />)
    expect(screen.getByText(/unofficial tool/i)).toBeInTheDocument()
    expect(
      screen.getByText(/not affiliated with toastmasters international/i)
    ).toBeInTheDocument()
  })

  it('contains a link to the GitHub repository', () => {
    render(<SiteFooter />)
    const repoLink = screen.getByRole('link', { name: /source code/i })
    expect(repoLink).toHaveAttribute(
      'href',
      'https://github.com/rservant/toast-stats'
    )
    expect(repoLink).toHaveAttribute('target', '_blank')
    expect(repoLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('contains a link to file issues / feedback', () => {
    render(<SiteFooter />)
    const feedbackLink = screen.getByRole('link', { name: /feedback/i })
    expect(feedbackLink).toHaveAttribute(
      'href',
      'https://github.com/rservant/toast-stats/issues'
    )
    expect(feedbackLink).toHaveAttribute('target', '_blank')
    expect(feedbackLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('contains attribution text', () => {
    render(<SiteFooter />)
    expect(screen.getByText(/built by/i)).toBeInTheDocument()
  })
})
