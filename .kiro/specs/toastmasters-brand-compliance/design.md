# Design Document

## Overview

This design document outlines the implementation approach for updating the application's visual design to comply with Toastmasters International brand guidelines. The design focuses on creating a comprehensive design system using CSS custom properties, implementing brand-compliant components, and ensuring accessibility standards are met throughout the application.

## Architecture

### Design System Architecture

The brand compliance implementation follows a layered architecture:

1. **Design Tokens Layer**: CSS custom properties defining brand colors, typography, and spacing
2. **Component Library Layer**: Reusable UI components following brand guidelines
3. **Theme Provider Layer**: Global styling and brand application
4. **Validation Layer**: Automated checks for brand compliance and accessibility

### Technology Stack

- **CSS Custom Properties**: For design token management and theming
- **Tailwind CSS**: Extended with custom brand utilities
- **Google Fonts**: Montserrat and Source Sans 3 for typography
- **PostCSS**: For CSS processing and optimization
- **Accessibility Tools**: For WCAG AA compliance validation
- **React**: Component-based UI framework
- **TypeScript**: Type safety and development tooling
- **Vitest**: Testing framework for property-based and unit tests

### File Structure

```
src/
├── styles/
│   ├── tokens/
│   │   ├── colors.css
│   │   ├── typography.css
│   │   ├── spacing.css
│   │   └── gradients.css
│   ├── components/
│   │   ├── buttons.css
│   │   ├── forms.css
│   │   ├── cards.css
│   │   └── navigation.css
│   └── brand.css (main import)
├── components/
│   ├── ui/
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── Navigation/
│   │   └── Form/
│   └── brand/
│       ├── ThemeProvider.tsx
│       ├── BrandValidator.tsx
│       └── AccessibilityChecker.tsx
├── hooks/
│   ├── useBrandValidation.ts
│   ├── useContrastCheck.ts
│   └── useTouchTarget.ts
└── utils/
    ├── colorUtils.ts
    ├── contrastCalculator.ts
    └── brandConstants.ts
```

## Components and Interfaces

### Design Token System

```typescript
interface BrandTokens {
  colors: {
    primary: {
      loyalBlue: string
      trueMaroon: string
      coolGray: string
    }
    accent: {
      happyYellow: string
    }
    neutral: {
      black: string
      white: string
    }
  }
  typography: {
    headline: {
      fontFamily: string
      weights: string[]
    }
    body: {
      fontFamily: string
      weights: string[]
    }
    sizing: {
      minBodySize: string
      minLineHeight: number
    }
  }
  spacing: {
    touchTarget: string
    clearSpace: Record<string, string>
  }
  gradients: {
    loyalBlue: string
    trueMaroon: string
    coolGray: string
  }
  breakpoints: {
    mobile: string
    tablet: string
    desktop: string
    wide: string
  }
  borderRadius: {
    sm: string
    md: string
    lg: string
  }
}
```

### Brand Component Interface

```typescript
interface BrandComponentProps {
  variant?: 'primary' | 'secondary' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children: React.ReactNode
}

interface AccessibilityProps {
  'aria-label'?: string
  'aria-describedby'?: string
  tabIndex?: number
}
```

### Theme Provider Interface

```typescript
interface ThemeProviderProps {
  children: React.ReactNode
  enableValidation?: boolean
  contrastMode?: 'normal' | 'high'
}

interface ThemeContext {
  tokens: BrandTokens
  validateContrast: (foreground: string, background: string) => boolean
  checkTouchTarget: (element: HTMLElement) => boolean
}
```

## Data Models

### Brand Constants

```typescript
export const BRAND_COLORS = {
  loyalBlue: '#004165',
  trueMaroon: '#772432',
  coolGray: '#A9B2B1',
  happyYellow: '#F2DF74',
  black: '#000000',
  white: '#FFFFFF',
} as const

export const BRAND_GRADIENTS = {
  loyalBlue: 'linear-gradient(135deg, #004165 0%, #006094 100%)',
  trueMaroon: 'linear-gradient(135deg, #3B0104 0%, #781327 100%)',
  coolGray: 'linear-gradient(135deg, #A9B2B1 0%, #F5F5F5 100%)',
} as const

export const TYPOGRAPHY_STACKS = {
  headline:
    '"Montserrat", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
  body: '"Source Sans 3", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
} as const

export const BREAKPOINTS = {
  mobile: '320px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1440px',
} as const
```

### Brand Color Model

```typescript
interface BrandColor {
  name: string
  hex: string
  usage: string[]
  contrastRatios: {
    onWhite: number
    onBlack: number
    onLoyalBlue?: number
  }
}

interface ColorPalette {
  primary: BrandColor[]
  accent: BrandColor[]
  neutral: BrandColor[]
}
```

