# Frontend Conventions Steering Document

**Status:** Authoritative  
**Applies to:** All frontend React code  
**Owner:** Development Team

---

## 1. Project Structure

```text
frontend/src/
├── components/       # Reusable React components (PascalCase.tsx)
├── hooks/            # Custom hooks (useCamelCase.ts)
├── pages/            # Page components ({Name}Page.tsx)
├── contexts/         # React context providers ({Name}Context.tsx)
├── services/         # API service functions (camelCase.ts)
├── types/            # TypeScript type definitions (camelCase.ts)
├── utils/            # Pure utility functions (camelCase.ts)
├── styles/           # Global styles, tokens, CSS layers
│   ├── tokens/       # CSS custom properties
│   ├── components/   # Shared component styles
│   └── layers/       # CSS cascade layer definitions
├── App.tsx           # Root component
└── main.tsx          # Entry point
```

Unit tests: co-located (`{name}.test.tsx`). Integration/property tests: `src/__tests__/`.

### Path Aliases

`@/` → `src/`, `@/components` → `src/components/`, etc. Use aliases for cross-feature imports; relative imports within same feature.

### Import Order

1. React imports → 2. Third-party → 3. Internal (`@/`) → 4. Relative → 5. Type-only → 6. Styles

---

## 2. Component Patterns

- Functional components ONLY (class components PROHIBITED)
- Props MUST use `interface {Component}Props` (not `type`)
- Callbacks follow `on{Event}` convention
- Internal structure: hooks → derived state → event handlers → effects → render

### Naming

| Type       | Pattern         | Example                |
| ---------- | --------------- | ---------------------- |
| Pages      | `{Name}Page`    | `DashboardPage`        |
| Layouts    | `{Name}Layout`  | `MainLayout`           |
| Components | `{Name}`        | `DistrictCard`         |
| HOCs       | `with{Feature}` | `withAuth`             |

### Prohibited Patterns

- Inline object/array creation in JSX props (causes re-renders)
- Anonymous functions in JSX event handlers (use `useCallback`)
- Storing derived state (derive with `useMemo` instead)
- Global mutable state
- Prop drilling > 2 levels (use Context instead)

---

## 3. Hooks Guidelines

| Hook          | Use When                              |
| ------------- | ------------------------------------- |
| `useState`    | Simple local state                    |
| `useReducer`  | Complex state with multiple sub-values |
| `useEffect`   | Side effects (MUST specify deps, MUST cleanup subscriptions) |
| `useCallback` | Callbacks passed to children          |
| `useMemo`     | Expensive derived values              |
| `useRef`      | DOM refs, non-triggering values       |
| `useContext`  | MUST wrap in custom hook with null check |

Custom hooks MUST: be prefixed `use`, live in `src/hooks/`, handle loading/error/success states for async.

---

## 4. State Management Hierarchy

| State Type     | Scope            | Solution     |
| -------------- | ---------------- | ------------ |
| Local UI       | Single component | `useState`   |
| Complex local  | Single component | `useReducer` |
| Shared UI      | Subtree          | Context      |
| Server state   | App-wide         | React Query  |
| URL state      | App-wide         | React Router |

### React Query

- MUST be used for all server state (no raw `fetch` in components)
- Default staleTime: 5 min, gcTime: 30 min
- Query keys: hierarchical (`['districts', districtId, 'statistics']`)
- Use `queryKeys` factory object for consistency

### Context Rules

- MUST consume via custom hook with null-check (`useTheme`, `useAuth`)
- MUST memoize provider values
- SHOULD NOT store frequently-changing values

---

## 5. Styling

- Colors, typography, gradients: see `toastmasters-brand-guidelines.md`
- Design tokens as CSS custom properties in `src/styles/tokens/`
- Tailwind CSS for layout, spacing, responsive design
- Brand-specific styles use CSS custom properties, not Tailwind
