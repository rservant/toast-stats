# StatusIndicator Component

A brand-compliant status indicator component that uses official Toastmasters colors for displaying status information.

## Features

- **Brand Compliance**: Uses official TM colors (TM True Maroon, TM Happy Yellow, TM Loyal Blue, TM Cool Gray)
- **Accessibility**: Meets WCAG AA contrast requirements and touch target minimums
- **Responsive**: Works across all device sizes
- **Flexible**: Multiple variants and sizes available

## Usage

```tsx
import { StatusIndicator } from './StatusIndicator'

// Basic usage
<StatusIndicator variant="success">5</StatusIndicator>
<StatusIndicator variant="warning">!</StatusIndicator>
<StatusIndicator variant="error">×</StatusIndicator>
<StatusIndicator variant="info">i</StatusIndicator>
<StatusIndicator variant="highlight">★</StatusIndicator>

// Different sizes
<StatusIndicator variant="highlight" size="sm">Small</StatusIndicator>
<StatusIndicator variant="highlight" size="md">Medium</StatusIndicator>
<StatusIndicator variant="highlight" size="lg">Large</StatusIndicator>
```

## Props

| Prop        | Type                                                         | Default  | Description                             |
| ----------- | ------------------------------------------------------------ | -------- | --------------------------------------- |
| `variant`   | `'success' \| 'warning' \| 'error' \| 'info' \| 'highlight'` | `'info'` | Status indicator variant                |
| `size`      | `'sm' \| 'md' \| 'lg'`                                       | `'md'`   | Size of the indicator                   |
| `children`  | `React.ReactNode`                                            | -        | Content to display inside the indicator |
| `className` | `string`                                                     | -        | Additional CSS classes                  |

## Brand Color Usage

- **Success**: TM Loyal Blue (#004165) background with white text
- **Warning/Error**: TM True Maroon (#772432) background with white text
- **Info**: TM Cool Gray (#A9B2B1) background with black text
- **Highlight**: TM Happy Yellow (#F2DF74) background with black text

## Accessibility

- All variants meet WCAG AA contrast requirements (4.5:1+ ratio)
- Large size meets 44px minimum touch target requirement
- Semantic markup with appropriate ARIA attributes
- Focus indicators for keyboard navigation

## Requirements Validation

This component validates the following requirements:

- **1.2**: Uses TM True Maroon for alerts and secondary emphasis
- **1.4**: Uses TM Happy Yellow for highlights and accents
- **4.5**: Implements consistent status indicator patterns
- **3.1**: Ensures proper contrast validation for all combinations
