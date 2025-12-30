import React from 'react'
import Navigation from './Navigation'
import NavigationMenu from './NavigationMenu'
import { Header, HeaderTitle, HeaderActions } from '../Header'
import { Button } from '../ui/Button'

/**
 * NavigationExample Component
 *
 * Demonstrates the usage of brand-compliant Navigation and Header components
 * with proper TM Loyal Blue styling, accessibility features, and semantic markup.
 *
 * This example shows:
 * - Navigation with TM Loyal Blue background and white text (9.8:1 contrast)
 * - Header with brand-compliant styling
 * - Primary action buttons using TM Loyal Blue
 * - Proper focus indicators and hover states
 * - Semantic markup and ARIA labels
 * - 44px minimum touch targets
 */
const NavigationExample: React.FC = () => {
  const navigationItems = [
    { label: 'Dashboard', href: '/', isActive: true },
    { label: 'Districts', href: '/districts' },
    { label: 'Reports', href: '/reports' },
    { label: 'Admin', href: '/admin' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Primary Header */}
      <Header variant="primary">
        <HeaderTitle level={1}>Toastmasters Analytics</HeaderTitle>
        <HeaderActions>
          <Button variant="secondary" size="sm">
            Settings
          </Button>
          <Button variant="accent" size="sm">
            Export Data
          </Button>
        </HeaderActions>
      </Header>

      {/* Main Navigation */}
      <Navigation aria-label="Main navigation">
        <div className="flex items-center justify-between py-2">
          <a href="/" className="tm-nav-brand">
            TM Analytics
          </a>
          <NavigationMenu items={navigationItems} />
        </div>
      </Navigation>

      {/* Secondary Header */}
      <Header variant="secondary">
        <HeaderTitle level={2}>District Performance Dashboard</HeaderTitle>
        <HeaderActions>
          <Button variant="ghost" size="sm">
            Filter
          </Button>
          <Button variant="primary" size="sm">
            Refresh Data
          </Button>
        </HeaderActions>
      </Header>

      {/* Content Area */}
      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="tm-h3 mb-4">Navigation Features Demonstrated</h3>

          <div className="space-y-4 tm-body-medium">
            <div>
              <h4 className="font-semibold mb-2">Brand Compliance:</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>TM Loyal Blue (#004165) background on navigation</li>
                <li>White text for 9.8:1 contrast ratio (WCAG AA compliant)</li>
                <li>TM Headline font (Montserrat) for navigation items</li>
                <li>Primary buttons use TM Loyal Blue background</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Accessibility Features:</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>44px minimum touch targets for all interactive elements</li>
                <li>Proper focus indicators with visible contrast</li>
                <li>Semantic markup with nav, header, and button elements</li>
                <li>ARIA labels and current page indicators</li>
                <li>Keyboard navigation support</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Interactive States:</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Hover effects with subtle background overlays</li>
                <li>Active state indication for current page</li>
                <li>Disabled state handling</li>
                <li>Loading state support for buttons</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default NavigationExample