### Typography Model

```typescript
interface TypographyScale {
  fontFamily: string
  fontSize: string
  fontWeight: string | number
  lineHeight: number
  letterSpacing?: string
  textTransform?: string
}

interface TypographySystem {
  headline: {
    h1: TypographyScale
    h2: TypographyScale
    h3: TypographyScale
    nav: TypographyScale
  }
  body: {
    large: TypographyScale
    medium: TypographyScale
    small: TypographyScale
    caption: TypographyScale
  }
}
```

### Component Variant Model

```typescript
interface ComponentVariant {
  name: string
  styles: {
    backgroundColor?: string
    color?: string
    border?: string
    padding?: string
    borderRadius?: string
    fontSize?: string
    fontWeight?: string
  }
  states: {
    hover?: Partial<ComponentVariant['styles']>
    focus?: Partial<ComponentVariant['styles']>
    active?: Partial<ComponentVariant['styles']>
    disabled?: Partial<ComponentVariant['styles']>
  }
}
```

### Responsive Design Model

```typescript
interface ResponsiveBreakpoint {
  name: string
  minWidth: string
  maxWidth?: string
  touchTargetSize: string
  minFontSize: string
}

interface ResponsiveConfig {
  breakpoints: ResponsiveBreakpoint[]
  fluidTypography: boolean
  adaptiveSpacing: boolean
}
```

### Validation Rule Model

