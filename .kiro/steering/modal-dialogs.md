# Modal Dialog Implementation Guide

**Status:** Authoritative  
**Applies to:** All modal dialogs and overlay components in the frontend  
**Audience:** Frontend developers and automation agents (including Kiro)  
**Owner:** Development Team

---

## 1. Purpose

This document defines **mandatory patterns for implementing modal dialogs** in this codebase.

Its goals are to:

- Prevent CSS specificity issues that break fixed positioning
- Ensure consistent modal behavior across all components
- Avoid repeated debugging of the same layout issues

This document is **normative**.

---

## 2. The Problem

Modal dialogs using only Tailwind CSS classes for fixed positioning can break when:

- The modal is rendered inside a component with CSS transforms
- Parent containers have `overflow: hidden` or other layout constraints
- CSS specificity from other stylesheets overrides Tailwind utilities
- The modal is nested inside flex/grid containers with constrained widths

**Symptom:** The modal appears as a narrow vertical strip instead of a centered overlay.

---

## 3. Required Pattern

All modal dialogs MUST use inline `style` attributes to ensure positioning works correctly.

### Overlay Container

```tsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
  role="dialog"
  aria-modal="true"
>
```

### Dialog Content

```tsx
<div
  className="bg-white rounded-lg shadow-xl p-6"
  style={{ width: '100%', maxWidth: '28rem', minWidth: '320px' }}
>
```

---

## 4. Complete Example

```tsx
import { createPortal } from 'react-dom'

interface MyDialogProps {
  isOpen: boolean
  onClose: () => void
}

const MyDialog: React.FC<MyDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="my-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6"
        style={{ width: '100%', maxWidth: '28rem', minWidth: '320px' }}
      >
        <h2 id="my-dialog-title" className="text-lg font-semibold mb-4">
          Dialog Title
        </h2>
        {/* Dialog content */}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose}>Cancel</button>
          <button>Confirm</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
```

---

## 5. Key Requirements

### 5.1 Use `createPortal`

Modals SHOULD use `createPortal` to render at the document body level:

```tsx
import { createPortal } from 'react-dom'

return createPortal(<ModalContent />, document.body)
```

### 5.2 Inline Styles for Positioning

The overlay MUST include inline styles for fixed positioning:

```tsx
style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
```

### 5.3 Inline Styles for Width

The dialog content MUST include inline styles for width constraints:

```tsx
style={{ width: '100%', maxWidth: '28rem', minWidth: '320px' }}
```

### 5.4 Background Opacity

Use `bg-black/50` instead of `bg-black bg-opacity-50` for consistency.

---

## 6. Common Width Values

| Dialog Type | maxWidth |
|-------------|----------|
| Small (confirm) | `28rem` (448px) |
| Medium (form) | `32rem` (512px) |
| Large (details) | `42rem` (672px) |
| Extra Large | `56rem` (896px) |

---

## 7. Reference Implementation

See `frontend/src/components/BackfillButton.tsx` for a working example that has been tested and verified.

---

## 8. Accessibility Requirements

All modals MUST include:

- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby` pointing to the dialog title
- Keyboard dismissal (Escape key) when appropriate
- Focus trapping when appropriate

---

## 9. Final Rule

> **Always use inline styles for modal positioning and width.**  
> **Never rely solely on Tailwind classes for fixed positioning in modals.**  
> **When in doubt, reference BackfillButton.tsx.**
