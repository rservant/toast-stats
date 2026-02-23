/**
 * Unit tests for InfoTooltip component (#92)
 *
 * Verifies:
 * - Renders the info icon
 * - Shows tooltip text on hover
 * - Hides tooltip when mouse leaves
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import InfoTooltip from '../InfoTooltip'

describe('InfoTooltip (#92)', () => {
  it('should render a button with an info icon', () => {
    render(<InfoTooltip text="Some explanation" />)

    const button = screen.getByRole('button', { name: /info/i })
    expect(button).toBeInTheDocument()
  })

  it('should show tooltip text on hover', () => {
    render(<InfoTooltip text="This is the explanation" />)

    const button = screen.getByRole('button', { name: /info/i })
    fireEvent.mouseEnter(button)

    expect(screen.getByText('This is the explanation')).toBeVisible()
  })

  it('should hide tooltip when mouse leaves', () => {
    render(<InfoTooltip text="This is the explanation" />)

    const button = screen.getByRole('button', { name: /info/i })
    fireEvent.mouseEnter(button)
    expect(screen.getByText('This is the explanation')).toBeVisible()

    fireEvent.mouseLeave(button)
    // Tooltip should not be visible (hidden via CSS or removed from DOM)
    expect(
      screen.queryByText('This is the explanation')
    ).not.toBeInTheDocument()
  })

  it('should show tooltip on focus for keyboard accessibility', () => {
    render(<InfoTooltip text="Accessible tooltip" />)

    const button = screen.getByRole('button', { name: /info/i })
    fireEvent.focus(button)

    expect(screen.getByText('Accessible tooltip')).toBeVisible()
  })
})
