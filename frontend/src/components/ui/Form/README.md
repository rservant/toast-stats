# Toastmasters Brand-Compliant Form Components

This directory contains a comprehensive set of form components that comply with Toastmasters International brand guidelines.

## Overview

All form components follow the brand requirements:

- **Typography**: Source Sans 3 for form labels and helper text (Requirement 2.2)
- **Colors**: TM Cool Gray (#A9B2B1) for form backgrounds and secondary elements (Requirement 1.3)
- **Contrast**: Minimum 4.5:1 contrast ratios for all text (Requirement 3.1)
- **Spacing**: Consistent spacing and border radius using design tokens (Requirement 4.2)
- **Focus States**: TM Loyal Blue indicators for accessibility (Requirement 3.1)
- **Touch Targets**: Minimum 44px for all interactive elements (Requirement 3.2)

## Components

### FormField

Container component for form elements that provides consistent spacing and layout.

```tsx
<FormField error={hasError} required>
  <FormLabel>Field Label</FormLabel>
  <FormInput />
  <FormHelperText>Helper text</FormHelperText>
</FormField>
```

### FormLabel

Brand-compliant label component with required field indicators.

```tsx
<FormLabel htmlFor="input-id" required>
  Field Label
</FormLabel>
```

### FormInput

Text input component with brand styling and proper focus states.

```tsx
<FormInput
  id="input-id"
  type="text"
  placeholder="Enter text"
  error={hasError}
  size="md" // sm, md, lg
/>
```

### FormTextarea

Multi-line text input with brand styling.

```tsx
<FormTextarea
  placeholder="Enter message"
  rows={4}
  resize="vertical" // none, vertical, horizontal, both
/>
```

### FormSelect

Dropdown select component with custom styling.

```tsx
<FormSelect placeholder="Choose option">
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</FormSelect>
```

### FormCheckbox

Checkbox component with TM Loyal Blue checked states.

```tsx
<FormCheckbox
  label="Accept terms and conditions"
  checked={isChecked}
  onChange={handleChange}
/>
```

### FormRadio

Radio button component with brand styling.

```tsx
<FormRadio
  name="role"
  value="member"
  label="Club Member"
  checked={selectedRole === 'member'}
  onChange={handleChange}
/>
```

### FormHelperText

Helper text component with support for default and error variants.

```tsx
<FormHelperText variant="default">
  This field is optional
</FormHelperText>

<FormHelperText variant="error">
  This field has an error
</FormHelperText>
```

### FormErrorMessage

Error message component with proper accessibility attributes.

```tsx
<FormErrorMessage>Please enter a valid email address</FormErrorMessage>
```

## Complete Example

```tsx
import React, { useState } from 'react'
import {
  FormField,
  FormLabel,
  FormInput,
  FormSelect,
  FormCheckbox,
  FormHelperText,
  FormErrorMessage,
} from './components/ui/Form'

export const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    district: '',
    newsletter: false,
  })
  const [errors, setErrors] = useState({})

  return (
    <form className="space-y-6">
      <FormField error={!!errors.name} required>
        <FormLabel htmlFor="name" required>
          Full Name
        </FormLabel>
        <FormInput
          id="name"
          type="text"
          value={formData.name}
          onChange={e =>
            setFormData(prev => ({ ...prev, name: e.target.value }))
          }
          error={!!errors.name}
          placeholder="Enter your full name"
        />
        {errors.name && <FormErrorMessage>{errors.name}</FormErrorMessage>}
        <FormHelperText>Please enter your first and last name.</FormHelperText>
      </FormField>

      <FormField error={!!errors.district} required>
        <FormLabel htmlFor="district" required>
          District
        </FormLabel>
        <FormSelect
          id="district"
          value={formData.district}
          onChange={e =>
            setFormData(prev => ({ ...prev, district: e.target.value }))
          }
          error={!!errors.district}
          placeholder="Select your district"
        >
          <option value="D1">District 1</option>
          <option value="D2">District 2</option>
        </FormSelect>
        {errors.district && (
          <FormErrorMessage>{errors.district}</FormErrorMessage>
        )}
      </FormField>

      <FormField>
        <FormCheckbox
          checked={formData.newsletter}
          onChange={e =>
            setFormData(prev => ({ ...prev, newsletter: e.target.checked }))
          }
          label="Subscribe to newsletter"
        />
      </FormField>
    </form>
  )
}
```

## Accessibility Features

All form components include:

- Proper ARIA attributes and roles
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus indicators with proper contrast ratios
- Semantic HTML structure

## Brand Compliance

The components automatically enforce:

- Official Toastmasters color palette usage
- Proper typography hierarchy
- Consistent spacing and sizing
- Touch target requirements for mobile
- Error state styling with TM True Maroon
- Focus states with TM Loyal Blue

## Responsive Design

All components are responsive and:

- Maintain minimum touch targets on mobile (44px)
- Preserve minimum font sizes (14px)
- Adapt spacing for different screen sizes
- Support both portrait and landscape orientations

## Testing

Components include comprehensive tests covering:

- Rendering and basic functionality
- Error state handling
- Accessibility compliance
- User interaction handling
- Brand compliance validation

Run tests with:

```bash
npm test src/components/ui/Form/__tests__/
```