```typescript
interface ValidationRule {
  id: string
  type: 'color' | 'typography' | 'accessibility' | 'gradient' | 'spacing'
  severity: 'error' | 'warning' | 'info'
  check: (element: HTMLElement) => boolean
  message: string
  autoFix?: (element: HTMLElement) => void
}

interface ValidationConfig {
  rules: ValidationRule[]
  enableAutoFix: boolean
  reportingLevel: 'error' | 'warning' | 'info'
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property Analysis

Based on the requirements analysis, the following properties ensure brand compliance and accessibility:

**Property 1: Brand Color Consistency**
_For any_ UI component using brand colors, the color values should match exactly with the official Toastmasters palette specifications
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

**Property 2: Typography System Compliance**
_For any_ text element in the application, it should use only approved font families (Montserrat for headlines, Source Sans 3 for body) with minimum 14px size for body text
**Validates: Requirements 2.1, 2.2, 2.3**

**Property 3: Accessibility Contrast Requirements**
_For any_ text and background color combination, the contrast ratio should meet or exceed WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
**Validates: Requirements 3.1**

**Property 4: Touch Target Accessibility**
_For any_ interactive element (button, link, input), the minimum touch target size should be 44px in both width and height
**Validates: Requirements 3.2**

**Property 5: Gradient Usage Constraints**
_For any_ screen or view in the application, there should be at most one brand gradient applied
**Validates: Requirements 5.1**

**Property 6: Component Design Consistency**
_For any_ UI component, it should follow the established design patterns for its type (primary buttons use TM Loyal Blue, cards use TM Cool Gray backgrounds, etc.)
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

**Property 7: Responsive Design Compliance**
_For any_ viewport size, the brand guidelines should be maintained including minimum font sizes, touch targets, and color usage
**Validates: Requirements 6.1, 6.2, 6.3, 6.5**

**Property 8: Typography Effects Prohibition**
_For any_ text element, it should not use prohibited effects such as drop-shadow, word-art, distort, outline, or glow
**Validates: Requirements 2.5**

**Property 9: Page-Level Brand Compliance**
_For any_ page in the application, all visual elements should use only official brand colors and typography, with no non-brand colors (purple, violet, custom blues) present
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

## Implementation Details

### CSS Custom Properties Setup

The design token system will be implemented using CSS custom properties organized by category:

```css
:root {
  /* Brand Colors */
  --tm-loyal-blue: #004165;
  --tm-true-maroon: #772432;
  --tm-cool-gray: #a9b2b1;
  --tm-happy-yellow: #f2df74;
  --tm-black: #000000;
  --tm-white: #ffffff;

  /* Typography */
  --tm-font-headline:
    'Montserrat', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
  --tm-font-body:
    'Source Sans 3', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
  --tm-font-size-min: 14px;
  --tm-line-height-min: 1.4;

  /* Spacing */
  --tm-touch-target: 44px;
  --tm-space-xs: 4px;
  --tm-space-sm: 8px;
  --tm-space-md: 16px;
  --tm-space-lg: 24px;
  --tm-space-xl: 32px;

  /* Border Radius */
  --tm-radius-sm: 4px;
  --tm-radius-md: 8px;
  --tm-radius-lg: 12px;

  /* Gradients */
  --tm-gradient-loyal-blue: linear-gradient(135deg, #004165 0%, #006094 100%);
  --tm-gradient-true-maroon: linear-gradient(135deg, #3b0104 0%, #781327 100%);
  --tm-gradient-cool-gray: linear-gradient(135deg, #a9b2b1 0%, #f5f5f5 100%);

  /* Breakpoints */
  --tm-breakpoint-mobile: 320px;
  --tm-breakpoint-tablet: 768px;
  --tm-breakpoint-desktop: 1024px;
  --tm-breakpoint-wide: 1440px;
}
```

### Component Implementation Patterns

#### Button Component Example

```typescript
interface ButtonProps extends BrandComponentProps {
  variant?: 'primary' | 'secondary' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  const baseClasses = 'tm-button tm-font-headline font-semibold rounded-md transition-colors'
  const variantClasses = {
    primary: 'bg-tm-loyal-blue text-tm-white hover:bg-opacity-90',
    secondary: 'border-2 border-tm-loyal-blue text-tm-loyal-blue hover:bg-tm-loyal-blue hover:text-tm-white',
    accent: 'bg-tm-happy-yellow text-tm-black hover:bg-opacity-90'
  }
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[44px]',
    md: 'px-4 py-3 text-base min-h-[44px]',
    lg: 'px-6 py-4 text-lg min-h-[44px]'
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
```

### Tailwind CSS Configuration

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'tm-loyal-blue': 'var(--tm-loyal-blue)',
        'tm-true-maroon': 'var(--tm-true-maroon)',
        'tm-cool-gray': 'var(--tm-cool-gray)',
        'tm-happy-yellow': 'var(--tm-happy-yellow)',
        'tm-black': 'var(--tm-black)',
        'tm-white': 'var(--tm-white)',
      },
      fontFamily: {
        'tm-headline': 'var(--tm-font-headline)',
        'tm-body': 'var(--tm-font-body)',
      },
      spacing: {
        'tm-touch': 'var(--tm-touch-target)',
      },
      backgroundImage: {
        'tm-gradient-loyal-blue': 'var(--tm-gradient-loyal-blue)',
        'tm-gradient-true-maroon': 'var(--tm-gradient-true-maroon)',
        'tm-gradient-cool-gray': 'var(--tm-gradient-cool-gray)',
      },
    },
  },
}
```

## Migration Strategy

### Phase 1: Foundation Setup (Tasks 1-2)

- Establish design token system
- Configure build tools and font loading
- Create base typography classes

### Phase 2: Core Components (Tasks 3-7)

- Update navigation and headers
- Implement accessibility features
- Update forms and basic UI components

### Phase 3: Advanced Features (Tasks 8-11)

- Implement gradient system with validation
- Add responsive design compliance
- Update all existing components

### Phase 4: Validation & Testing (Tasks 12-14)

- Implement comprehensive validation
- Add automated testing
- Performance optimization

### Backward Compatibility Strategy

During migration, the system will:

1. **Maintain existing CSS classes** while adding new brand-compliant ones
2. **Provide fallback mechanisms** for components not yet updated
3. **Use progressive enhancement** to apply brand styles without breaking functionality
4. **Implement feature flags** to enable/disable brand compliance per component

## Performance Considerations

### Font Loading Strategy

- **Preload critical fonts**: Montserrat and Source Sans 3 weights
- **Font display: swap**: Ensure text remains visible during font load
- **Subset fonts**: Load only required character sets and weights
- **Local font fallbacks**: Comprehensive fallback stack for offline scenarios

### CSS Optimization

- **Critical CSS inlining**: Brand tokens and base styles
- **CSS purging**: Remove unused Tailwind classes in production
- **CSS compression**: Minimize file sizes
- **CSS custom properties**: Reduce bundle size through reusable tokens

### Runtime Performance

- **Lazy validation**: Only validate components when in development mode
- **Memoized calculations**: Cache contrast ratio and accessibility checks
- **Efficient selectors**: Use class-based selectors over complex CSS
- **Minimal DOM queries**: Batch accessibility checks

## Error Handling

### Brand Compliance Validation

The system will implement validation at multiple levels:

1. **Development Time**: ESLint rules and TypeScript types to catch brand violations
2. **Build Time**: PostCSS plugins to validate color usage and accessibility
3. **Runtime**: React hooks to validate component props and accessibility

### Specific Validation Rules

#### Color Validation Rules

- **Rule CV001**: Only brand palette colors allowed (`#004165`, `#772432`, `#A9B2B1`, `#F2DF74`, `#000000`, `#FFFFFF`)
- **Rule CV002**: Contrast ratios must meet WCAG AA (4.5:1 normal text, 3:1 large text)
- **Rule CV003**: Maximum one gradient per screen/view
- **Rule CV004**: Gradient text overlays must pass contrast validation

#### Typography Validation Rules

- **Rule TV001**: Headlines must use Montserrat font family
- **Rule TV002**: Body text must use Source Sans 3 font family
- **Rule TV003**: Minimum 14px font size for body text
- **Rule TV004**: Minimum 1.4 line-height ratio
- **Rule TV005**: No prohibited text effects (drop-shadow, word-art, distort, outline, glow)

#### Accessibility Validation Rules

- **Rule AV001**: Interactive elements minimum 44px touch targets
- **Rule AV002**: Proper heading hierarchy (h1 → h2 → h3)
- **Rule AV003**: Focus indicators must be visible and high contrast
- **Rule AV004**: Semantic markup required for all interactive elements

#### Component Validation Rules

- **Rule CPV001**: Primary buttons must use TM Loyal Blue background
- **Rule CPV002**: Cards must use TM Cool Gray backgrounds
- **Rule CPV003**: Navigation must use TM Loyal Blue with white text
- **Rule CPV004**: Status indicators must use appropriate brand colors

### Error Recovery Strategies

- **Color Fallbacks**: If a custom color is detected, fall back to nearest brand color
- **Font Fallbacks**: Comprehensive font stack ensures text renders even if preferred fonts fail
- **Contrast Adjustment**: Automatic contrast adjustment when ratios fall below WCAG standards
- **Touch Target Expansion**: Automatic padding adjustment for elements below 44px

### Validation Error Types

```typescript
interface ValidationError {
  type: 'color' | 'typography' | 'accessibility' | 'gradient' | 'component'
  severity: 'error' | 'warning' | 'info'
  message: string
  element?: HTMLElement
  suggestion?: string
}
```

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit tests for specific component behavior with property-based tests for universal brand compliance:

**Unit Tests**:

- Component rendering with correct brand styles
- Color contrast calculations
- Font loading and fallback behavior
- Touch target size validation
- Gradient application limits

**Property-Based Tests**:

- Brand color consistency across all components (minimum 100 iterations)
- Typography compliance for randomly generated text content
- Accessibility compliance for various color combinations
- Responsive behavior across different viewport sizes
- Component design pattern adherence

### Testing Configuration

All property-based tests will run with minimum 100 iterations to ensure comprehensive coverage of:

- Different component combinations
- Various content lengths and types
- Multiple viewport sizes and orientations
- Different user interaction patterns

Each test will be tagged with: **Feature: toastmasters-brand-compliance, Property {number}: {property_text}**

### Accessibility Testing

- **Automated**: axe-core integration for WCAG compliance
- **Manual**: Keyboard navigation and screen reader testing
- **Visual**: High contrast mode and color blindness simulation
- **Performance**: Font loading and rendering performance

### Brand Compliance Testing

- **Color Validation**: Automated checking against brand palette
- **Typography Validation**: Font family and size compliance
- **Component Validation**: Design pattern adherence
- **Gradient Validation**: Usage limit enforcement

The testing approach ensures both functional correctness and brand compliance while maintaining high code quality and accessibility standards.

## Monitoring and Maintenance

### Brand Compliance Metrics

The system will track key metrics to ensure ongoing compliance:

#### Automated Metrics

- **Color Compliance Rate**: Percentage of components using only brand colors
- **Typography Compliance Rate**: Percentage of text elements using correct fonts
- **Accessibility Score**: WCAG AA compliance percentage across all components
- **Touch Target Compliance**: Percentage of interactive elements meeting 44px minimum
- **Gradient Usage Violations**: Count of screens with multiple gradients

#### Performance Metrics

- **Font Loading Time**: Time to load Montserrat and Source Sans 3
- **CSS Bundle Size**: Total size of brand-related CSS
- **Runtime Validation Overhead**: Performance impact of validation checks
- **Build Time Impact**: Additional time for brand compliance checks

### Maintenance Strategy

#### Regular Audits

- **Weekly**: Automated brand compliance reports
- **Monthly**: Manual accessibility testing with screen readers
- **Quarterly**: Full brand guideline review and updates
- **Annually**: Performance optimization and font loading review

#### Update Process

- **Brand Guideline Changes**: Process for incorporating new brand requirements
- **Component Updates**: Systematic approach to updating existing components
- **Validation Rule Updates**: Adding new validation rules as requirements evolve
- **Performance Optimization**: Regular review and optimization of brand implementation

#### Documentation Maintenance

- **Component Library**: Keep brand component examples up to date
- **Design Token Documentation**: Maintain accurate token usage guidelines
- **Accessibility Guidelines**: Update accessibility best practices
- **Migration Guides**: Provide clear guidance for updating legacy components

This comprehensive design ensures the Toastmasters brand compliance implementation is robust, maintainable, and provides excellent user experience while meeting all brand and accessibility requirements.
