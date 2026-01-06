import React from 'react'
import { DistrictConfiguration } from '../components/DistrictConfiguration'

/**
 * District Configuration Page
 *
 * Page wrapper for the district configuration interface.
 * Provides admin access to district configuration management.
 *
 * Features:
 * - View current district configuration
 * - Add/remove districts from configuration
 * - Validate district configuration
 * - View collection history for configured districts
 *
 * @component
 */
const DistrictConfigurationPage: React.FC = () => {
  // In a real application, this would check user permissions
  // For now, we'll assume admin access is available
  const isAdmin = true

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-tm-black">
            District Configuration
          </h1>
          <p className="mt-2 text-gray-600">
            Manage which districts are included in data snapshots and monitor
            collection status
          </p>
        </div>

        <DistrictConfiguration isAdmin={isAdmin} />
      </div>
    </div>
  )
}

export default DistrictConfigurationPage
