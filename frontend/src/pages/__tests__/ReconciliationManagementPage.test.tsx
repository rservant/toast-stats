import { vi } from 'vitest'
import { screen } from '@testing-library/react'
import {
  testComponentVariants,
  runQuickAccessibilityCheck,
} from '../../__tests__/utils'
import ReconciliationManagementPage from '../ReconciliationManagementPage'

// Mock the ReconciliationManagement component
vi.mock('../../components/ReconciliationManagement', () => ({
  ReconciliationManagement: ({ isAdmin }: { isAdmin: boolean }) => (
    <div data-testid="reconciliation-management">
      {isAdmin ? 'Admin Management Interface' : 'Access Denied'}
    </div>
  ),
}))

describe('ReconciliationManagementPage', () => {
  // Migrate to shared utilities for consistent testing patterns
  testComponentVariants(ReconciliationManagementPage, [
    {
      name: 'default page layout',
      props: {},
      expectedText: 'Reconciliation Management',
      customAssertion: container => {
        // Check for page title and description
        expect(
          screen.getByText('Reconciliation Management')
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            'Manage month-end data reconciliation jobs and system configuration'
          )
        ).toBeInTheDocument()

        // Check for ReconciliationManagement component
        const managementComponent = screen.getByTestId(
          'reconciliation-management'
        )
        expect(managementComponent).toBeInTheDocument()
        expect(managementComponent).toHaveTextContent(
          'Admin Management Interface'
        )

        // Check for proper page layout and styling
        const mainContainer = container.querySelector(
          '.min-h-screen.bg-gray-50'
        )
        expect(mainContainer).toBeInTheDocument()

        const contentWrapper = container.querySelector('.max-w-7xl.mx-auto')
        expect(contentWrapper).toBeInTheDocument()
      },
    },
  ])

  // Add comprehensive compliance testing
  it('should meet accessibility standards', () => {
    const { passed, criticalViolations } = runQuickAccessibilityCheck(
      <ReconciliationManagementPage />
    )
    if (!passed) {
      const errorMessage = `Critical accessibility violations found:\n${criticalViolations.map(v => `- ${v.violation}: ${v.remediation}`).join('\n')}`
      throw new Error(errorMessage)
    }
  })
})
