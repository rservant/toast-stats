---
inclusion: always
---

# Toastmasters International Brand Guidelines

**Status:** Authoritative  
**Applies to:** All frontend components, styling, and visual design  
**Audience:** Frontend Engineers, UI/UX Designers  
**Owner:** Brand Compliance Team

---

## 1. Purpose

This document defines **Toastmasters International brand compliance standards** for all digital applications.

Its goal is to:

- Ensure consistent brand representation across all digital touchpoints
- Maintain visual integrity according to official brand guidelines
- Provide clear implementation guidance for developers
- Establish compliance validation criteria

This document is **normative**.  
Where it uses **MUST**, **MUST NOT**, **SHOULD**, and **MAY**, those words are intentional.

Kiro should treat this document as the **primary source of truth** for brand compliance decisions.

---

## 2. Brand Color Palette

All applications MUST use the official Toastmasters color palette:

### Primary Colors

- **TM Loyal Blue**: `#004165`
  - Usage: Navigation, headers, primary buttons, primary actions
  - CSS Variable: `--tm-loyal-blue`

- **TM True Maroon**: `#772432`
  - Usage: Emphasis, secondary sections, non-error alerts
  - CSS Variable: `--tm-true-maroon`

- **TM Cool Gray**: `#A9B2B1`
  - Usage: Background panels, cards, secondary backgrounds
  - CSS Variable: `--tm-cool-gray`

### Accent Colors

- **TM Happy Yellow**: `#F2DF74`
  - Usage: Highlights, accents, icon accents, callouts
  - CSS Variable: `--tm-happy-yellow`

### Neutrals

- **TM Black**: `#000000`
  - Usage: Primary text, icons
  - CSS Variable: `--tm-black`

- **TM White**: `#FFFFFF`
  - Usage: Backgrounds, text on dark backgrounds
  - CSS Variable: `--tm-white`

### Color Usage Rules

- **MUST** use only colors from the official palette
- **MUST NOT** create custom color variations
- **SHOULD** use CSS custom properties for consistent color management
- **MAY** use opacity variations in 10% increments (90%, 80%, 70%, etc.)

---

## 3. Typography System

### Headline Typography

- **Primary Font**: Montserrat (Medium, Bold, Black weights)
- **Fallback Stack**: `"Montserrat", system-ui, -apple-system, "Segoe UI", Arial, sans-serif`
- **Usage**: h1, h2, h3, navigation labels
- **CSS Class**: `.tm-headline`
- **Note**: Gotham is the brand preference but requires licensing; Montserrat provides similar characteristics

### Body Typography

- **Primary Font**: Source Sans 3 (Regular, Semibold, Bold weights)
- **Fallback Stack**: `"Source Sans 3", system-ui, -apple-system, "Segoe UI", Arial, sans-serif`
- **Usage**: Paragraphs, form labels, helper text, table text
- **CSS Class**: `.tm-body`
- **Note**: Myriad Pro is the brand preference but requires licensing; Source Sans 3 provides similar readability

### Typography Rules

- **MUST** use minimum 14px font size for body text
- **MUST** use minimum 1.4 line-height ratio
- **MUST NOT** use text effects (drop-shadow, word-art, distort, outline, glow)
- **SHOULD** avoid all-caps for long text passages
- **MAY** use font-weight variations within allowed weights

---

## 4. Brand Gradients

### TM Loyal Blue Gradient

```css
background: linear-gradient(135deg, #004165 0%, #006094 100%);
```

- **Constraint**: Maximum 1 gradient per screen
- **Usage**: Hero sections, primary call-to-action backgrounds
- **Text Overlay**: Requires contrast validation

### TM True Maroon Gradient

```css
background: linear-gradient(135deg, #3b0104 0%, #781327 100%);
```

- **Constraint**: Maximum 1 gradient per screen
- **Usage**: Secondary emphasis areas, alert backgrounds
- **Text Overlay**: Requires contrast validation

### TM Cool Gray Gradient

```css
background: linear-gradient(135deg, #a9b2b1 0%, #f5f5f5 100%);
```

- **Constraint**: Maximum 1 gradient per screen
- **Opacity Steps**: 20% increments only
- **Usage**: Subtle backgrounds, card overlays

### Gradient Rules

- **MUST** limit to one brand gradient per screen/view
- **MUST** validate text contrast when overlaying content
- **MUST NOT** create custom gradient combinations
- **SHOULD** prefer solid colors over gradients for better accessibility

---

## 5. Accessibility Requirements

### WCAG AA Compliance

- **MUST** achieve minimum 4.5:1 contrast ratio for normal text
- **MUST** achieve minimum 3:1 contrast ratio for large text (18pt+ or 14pt+ bold)
- **MUST** provide 44px minimum touch targets for interactive elements
- **MUST** ensure keyboard navigation with visible focus indicators

