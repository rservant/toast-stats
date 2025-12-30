import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Card, Panel } from '../index'

describe('Card Component', () => {
  it('renders children correctly', () => {
    render(
      <Card>
        <h3>Test Card</h3>
        <p>Test content</p>
      </Card>
    )

    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('applies default variant and padding classes', () => {
    const { container } = render(
      <Card>
        <p>Test content</p>
      </Card>
    )

    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('tm-card')
    expect(card).toHaveClass('tm-card-default')
    expect(card).toHaveClass('tm-card-padding-md')
    expect(card).toHaveClass('tm-brand-compliant')
  })

  it('applies custom variant and padding classes', () => {
    const { container } = render(
      <Card variant="elevated" padding="lg">
        <p>Test content</p>
      </Card>
    )

    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('tm-card-elevated')
    expect(card).toHaveClass('tm-card-padding-lg')
  })

  it('applies custom className', () => {
    const { container } = render(
      <Card className="custom-class">
        <p>Test content</p>
      </Card>
    )

    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('custom-class')
  })

  it('handles click events when onClick is provided', () => {
    const handleClick = vi.fn()
    const { container } = render(
      <Card onClick={handleClick}>
        <p>Clickable card</p>
      </Card>
    )

    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('tm-card-interactive')
    expect(card).toHaveAttribute('role', 'button')
    expect(card).toHaveAttribute('tabIndex', '0')

    fireEvent.click(card)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies accessibility attributes correctly', () => {
    const { container } = render(
      <Card
        aria-label="Test card"
        aria-describedby="card-description"
        tabIndex={1}
      >
        <p>Test content</p>
      </Card>
    )

    const card = container.firstChild as HTMLElement
    expect(card).toHaveAttribute('aria-label', 'Test card')
    expect(card).toHaveAttribute('aria-describedby', 'card-description')
    expect(card).toHaveAttribute('tabIndex', '1')
  })

  it('does not apply interactive styles when onClick is not provided', () => {
    const { container } = render(
      <Card>
        <p>Non-clickable card</p>
      </Card>
    )

    const card = container.firstChild as HTMLElement
    expect(card).not.toHaveClass('tm-card-interactive')
    expect(card).not.toHaveAttribute('role', 'button')
  })
})

describe('Panel Component', () => {
  it('renders children correctly', () => {
    render(
      <Panel>
        <h4>Test Panel</h4>
        <p>Panel content</p>
      </Panel>
    )

    expect(screen.getByText('Test Panel')).toBeInTheDocument()
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('applies default variant and padding classes', () => {
    const { container } = render(
      <Panel>
        <p>Test content</p>
      </Panel>
    )

    const panel = container.firstChild as HTMLElement
    expect(panel).toHaveClass('tm-panel')
    expect(panel).toHaveClass('tm-panel-default')
    expect(panel).toHaveClass('tm-panel-padding-md')
    expect(panel).toHaveClass('tm-brand-compliant')
  })

  it('applies custom variant and padding classes', () => {
    const { container } = render(
      <Panel variant="subtle" padding="sm">
        <p>Test content</p>
      </Panel>
    )

    const panel = container.firstChild as HTMLElement
    expect(panel).toHaveClass('tm-panel-subtle')
    expect(panel).toHaveClass('tm-panel-padding-sm')
  })

  it('applies custom className', () => {
    const { container } = render(
      <Panel className="custom-panel-class">
        <p>Test content</p>
      </Panel>
    )

    const panel = container.firstChild as HTMLElement
    expect(panel).toHaveClass('custom-panel-class')
  })

  it('applies accessibility attributes correctly', () => {
    const { container } = render(
      <Panel aria-label="Test panel" aria-describedby="panel-description">
        <p>Test content</p>
      </Panel>
    )

    const panel = container.firstChild as HTMLElement
    expect(panel).toHaveAttribute('aria-label', 'Test panel')
    expect(panel).toHaveAttribute('aria-describedby', 'panel-description')
  })
})
