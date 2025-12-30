# Card and Panel Components

Brand-compliant card and panel components following Toastmasters International design guidelines.

## Components

### Card

A versatile container component with brand-compliant styling.

#### Props

- `children`: ReactNode - Content to display inside the card
- `className?`: string - Additional CSS classes
- `variant?`: 'default' | 'elevated' | 'outlined' - Visual style variant
- `padding?`: 'sm' | 'md' | 'lg' - Internal padding size
- `onClick?`: () => void - Click handler (makes card interactive)
- `aria-label?`: string - Accessibility label
- `aria-describedby?`: string - Accessibility description reference
- `tabIndex?`: number - Tab order (auto-set for interactive cards)

#### Usage

```tsx
import { Card } from '@/components/ui/Card'

// Basic card
<Card>
  <h3>Card Title</h3>
  <p>Card content goes here.</p>
</Card>

// Interactive card with click handler
<Card onClick={() => console.log('clicked')} aria-label="Clickable card">
  <h3>Interactive Card</h3>
  <p>This card can be clicked.</p>
</Card>

// Elevated card with large padding
<Card variant="elevated" padding="lg">
  <h3>Elevated Card</h3>
  <p>This card has more visual prominence.</p>
</Card>
```

### Panel

A background panel component using TM Cool Gray for secondary content areas.

#### Props

- `children`: ReactNode - Content to display inside the panel
- `className?`: string - Additional CSS classes
- `variant?`: 'default' | 'subtle' - Visual style variant
- `padding?`: 'sm' | 'md' | 'lg' - Internal padding size
- `aria-label?`: string - Accessibility label
- `aria-describedby?`: string - Accessibility description reference

#### Usage

```tsx
import { Panel } from '@/components/ui/Card'

// Basic panel
<Panel>
  <h4>Panel Title</h4>
  <p>Panel content with TM Cool Gray background.</p>
</Panel>

// Subtle panel variant
<Panel variant="subtle" padding="lg">
  <h4>Subtle Panel</h4>
  <p>Less prominent background panel.</p>
</Panel>
```

## Brand Compliance

### Colors

- **Card backgrounds**: TM White (#FFFFFF)
- **Panel backgrounds**: TM Cool Gray (#A9B2B1) or subtle variant
- **Text color**: TM Black (#000000) for optimal contrast
- **Borders**: TM Cool Gray variations for subtle definition

### Typography

- Uses TM Body font family (Source Sans 3) for content
- Headlines within cards use TM Headline font family (Montserrat)
- Minimum 14px font size maintained
- Minimum 1.4 line-height ratio

### Accessibility

- **Contrast ratios**: All text meets WCAG AA standards (4.5:1 minimum)
  - TM Black on TM White: 21:1 ratio
  - TM Black on TM Cool Gray: 6.2:1 ratio
- **Touch targets**: Interactive cards meet 44px minimum size
- **Focus indicators**: Clear visual feedback for keyboard navigation
- **Semantic markup**: Proper ARIA labels and roles

### Spacing

- Uses design token spacing system
- `--tm-space-md` (16px) for default padding
- `--tm-space-lg` (24px) for generous padding
- `--tm-radius-md` (8px) for card border radius
- `--tm-radius-sm` (4px) for panel border radius

## CSS Classes

### Card Classes

- `.tm-card` - Base card styles
- `.tm-card-default` - Default card variant
- `.tm-card-elevated` - Elevated card with enhanced shadow
- `.tm-card-outlined` - Card with prominent border
- `.tm-card-interactive` - Interactive card with hover/focus states
- `.tm-card-padding-{sm|md|lg}` - Padding variants

### Panel Classes

- `.tm-panel` - Base panel styles
- `.tm-panel-default` - Default panel with TM Cool Gray background
- `.tm-panel-subtle` - Subtle panel with lighter background
- `.tm-panel-padding-{sm|md|lg}` - Padding variants

### Utility Classes

- `.tm-card-header` - Card header with bottom border
- `.tm-card-content` - Card content area
- `.tm-card-footer` - Card footer with top border

## Examples

### Information Card

```tsx
<Card variant="default" padding="md">
  <div className="tm-card-header">
    <h3>District Performance</h3>
  </div>
  <div className="tm-card-content">
    <p>Current membership: 1,234 members</p>
    <p>Growth rate: +5.2% this quarter</p>
  </div>
</Card>
```

### Status Panel

```tsx
<Panel variant="default" padding="sm">
  <h4>System Status</h4>
  <p>All systems operational</p>
</Panel>
```

### Interactive Dashboard Card

```tsx
<Card
  variant="elevated"
  padding="lg"
  onClick={() => navigateToDetails()}
  aria-label="View detailed analytics"
>
  <div className="tm-card-header">
    <h3>Analytics Overview</h3>
  </div>
  <div className="tm-card-content">
    <p>Click to view detailed analytics</p>
  </div>
</Card>
```
