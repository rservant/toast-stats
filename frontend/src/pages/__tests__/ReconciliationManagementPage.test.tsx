import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ReconciliationManagementPage from '../ReconciliationManagementPage';

// Mock the ReconciliationManagement component
vi.mock('../../components/ReconciliationManagement', () => ({
  ReconciliationManagement: ({ isAdmin }: { isAdmin: boolean }) => (
    <div data-testid="reconciliation-management">
      {isAdmin ? 'Admin Management Interface' : 'Access Denied'}
    </div>
  ),
}));

describe('ReconciliationManagementPage', () => {
  it('should render the page with correct title and description', () => {
    render(<ReconciliationManagementPage />);
    
    expect(screen.getByText('Reconciliation Management')).toBeInTheDocument();
    expect(screen.getByText('Manage month-end data reconciliation jobs and system configuration')).toBeInTheDocument();
  });

  it('should render the ReconciliationManagement component with admin access', () => {
    render(<ReconciliationManagementPage />);
    
    const managementComponent = screen.getByTestId('reconciliation-management');
    expect(managementComponent).toBeInTheDocument();
    expect(managementComponent).toHaveTextContent('Admin Management Interface');
  });

  it('should have proper page layout and styling', () => {
    const { container } = render(<ReconciliationManagementPage />);
    
    // Check for main container classes
    const mainContainer = container.querySelector('.min-h-screen.bg-gray-50');
    expect(mainContainer).toBeInTheDocument();
    
    // Check for content wrapper
    const contentWrapper = container.querySelector('.max-w-7xl.mx-auto');
    expect(contentWrapper).toBeInTheDocument();
  });
});