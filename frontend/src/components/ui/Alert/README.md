# Alert Component

A brand-compliant alert component that uses official Toastmasters colors for displaying important messages and notifications.

## Features

- **Brand Compliance**: Uses official TM colors with proper opacity variations
- **Accessibility**: Meets WCAG AA contrast requirements and includes proper ARIA attributes
- **Dismissible**: Optional close functionality with proper touch targets
- **Flexible**: Multiple variants, sizes, and content options

## Usage

```tsx
import { Alert } from './Alert'

// Basic usage
<Alert variant="success" title="Success">
  Your action was completed successfully.
</Alert>

<Alert variant="warning" title="Warning">
  Please review your input before proceeding.
</Alert>

<Alert variant="error" title="Error">
  An error occurred while processing your request.
</Alert>

<Alert variant="info" title="Information">
  Here's some helpful information.
</Alert>

<Alert variant="highlight" title="Featured">
  This is a highlighted announcement.
</Alert>

// Dismissible alert
<Alert
  variant="warning"
  title="Dismissible Alert"
  onClose={() => console.log('Alert dismissed')}
>
  This alert can be dismissed.
</Alert>

// Different sizes
<Alert variant="info" size="sm" title="Small">Compact alert</Alert>
<Alert variant="info" size="md" title="Medium">Standard alert</Alert>
<Alert variant="info" size="lg" title="Large">Spacious alert</Alert>

// Without title
<Alert variant="success">
  Simple message without a title.
</Alert>
```

## Props

| Prop        | Type                                                         | Default  | Description                                      |
| ----------- | ------------------------------------------------------------ | -------- | ------------------------------------------------ |
| `variant`   | `'success' \| 'warning' \| 'error' \| 'info' \| 'highlight'` | `'info'` | Alert variant                                    |
| `size`      | `'sm' \| 'md' \| 'lg'`                                       | `'md'`   | Size of the alert                                |
| `title`     | `string`                                                     | -        | Optional title for the alert                     |
| `children`  | `React.ReactNode`                                            | -        | Alert content                                    |
| `className` | `string`                                                     | -        | Additional CSS classes                           |
| `onClose`   | `() => void`                                                 | -        | Optional close handler (makes alert dismissible) |

## Brand Color Usage

- **Success**: TM Loyal Blue (#004165) border with 10% opacity background
- **Warning/Error**: TM True Maroon (#772432) border with 10% opacity background
- **Info**: TM Cool Gray (#A9B2B1) border with 20% opacity background
- **Highlight**: TM Happy Yellow (#F2DF74) border with 20% opacity background

All variants use black text for optimal contrast on light backgrounds.

## Accessibility

- Uses `role="alert"` and `aria-live="polite"` for screen reader announcements
- All variants meet WCAG AA contrast requirements (4.5:1+ ratio)
- Close button meets 44px minimum touch target requirement
- Proper focus indicators for keyboard navigation
- Semantic heading structure when title is provided

## Icons

Each variant includes a contextual icon:

- **Success**: ✓ (checkmark)
- **Warning**: ⚠ (warning triangle)
- **Error**: ✕ (X mark)
- **Info**: ℹ (information)
- **Highlight**: ★ (star)

## Requirements Validation

This component validates the following requirements:

- **1.2**: Uses TM True Maroon for alerts and secondary emphasis
- **1.4**: Uses TM Happy Yellow for highlights and accents
- **4.5**: Implements consistent status indicator patterns across the application
- **3.1**: Ensures proper contrast validation for all status indicator combinations