### Implementation Guidelines

```css
/* Minimum contrast examples */
.tm-text-on-light {
  color: var(--tm-black);
} /* 21:1 ratio */
.tm-text-on-dark {
  color: var(--tm-white);
} /* 21:1 ratio */
.tm-text-on-loyal-blue {
  color: var(--tm-white);
} /* 9.8:1 ratio */
.tm-text-on-true-maroon {
  color: var(--tm-white);
} /* 8.2:1 ratio */

/* Touch target minimum */
.tm-interactive {
  min-height: 44px;
  min-width: 44px;
}
```

---

## 6. Component Design Patterns

### Buttons

```css
/* Primary Button */
.tm-btn-primary {
  background-color: var(--tm-loyal-blue);
  color: var(--tm-white);
  font-family: var(--tm-headline-font);
  font-weight: 600;
  min-height: 44px;
  padding: 12px 24px;
}

/* Secondary Button */
.tm-btn-secondary {
  background-color: transparent;
  color: var(--tm-loyal-blue);
  border: 2px solid var(--tm-loyal-blue);
  font-family: var(--tm-headline-font);
  font-weight: 600;
  min-height: 44px;
  padding: 10px 22px; /* Adjusted for border */
}
```

### Cards and Panels

```css
.tm-card {
  background-color: var(--tm-white);
  border: 1px solid var(--tm-cool-gray);
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tm-panel {
  background-color: var(--tm-cool-gray);
  padding: 16px;
  border-radius: 4px;
}
```

### Navigation

```css
.tm-nav {
  background-color: var(--tm-loyal-blue);
  color: var(--tm-white);
}

.tm-nav-item {
  font-family: var(--tm-headline-font);
  font-weight: 600;
  color: var(--tm-white);
  min-height: 44px;
  padding: 12px 16px;
}

.tm-nav-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
```

---

## 7. CSS Custom Properties Setup

### Required CSS Variables

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
  --tm-headline-font:
    'Montserrat', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
  --tm-body-font:
    'Source Sans 3', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;

  /* Spacing */
  --tm-space-xs: 4px;
  --tm-space-sm: 8px;
  --tm-space-md: 16px;
  --tm-space-lg: 24px;
  --tm-space-xl: 32px;

  /* Touch Targets */
  --tm-touch-target: 44px;

  /* Border Radius */
  --tm-radius-sm: 4px;
  --tm-radius-md: 8px;
  --tm-radius-lg: 12px;
}
```

---

## 8. Implementation Checklist

### Before Implementation

- [ ] Set up CSS custom properties for brand colors and typography
- [ ] Install contrast checking tools
- [ ] Review existing components for compliance gaps
- [ ] Ensure Montserrat and Source Sans 3 fonts are available (Google Fonts)

### During Implementation

- [ ] Use only brand palette colors
- [ ] Apply typography system consistently
- [ ] Validate contrast ratios for all text
- [ ] Ensure 44px minimum touch targets
- [ ] Test with screen readers and keyboard navigation

### After Implementation

- [ ] Run automated accessibility tests
- [ ] Validate brand compliance across all components
- [ ] Test responsive behavior on multiple devices
- [ ] Document any approved exceptions or variations

---

## 9. Validation and Testing

### Automated Checks

- **Color Usage**: Validate only brand palette colors are used
- **Contrast Ratios**: Automated WCAG AA compliance testing
- **Touch Targets**: Verify minimum 44px interactive elements
- **Typography**: Check font families and minimum sizes

### Manual Review

- **Gradient Usage**: Ensure maximum one per screen
- **Brand Consistency**: Overall visual coherence check
- **Accessibility**: Manual keyboard and screen reader testing

---

## 10. Common Violations to Avoid

❌ **Using custom colors outside brand palette**
✅ Use only official TM colors with CSS custom properties

❌ **Text smaller than 14px for body content**
✅ Maintain minimum 14px font size for readability

❌ **Interactive elements smaller than 44px**
✅ Ensure all buttons, links, and controls meet touch target requirements

❌ **Multiple gradients on same screen**
✅ Limit to one brand gradient per view for visual clarity

---

## 11. Final Rule

> **All visual elements must comply with Toastmasters International brand guidelines.**  
> **Brand compliance is not optional - it ensures consistent member experience.**  
> **When in doubt, choose accessibility and usability over visual complexity.**

**Enforcement**: Brand compliance will be validated in code reviews and automated testing.

**Resources**: Contact brand team for official assets and guidance on edge cases.

**Updates**: This document will be updated when new brand guidelines are released.
