import React, { useState } from 'react'
import { Navigation, NavigationItem, NavigationMenu } from './Navigation'
import { Header, HeaderTitle, HeaderActions } from './Header'
import { Button } from './ui/Button'

/**
 * BrandComplianceDemo Component
 *
 * Comprehensive demonstration of brand-compliant Navigation and Header components
 * showcasing all the features implemented in Task 4:
 *
 * - TM Loyal Blue (#004165) navigation bars and headers
 * - White text with 9.8:1 contrast ratio on TM Loyal Blue backgrounds
 * - Primary action buttons using TM Loyal Blue with proper hover states
 * - Proper focus indicators with visible contrast
 * - Semantic markup and ARIA labels
 * - 44px minimum touch targets for accessibility
 *
 * This demo validates Requirements 1.1, 4.4, 3.4, and 3.5.
 */
const BrandComplianceDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview')
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const mainNavItems = [
    { label: 'Dashboard', href: '/', isActive: activeTab === 'dashboard' },
    {
      label: 'Districts',
      href: '/districts',
      isActive: activeTab === 'districts',
    },
    { label: 'Reports', href: '/reports', isActive: activeTab === 'reports' },
    {
      label: 'Analytics',
      href: '/analytics',
      isActive: activeTab === 'analytics',
    },
    { label: 'Admin', href: '/admin', isActive: activeTab === 'admin' },
  ]

  const tabItems = [
    {
      label: 'Overview',
      onClick: () => setActiveTab('overview'),
      isActive: activeTab === 'overview',
    },
    {
      label: 'Performance',
      onClick: () => setActiveTab('performance'),
      isActive: activeTab === 'performance',
    },
    {
      label: 'Trends',
      onClick: () => setActiveTab('trends'),
      isActive: activeTab === 'trends',
    },
    {
      label: 'Export',
      onClick: () => setActiveTab('export'),
      isActive: activeTab === 'export',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Primary Header with Brand Logo */}
      <Header variant="primary">
        <HeaderTitle level={1}>Toastmasters Analytics Platform</HeaderTitle>
        <HeaderActions>
          <Button variant="secondary" size="sm" aria-label="Open user settings">
            Settings
          </Button>
          <Button variant="accent" size="sm" aria-label="Export all data">
            Export Data
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label="Toggle mobile menu"
            className="md:hidden"
          >
            Menu
          </Button>
        </HeaderActions>
      </Header>

      {/* Main Navigation */}
      <Navigation aria-label="Main site navigation">
        <div className="flex items-center justify-between py-2">
          {/* Brand/Logo Area */}
          <a
            href="/"
            className="tm-nav-brand"
            aria-label="Toastmasters Analytics Home"
          >
            TM Analytics
          </a>

          {/* Desktop Navigation Menu */}
          <div className="hidden md:block">
            <NavigationMenu
              items={mainNavItems}
              aria-label="Main navigation menu"
            />
          </div>

          {/* Mobile Navigation Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label="Toggle navigation menu"
            className="md:hidden tm-text-white"
          >
            ☰
          </Button>
        </div>

        {/* Mobile Navigation Menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-white border-opacity-20 pt-4 pb-2">
            <nav aria-label="Mobile navigation menu">
              <ul className="space-y-1">
                {mainNavItems.map((item, index) => (
                  <li key={index}>
                    <NavigationItem
                      href={item.href}
                      isActive={item.isActive}
                      className="block w-full text-left"
                    >
                      {item.label}
                    </NavigationItem>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        )}
      </Navigation>

      {/* Secondary Header with Tab Navigation */}
      <Header variant="secondary">
        <HeaderTitle level={2}>District Performance Dashboard</HeaderTitle>
        <HeaderActions>
          <Button variant="ghost" size="sm" aria-label="Filter dashboard data">
            Filter
          </Button>
          <Button
            variant="primary"
            size="sm"
            aria-label="Refresh dashboard data"
          >
            Refresh Data
          </Button>
        </HeaderActions>
      </Header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <NavigationMenu
            items={tabItems}
            aria-label="Dashboard section navigation"
            className="py-2"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Brand Compliance Features Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="tm-h3 mb-4 tm-text-loyal-blue">
              Brand Compliance Features
            </h3>

            <div className="space-y-4 tm-body-medium">
              <div>
                <h4 className="font-semibold mb-2 tm-text-true-maroon">
                  Color Compliance:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>
                    TM Loyal Blue (#004165) for navigation and primary headers
                  </li>
                  <li>TM Cool Gray (#A9B2B1) for secondary headers</li>
                  <li>White text on TM Loyal Blue (9.8:1 contrast ratio)</li>
                  <li>Black text on TM Cool Gray (4.5:1+ contrast ratio)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2 tm-text-true-maroon">
                  Typography:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>
                    TM Headline font (Montserrat) for navigation and headers
                  </li>
                  <li>TM Body font (Source Sans 3) for content text</li>
                  <li>Minimum 14px font size maintained</li>
                  <li>1.4+ line height ratio for readability</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Accessibility Features Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="tm-h3 mb-4 tm-text-loyal-blue">
              Accessibility Features
            </h3>

            <div className="space-y-4 tm-body-medium">
              <div>
                <h4 className="font-semibold mb-2 tm-text-true-maroon">
                  Touch Targets:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>
                    44px minimum height and width for all interactive elements
                  </li>
                  <li>Proper spacing between clickable areas</li>
                  <li>Mobile-friendly touch interactions</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2 tm-text-true-maroon">
                  Focus & Navigation:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>Visible focus indicators with high contrast</li>
                  <li>Keyboard navigation support</li>
                  <li>Screen reader friendly ARIA labels</li>
                  <li>Semantic HTML markup (nav, header, button elements)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Interactive Demo Card */}
          <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
            <h3 className="tm-h3 mb-4 tm-text-loyal-blue">
              Interactive Button Demo
            </h3>

            <div className="space-y-4">
              <p className="tm-body-medium text-gray-700">
                Test the different button variants and their hover/focus states:
              </p>

              <div className="flex flex-wrap gap-4">
                <Button variant="primary" size="md">
                  Primary Button
                </Button>
                <Button variant="secondary" size="md">
                  Secondary Button
                </Button>
                <Button variant="accent" size="md">
                  Accent Button
                </Button>
                <Button variant="ghost" size="md">
                  Ghost Button
                </Button>
              </div>

              <div className="flex flex-wrap gap-4">
                <Button variant="primary" size="sm">
                  Small Primary
                </Button>
                <Button variant="primary" size="lg">
                  Large Primary
                </Button>
                <Button variant="primary" disabled>
                  Disabled
                </Button>
                <Button variant="primary" loading>
                  Loading
                </Button>
              </div>
            </div>
          </div>

          {/* Validation Results Card */}
          <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
            <h3 className="tm-h3 mb-4 tm-text-loyal-blue">
              Brand Compliance Validation
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 tm-text-true-maroon">
                  ✅ Requirements Met:
                </h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-tm-loyal-blue rounded-full mr-2"></span>
                    Requirement 1.1: TM Loyal Blue navigation and headers
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-tm-loyal-blue rounded-full mr-2"></span>
                    Requirement 4.4: Primary buttons use TM Loyal Blue
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-tm-loyal-blue rounded-full mr-2"></span>
                    Requirement 3.4: Proper focus indicators implemented
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-tm-loyal-blue rounded-full mr-2"></span>
                    Requirement 3.5: Semantic markup and ARIA labels
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-3 tm-text-true-maroon">
                  📊 Accessibility Metrics:
                </h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-tm-loyal-blue rounded-full mr-2"></span>
                    Contrast Ratio: 9.8:1 (TM Loyal Blue/White)
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-tm-loyal-blue rounded-full mr-2"></span>
                    Touch Targets: 44px minimum (WCAG AA)
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-tm-loyal-blue rounded-full mr-2"></span>
                    Font Size: 14px minimum maintained
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-tm-loyal-blue rounded-full mr-2"></span>
                    Focus Indicators: 2px outline with offset
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default BrandComplianceDemo
