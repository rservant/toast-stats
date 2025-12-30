import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Navigation, NavigationMenu } from '../Navigation'
import { Header, HeaderTitle, HeaderActions } from '../Header'
import { Button } from '../ui/Button'

describe('Navigation and Header Integration', () => {
  it('renders complete navigation and header layout', () => {
    const handleClick = vi.fn()

    const navigationItems = [
      { label: 'Dashboard', href: '/', isActive: true },
      { label: 'Reports', href: '/reports' },
      { label: 'Settings', onClick: handleClick },
    ]

    render(
      <div>
        <Header variant="primary">
          <HeaderTitle level={1}>Test Application</HeaderTitle>
          <HeaderActions>
            <Button variant="secondary" size="sm">
              Settings
            </Button>
            <Button variant="primary" size="sm">
              Export
            </Button>
          </HeaderActions>
        </Header>

        <Navigation aria-label="Main navigation">
          <NavigationMenu items={navigationItems} />
        </Navigation>
      </div>
    )

    // Verify header elements
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Test Application'
    )

    // Verify navigation elements
    expect(
      screen.getByRole('navigation', { name: 'Main navigation' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: 'Dashboard' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: 'Reports' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: 'Settings' })
    ).toBeInTheDocument()

    // Verify action buttons
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()

    // Test interaction - find the navigation Settings button (not the header one)
    const navSettingsButton = screen.getAllByRole('menuitem', {
      name: 'Settings',
    })[0]
    fireEvent.click(navSettingsButton)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies brand-compliant styling across components', () => {
    render(
      <div>
        <Header variant="primary">
          <HeaderTitle level={1}>Brand Test</HeaderTitle>
        </Header>

        <Navigation>
          <NavigationMenu items={[{ label: 'Test', href: '/test' }]} />
        </Navigation>
      </div>
    )

    const header = screen.getByRole('banner')
    const navigation = screen.getByRole('navigation')

    // Verify brand colors are applied
    expect(header).toHaveClass('tm-bg-loyal-blue')
    expect(header).toHaveClass('tm-text-white')
    expect(navigation).toHaveClass('tm-bg-loyal-blue')
    expect(navigation).toHaveClass('tm-text-white')
  })

  it('maintains accessibility standards across components', () => {
    render(
      <div>
        <Header variant="primary">
          <HeaderTitle level={1}>Accessibility Test</HeaderTitle>
          <HeaderActions>
            <Button variant="primary" aria-label="Test action">
              Action
            </Button>
          </HeaderActions>
        </Header>

        <Navigation aria-label="Test navigation">
          <NavigationMenu
            items={[
              {
                label: 'Home',
                href: '/',
                isActive: true,
                'aria-label': 'Go to home page',
              },
            ]}
          />
        </Navigation>
      </div>
    )

    // Verify semantic markup
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Test navigation' })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()

    // Verify ARIA labels
    expect(
      screen.getByRole('button', { name: 'Test action' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: 'Go to home page' })
    ).toBeInTheDocument()

    // Verify active state indication
    const activeLink = screen.getByRole('menuitem', { name: 'Go to home page' })
    expect(activeLink).toHaveAttribute('aria-current', 'page')
  })

  it('supports responsive design patterns', () => {
    render(
      <div>
        <Header variant="secondary">
          <HeaderTitle level={2}>Mobile Test</HeaderTitle>
          <HeaderActions>
            <Button variant="ghost" size="sm" className="md:hidden">
              Menu
            </Button>
          </HeaderActions>
        </Header>
      </div>
    )

    const mobileButton = screen.getByRole('button', { name: 'Menu' })
    expect(mobileButton).toHaveClass('md:hidden')

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('py-4')
    expect(header).toHaveClass('px-4')
    expect(header).toHaveClass('sm:px-6')
  })
})
