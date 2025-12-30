import React from 'react'
import { Card, Panel } from './index'

export const CardExample: React.FC = () => {
  return (
    <div className="space-y-6 p-6">
      <h2 className="tm-h2">Card and Panel Examples</h2>

      {/* Card Examples */}
      <section>
        <h3 className="tm-h3 mb-4">Card Variants</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="default" padding="md">
            <h4 className="tm-headline font-semibold mb-2">Default Card</h4>
            <p className="tm-body-medium">
              This is a default card with standard styling and medium padding.
            </p>
          </Card>

          <Card variant="elevated" padding="md">
            <h4 className="tm-headline font-semibold mb-2">Elevated Card</h4>
            <p className="tm-body-medium">
              This card has enhanced shadow for more visual prominence.
            </p>
          </Card>

          <Card variant="outlined" padding="md">
            <h4 className="tm-headline font-semibold mb-2">Outlined Card</h4>
            <p className="tm-body-medium">
              This card uses a prominent border instead of shadow.
            </p>
          </Card>
        </div>
      </section>

      {/* Interactive Card Example */}
      <section>
        <h3 className="tm-h3 mb-4">Interactive Card</h3>
        <Card
          variant="elevated"
          padding="lg"
          onClick={() => alert('Card clicked!')}
          aria-label="Click to see alert"
        >
          <div className="tm-card-header">
            <h4 className="tm-headline font-semibold">Clickable Card</h4>
          </div>
          <div className="tm-card-content">
            <p className="tm-body-medium">
              This card is interactive and can be clicked. It meets the 44px
              minimum touch target requirement.
            </p>
          </div>
          <div className="tm-card-footer">
            <p className="tm-body-small text-gray-600">
              Click anywhere on this card
            </p>
          </div>
        </Card>
      </section>

      {/* Panel Examples */}
      <section>
        <h3 className="tm-h3 mb-4">Panel Variants</h3>
        <div className="space-y-4">
          <Panel variant="default" padding="md">
            <h4 className="tm-headline font-semibold mb-2">Default Panel</h4>
            <p className="tm-body-medium">
              This panel uses TM Cool Gray background for secondary content
              areas. The text maintains proper contrast ratios for
              accessibility.
            </p>
          </Panel>

          <Panel variant="subtle" padding="lg">
            <h4 className="tm-headline font-semibold mb-2">Subtle Panel</h4>
            <p className="tm-body-medium">
              This panel has a more subtle background while still maintaining
              brand compliance and accessibility standards.
            </p>
          </Panel>
        </div>
      </section>

      {/* Padding Examples */}
      <section>
        <h3 className="tm-h3 mb-4">Padding Variants</h3>
        <div className="space-y-4">
          <Card variant="default" padding="sm">
            <p className="tm-body-medium">Small padding (8px)</p>
          </Card>

          <Card variant="default" padding="md">
            <p className="tm-body-medium">Medium padding (16px) - Default</p>
          </Card>

          <Card variant="default" padding="lg">
            <p className="tm-body-medium">Large padding (24px)</p>
          </Card>
        </div>
      </section>
    </div>
  )
}
