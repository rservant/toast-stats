import React, { useState } from 'react'
import { Alert } from './Alert'

export const AlertExample: React.FC = () => {
  const [showDismissible, setShowDismissible] = useState(true)

  return (
    <div className="p-6 space-y-6">
      <h2 className="tm-h2 mb-4">Alert Examples</h2>

      <div className="space-y-4">
        <h3 className="tm-h3">Alert Variants</h3>

        <Alert variant="success" title="Success">
          Your action was completed successfully. All data has been saved.
        </Alert>

        <Alert variant="warning" title="Warning">
          Please review your input. Some fields may need attention before
          proceeding.
        </Alert>

        <Alert variant="error" title="Error">
          An error occurred while processing your request. Please try again.
        </Alert>

        <Alert variant="info" title="Information">
          Here's some helpful information about this feature and how to use it
          effectively.
        </Alert>

        <Alert variant="highlight" title="Featured">
          This is a highlighted announcement or important update for users.
        </Alert>
      </div>

      <div className="space-y-4">
        <h3 className="tm-h3">Alert Sizes</h3>

        <Alert variant="info" size="sm" title="Small Alert">
          This is a small alert with compact spacing.
        </Alert>

        <Alert variant="info" size="md" title="Medium Alert">
          This is a medium alert with standard spacing.
        </Alert>

        <Alert variant="info" size="lg" title="Large Alert">
          This is a large alert with generous spacing for important messages.
        </Alert>
      </div>

      <div className="space-y-4">
        <h3 className="tm-h3">Dismissible Alert</h3>

        {showDismissible && (
          <Alert
            variant="highlight"
            title="Dismissible Alert"
            onClose={() => setShowDismissible(false)}
          >
            This alert can be dismissed by clicking the close button. The close
            button meets the 44px touch target requirement.
          </Alert>
        )}

        {!showDismissible && (
          <button
            onClick={() => setShowDismissible(true)}
            className="tm-btn-primary px-4 py-2 rounded-md tm-touch-target"
          >
            Show Dismissible Alert
          </button>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="tm-h3">Alerts Without Titles</h3>

        <Alert variant="success">Simple success message without a title.</Alert>

        <Alert variant="warning">Simple warning message without a title.</Alert>
      </div>

      <div className="space-y-4">
        <h3 className="tm-h3">Brand Color Usage</h3>
        <div className="space-y-2 tm-body-medium">
          <p>
            <strong>TM True Maroon (#772432):</strong> Used for warning and
            error alerts with 10% opacity background
          </p>
          <p>
            <strong>TM Happy Yellow (#F2DF74):</strong> Used for highlight
            alerts with 20% opacity background
          </p>
          <p>
            <strong>TM Loyal Blue (#004165):</strong> Used for success alerts
            with 10% opacity background
          </p>
          <p>
            <strong>TM Cool Gray (#A9B2B1):</strong> Used for info alerts with
            20% opacity background
          </p>
          <p>
            <strong>Contrast Validation:</strong> All text maintains WCAG AA
            compliance with 4.5:1+ contrast ratios
          </p>
        </div>
      </div>
    </div>
  )
}

export default AlertExample
