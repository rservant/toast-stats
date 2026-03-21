# Design System — Toast Stats

**Last updated:** March 2026

This document describes the design system for the UX Designer skill. The system is implemented as vanilla CSS custom properties (design tokens) in `frontend/src/styles/`.

---

## Token Architecture

```
styles/
├── tokens/
│   ├── colors.css       ← Brand colors + opacity scales
│   ├── spacing.css      ← Spacing scale + border radius
│   ├── typography.css   ← Font families, sizes, weights
│   └── gradients.css    ← Gradient definitions
├── layers/
│   └── base.css         ← CSS layer ordering
├── components/
│   ├── alerts.css       ← Alert/notification styles
│   ├── buttons.css      ← Button variants
│   ├── cards.css        ← Card containers
│   ├── forms.css        ← Form elements
│   ├── headers.css      ← Page/section headers
│   ├── navigation.css   ← Nav elements
│   ├── status-indicators.css ← Health status pills
│   └── typography.css   ← Heading/body text styles
├── brand.css            ← Toastmasters brand overrides
├── dark-mode.css        ← Dark theme overrides
├── responsive.css       ← Breakpoint styles
└── index.css            ← Main entry point (imports all)
```

---

## Brand Colors

All colors follow the Toastmasters International brand guidelines. See [toastmasters-brand-guidelines.md](toastmasters-brand-guidelines.md).

| Token               | Value     | Usage                             |
| ------------------- | --------- | --------------------------------- |
| `--tm-loyal-blue`   | `#004165` | Primary — headers, links, accents |
| `--tm-true-maroon`  | `#772432` | Secondary — alerts, emphasis      |
| `--tm-cool-gray`    | `#A9B2B1` | Neutral — borders, muted text     |
| `--tm-happy-yellow` | `#F2DF74` | Accent — highlights, badges       |
| `--tm-black`        | `#000000` | Text, dark backgrounds            |
| `--tm-white`        | `#FFFFFF` | Backgrounds, light text           |

Each color has 10 opacity variants: `--tm-loyal-blue-10` through `--tm-loyal-blue-100`.

### Usage Rule

Always use token variables, never raw hex/rgb:

```css
/* ✅ Correct */
color: var(--tm-loyal-blue);
background: var(--tm-loyal-blue-10);

/* ❌ Wrong */
color: #004165;
background: rgba(0, 65, 101, 0.1);
```

---

## Typography

| Role      | Font                        | Token                |
| --------- | --------------------------- | -------------------- |
| Headlines | Montserrat (700/900)        | `--tm-font-headline` |
| Body text | Source Sans 3 (400/500/600) | `--tm-font-body`     |

### Type Scale

| Token                 | Size | Usage                               |
| --------------------- | ---- | ----------------------------------- |
| `--tm-font-size-xs`   | 12px | Captions, footnotes                 |
| `--tm-font-size-sm`   | 14px | Secondary text, table cells         |
| `--tm-font-size-base` | 16px | Body text (minimum for readability) |
| `--tm-font-size-lg`   | 18px | Lead paragraphs                     |
| `--tm-font-size-xl`   | 20px | Section headers                     |
| `--tm-font-size-2xl`  | 24px | Page subheaders                     |
| `--tm-font-size-3xl`  | 30px | Page headers                        |
| `--tm-font-size-4xl`  | 36px | Hero text                           |

---

## Spacing Scale

Semantic spacing tokens for consistency:

| Token            | Size | Usage                      |
| ---------------- | ---- | -------------------------- |
| `--tm-space-xs`  | 4px  | Tight gaps (icon↔label)    |
| `--tm-space-sm`  | 8px  | Default inner padding      |
| `--tm-space-md`  | 16px | Card padding, section gaps |
| `--tm-space-lg`  | 24px | Section separators         |
| `--tm-space-xl`  | 32px | Page-level spacing         |
| `--tm-space-2xl` | 48px | Major section breaks       |

### Component Spacing

| Token                                     | Purpose                    |
| ----------------------------------------- | -------------------------- |
| `--tm-component-padding-{xs,sm,md,lg,xl}` | Internal component padding |
| `--tm-component-margin-{xs,sm,md,lg,xl}`  | External component margins |

### Border Radius

| Token              | Size   | Usage                    |
| ------------------ | ------ | ------------------------ |
| `--tm-radius-sm`   | 4px    | Buttons, inputs          |
| `--tm-radius-md`   | 8px    | Cards, modals            |
| `--tm-radius-lg`   | 12px   | Large cards              |
| `--tm-radius-full` | 9999px | Circular elements, pills |

---

## Touch Targets

Minimum touch target: `--tm-touch-target: 44px` (WCAG 2.1 AA).

All clickable elements must meet this minimum.

---

## Dark Mode

Dark mode is implemented via `[data-theme='dark']` CSS attribute selector in `dark-mode.css`. Toggle via the `ThemeToggle` component (stored in `DarkModeContext`).

> [!WARNING]
> Tailwind opacity-variant classes (`text-tm-loyal-blue-80`) bypass CSS variable overrides. When changing brand colors for dark mode, each opacity variant needs explicit overrides. See Lesson #21.

---

## Responsive Breakpoints

Defined in `responsive.css`:

| Breakpoint   | Target      | Key                       |
| ------------ | ----------- | ------------------------- |
| `< 480px`    | Phone       | Stack layouts, full-width |
| `480–768px`  | Large phone | 2-col where natural       |
| `768–1024px` | Tablet      | Side panels collapse      |
| `> 1024px`   | Desktop     | Full layout               |

---

## Status Indicators

Health status uses consistent colors defined in `status-indicators.css`:

| Status                | Color        | Usage          |
| --------------------- | ------------ | -------------- |
| Thriving              | Green        | Healthy clubs  |
| Vulnerable            | Amber/Yellow | At-risk clubs  |
| Intervention Required | Red          | Critical clubs |
