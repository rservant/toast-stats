import React from 'react'
import { ReconciliationManagement } from '../components/ReconciliationManagement'

/**
 * ReconciliationManagementPage Component
 *
 * Page wrapper for the reconciliation management interface.
 * Provides admin access to reconciliation job management and configuration.
 *
 * Requirements: 6.4, 6.5
 * - Admin interface for viewing active reconciliations
 * - Manual reconciliation initiation controls
 * - Reconciliation configuration management UI
 *
 * @component
 */
const ReconciliationManagementPage: React.FC = () => {
  // In a real application, this would check user permissions
  // For now, we'll assume admin access is available
  const isAdmin = true

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Reconciliation Management
          </h1>
          <p className="mt-2 text-gray-600">
            Manage month-end data reconciliation jobs and system configuration
          </p>
        </div>

        <ReconciliationManagement isAdmin={isAdmin} />
      </div>
    </div>
  )
}

export default ReconciliationManagementPage
