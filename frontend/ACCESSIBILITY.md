# Accessibility Features

This document outlines the accessibility features implemented in the Toastmasters District Visualizer to ensure compliance with WCAG 2.1 Level AA standards.

## Overview

The application has been designed with accessibility as a core principle, ensuring that all users, including those using assistive technologies, can effectively navigate and use the application.

## Implemented Features

### 1. Keyboard Navigation

- **Focus Indicators**: All interactive elements have visible focus indicators with a 2px blue outline
- **Tab Order**: Logical tab order throughout the application
- **Keyboard Shortcuts**: All buttons and interactive elements are accessible via keyboard
- **Table Sorting**: Table headers can be sorted using Enter key when focused

### 2. Screen Reader Support

#### ARIA Labels and Roles
- All interactive elements have descriptive `aria-label` attributes
- Charts and graphs have `role="img"` with descriptive `aria-label`
- Loading states use `aria-busy="true"`
- Error messages use `role="alert"` with `aria-live="assertive"`
- Status updates use `role="status"` with `aria-live="polite"`

#### Semantic HTML
- Proper use of `<main>`, `<header>`, `<nav>`, `<section>`, and `<article>` elements
- Form inputs properly associated with labels using `htmlFor` and `id`
- Tables use proper `<thead>`, `<tbody>`, `<th scope="col">` structure

#### Skip Navigation
- Skip to main content link at the top of the page
- Hidden by default, visible on keyboard focus
- Allows users to bypass repetitive navigation

### 3. Visual Accessibility

#### Color Contrast
- All text meets WCAG 2.1 Level AA contrast ratio of 4.5:1
- Updated gray colors to ensure sufficient contrast:
  - `.text-gray-600`: #4b5563 (ensures 4.5:1 on white)
  - `.text-gray-700`: #374151 (better contrast)

#### Focus Indicators
- 2px solid blue outline on all focusable elements
- 2px offset for better visibility
- Enhanced to 3px in high contrast mode

#### Color Independence
- Information is not conveyed by color alone
- Trend indicators include both color and symbols (↑, ↓, →)
- Status badges include text labels in addition to colors

### 4. Charts and Visualizations

All charts include:
- Descriptive `aria-label` providing context about the data
- `role="img"` to identify them as images to screen readers
- Hidden decorative elements with `aria-hidden="true"`
- Screen reader-only descriptions using `.sr-only` class
- Interactive tooltips with detailed information

Example:
```tsx
<div 
  role="img" 
  aria-label="Line chart showing membership trends over 12 months. Starting with 1,234 members and ending with 1,456 members."
>
  <ResponsiveContainer>
    <LineChart aria-hidden="true">
      {/* Chart content */}
    </LineChart>
  </ResponsiveContainer>
</div>
```

### 5. Forms and Inputs

- All form inputs have associated labels
- Required fields marked with `aria-required="true"`
- Error messages linked to inputs via `aria-describedby`
- Validation errors announced with `role="alert"`
- Autocomplete attributes for username and password fields

### 6. Dynamic Content

- Loading states announced with `aria-busy="true"` and `aria-live="polite"`
- Error messages use `aria-live="assertive"` for immediate announcement
- Status updates use `aria-live="polite"` for non-urgent announcements
- Button states indicated with `aria-pressed` for toggle buttons

### 7. Tables

- Sortable columns include:
  - `aria-sort` attribute indicating current sort state
  - `role="button"` for clickable headers
  - Keyboard support with Enter key
  - Descriptive `aria-label` explaining sort state
- Proper table structure with `<thead>`, `<tbody>`, `<th scope="col">`
- Pagination controls with descriptive `aria-label` attributes

### 8. Responsive Design

- Viewport meta tag for proper mobile scaling
- Responsive breakpoints: 320px to 2560px
- Touch targets minimum 44x44 pixels on mobile
- Scrollable tables on small screens
- Flexible layouts that adapt to different screen sizes

### 9. Motion and Animation

- Respects `prefers-reduced-motion` media query
- Animations reduced to 0.01ms for users who prefer reduced motion
- Loading spinners still visible but not animated

### 10. High Contrast Mode

- Supports `prefers-contrast: high` media query
- Border colors set to `currentColor` in high contrast mode
- Focus indicators increased to 3px width

## CSS Classes

### Screen Reader Only Content
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### Skip Navigation Link
```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #2563eb;
  color: white;
  padding: 8px 16px;
  text-decoration: none;
  z-index: 100;
  border-radius: 0 0 4px 0;
}

.skip-link:focus {
  top: 0;
}
```

## Testing Recommendations

### Manual Testing
1. **Keyboard Navigation**: Tab through entire application without using mouse
2. **Screen Reader**: Test with NVDA (Windows), JAWS (Windows), or VoiceOver (Mac)
3. **Zoom**: Test at 200% zoom level
4. **Color Blindness**: Use browser extensions to simulate color blindness
5. **High Contrast**: Enable high contrast mode in OS settings

### Automated Testing
- Use axe DevTools browser extension
- Run Lighthouse accessibility audit
- Use WAVE browser extension
- Validate HTML with W3C validator

### Screen Reader Testing Checklist
- [ ] All images and charts have descriptive labels
- [ ] Form inputs are properly labeled
- [ ] Error messages are announced
- [ ] Loading states are announced
- [ ] Table headers are properly identified
- [ ] Skip navigation link works
- [ ] Button purposes are clear
- [ ] Dynamic content updates are announced

## Browser Support

Accessibility features are supported in:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Compliance

This application aims to meet:
- WCAG 2.1 Level AA
- Section 508
- ADA compliance requirements

## Future Improvements

Potential enhancements for accessibility:
1. Add keyboard shortcuts documentation
2. Implement custom focus management for modals
3. Add voice control support
4. Provide alternative text-based data views
5. Add user preference for reduced animations
6. Implement dark mode with proper contrast ratios

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
