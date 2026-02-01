# Frontend Standards Steering Document

**Status:** Authoritative  
**Applies to:** All frontend code (React components, hooks, utilities, styles, and tests)  
**Audience:** All developers and automation agents (including Kiro)  
**Owner:** Development Team

---

## 1. Purpose

This document defines **mandatory frontend development standards** for the Toast-Stats application.

Its goals are to:

- Establish consistent React development patterns across the codebase
- Define project structure conventions for maintainability and discoverability
- Ensure accessibility compliance and user experience quality
- Integrate with existing steering documents for TypeScript and brand compliance
- Provide clear guidance for Firebase Hosting deployment

This document is **normative**.

The keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are to be interpreted as described in RFC 2119.

Kiro MUST treat this document as the **primary source of truth** for all frontend development decisions.

---

## 2. Non-Goals

This document explicitly does **NOT** cover:

- **TypeScript language standards** — See [typescript.md](./typescript.md)
- **Brand colors, typography, and design tokens** — See [toastmasters-brand-guidelines.md](./toastmasters-brand-guidelines.md)
- **Modal dialog implementation patterns** — See [modal-dialogs.md](./modal-dialogs.md)
- **Testing philosophy and practices** — See [testing.md](./testing.md)
- **Backend API design** — See [platform-engineering.md](./platform-engineering.md)
- **Performance SLOs and memory management** — See [performance-slos.md](./performance-slos.md)

This document provides **cross-references** to these documents rather than duplicating their content.

---

## 3. Authority Model

In the event of conflict, frontend rules MUST be applied according to the following precedence order (highest first):

1. **Domain-specific steering document** (e.g., typescript.md for TypeScript questions, toastmasters-brand-guidelines.md for styling)
2. **This Frontend Standards Document** (general frontend guidance)
3. **performance-slos.md** (performance-specific guidance)
4. ESLint and Prettier configuration
5. File-level overrides or comments

Lower-precedence sources MUST NOT weaken higher-precedence rules.

### Document Scope Boundaries

| Document                         | Authoritative Scope                                                |
| -------------------------------- | ------------------------------------------------------------------ |
| frontend-standards.md            | React patterns, project structure, data fetching, Firebase Hosting |
| typescript.md                    | TypeScript compiler configuration, type safety patterns            |
| toastmasters-brand-guidelines.md | Brand colors, typography, accessibility, design tokens             |
| modal-dialogs.md                 | Modal and overlay component implementation                         |
| testing.md                       | Testing philosophy, test isolation, coverage expectations          |
| performance-slos.md              | Performance targets, bundle size limits, Core Web Vitals           |

When guidance overlaps between documents, the document with the narrower, more specific scope takes precedence.

---

## 4. Project Structure

The frontend follows a feature-organized structure with clear separation of concerns.

### 4.1 Directory Layout

```text
frontend/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── __tests__/       # Component-specific tests
│   │   ├── brand/           # Brand-compliant UI components
│   │   ├── filters/         # Filter and search components
│   │   ├── Header/          # Header component module
│   │   ├── Navigation/      # Navigation component module
│   │   └── ui/              # Generic UI primitives
│   ├── hooks/               # Custom React hooks
│   │   └── __tests__/       # Hook-specific tests
│   ├── pages/               # Page-level components (route targets)
│   │   └── __tests__/       # Page-specific tests
│   ├── contexts/            # React context providers
│   ├── services/            # API service functions
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions and helpers
│   │   └── __tests__/       # Utility-specific tests
│   ├── styles/              # Global styles and CSS modules
│   │   ├── components/      # Component-specific styles
│   │   ├── layers/          # CSS layer definitions
│   │   └── tokens/          # Design token definitions
│   ├── config/              # Configuration files
│   ├── scripts/             # Build and validation scripts
│   ├── test-utils/          # Test utilities and generators
│   ├── __tests__/           # Integration and cross-cutting tests
│   ├── App.tsx              # Root application component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global CSS entry point
├── index.html               # HTML template
├── vite.config.ts           # Vite build configuration
├── vitest.config.ts         # Vitest test configuration
├── tsconfig.json            # TypeScript configuration
├── eslint.config.js         # ESLint configuration
└── postcss.config.js        # PostCSS configuration
```

### 4.2 File Organization Rules

| File Type         | Location               | Naming Convention               |
| ----------------- | ---------------------- | ------------------------------- |
| React components  | `src/components/`      | `PascalCase.tsx`                |
| Page components   | `src/pages/`           | `PascalCasePage.tsx`            |
| Custom hooks      | `src/hooks/`           | `useCamelCase.ts`               |
| Context providers | `src/contexts/`        | `PascalCaseContext.tsx`         |
| API services      | `src/services/`        | `camelCase.ts`                  |
| Type definitions  | `src/types/`           | `camelCase.ts`                  |
| Utility functions | `src/utils/`           | `camelCase.ts`                  |
| Unit tests        | Co-located with source | `{name}.test.ts(x)`             |
| Integration tests | `src/__tests__/`       | `{name}.integration.test.ts(x)` |
| Property tests    | `src/__tests__/`       | `{name}.property.test.ts(x)`    |

### 4.3 Component Organization Patterns

Components SHOULD be organized using one of these patterns:

#### Single-File Components

For simple components without complex logic:

```text
src/components/
├── StatCard.tsx           # Component implementation
└── StatCard.test.tsx      # Co-located test
```

#### Module Components

For complex components with multiple concerns:

```text
src/components/Header/
├── index.ts               # Public exports
├── Header.tsx             # Main component
├── HeaderNav.tsx          # Sub-component
├── Header.test.tsx        # Component tests
└── Header.module.css      # Component styles (if needed)
```

### 4.4 Structural Requirements

- Page components MUST be placed in `src/pages/` and named with `Page` suffix
- Reusable components MUST be placed in `src/components/`
- Custom hooks MUST be placed in `src/hooks/` and prefixed with `use`
- Context providers MUST be placed in `src/contexts/` and suffixed with `Context`
- Type definitions MUST be placed in `src/types/` and exported via index files
- Utility functions MUST be pure functions without side effects where possible
- Test files MUST be co-located with source files for unit tests

### 4.5 Import Organization

Imports MUST be organized in the following order:

1. React and React-related imports
2. Third-party library imports
3. Internal absolute imports (using path aliases)
4. Relative imports
5. Type-only imports
6. Style imports

```typescript
// ✅ CORRECT - Organized imports
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/hooks/useAuth'
import { api } from '@/services/api'

import { StatCard } from '../StatCard'
import { formatDate } from './utils'

import type { District } from '@/types/districts'

import './Dashboard.css'
```

### 4.6 Path Aliases

The project uses path aliases for cleaner imports. The following aliases are configured:

| Alias          | Target            |
| -------------- | ----------------- |
| `@/`           | `src/`            |
| `@/components` | `src/components/` |
| `@/hooks`      | `src/hooks/`      |
| `@/pages`      | `src/pages/`      |
| `@/contexts`   | `src/contexts/`   |
| `@/services`   | `src/services/`   |
| `@/types`      | `src/types/`      |
| `@/utils`      | `src/utils/`      |
| `@/styles`     | `src/styles/`     |
| `@/config`     | `src/config/`     |

Path aliases SHOULD be used for imports from different feature areas. Relative imports SHOULD be used for imports within the same feature area.

---

## 5. TypeScript Configuration

For TypeScript compiler configuration, type safety patterns, and prohibited patterns, see [typescript.md](./typescript.md).

Key requirements from that document that apply to frontend code:

- `strict: true` MUST be enabled
- `noImplicitAny: true` MUST be enabled
- `strictNullChecks: true` MUST be enabled
- The `any` type is **STRICTLY FORBIDDEN**
- External data (API responses) MUST be typed as `unknown` and validated at runtime

### 5.1 Frontend-Specific TypeScript Patterns

#### Component Props

Component props MUST be explicitly typed using interfaces:

```typescript
// ✅ CORRECT - Explicit props interface
interface StatCardProps {
  title: string
  value: number
  trend?: 'up' | 'down' | 'neutral'
  onClick?: () => void
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  trend,
  onClick,
}) => {
  // ...
}
```

#### Event Handlers

Event handlers MUST use React's typed event interfaces:

```typescript
// ✅ CORRECT - Typed event handler
const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
  event.preventDefault()
  // ...
}

// ✅ CORRECT - Typed change handler
const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  setValue(event.target.value)
}
```

---

## 6. Styling and Brand Compliance

For brand colors, typography, gradients, and accessibility requirements, see [toastmasters-brand-guidelines.md](./toastmasters-brand-guidelines.md).

Key requirements from that document:

- All colors MUST use the official Toastmasters brand palette
- Typography MUST use Montserrat (headlines) and Source Sans 3 (body)
- WCAG AA compliance is REQUIRED (4.5:1 contrast for normal text)
- Touch targets MUST be minimum 44px
- CSS custom properties MUST be used for brand tokens

### 6.1 CSS Organization

Styles MUST be organized using the following structure:

| Style Type       | Location                 | Usage                                                 |
| ---------------- | ------------------------ | ----------------------------------------------------- |
| Design tokens    | `src/styles/tokens/`     | CSS custom properties for colors, spacing, typography |
| Global styles    | `src/styles/`            | Base styles, resets, brand styles                     |
| Component styles | `src/styles/components/` | Shared component styles                               |
| CSS layers       | `src/styles/layers/`     | CSS cascade layer definitions                         |

### 6.2 Tailwind CSS Usage

The project uses Tailwind CSS for utility-first styling. Tailwind classes SHOULD be used for:

- Layout and spacing
- Responsive design
- Common patterns (flex, grid, etc.)

Brand-specific styles MUST use CSS custom properties defined in the brand guidelines.

---

## 7. React Patterns

This section defines mandatory patterns for React component development, hooks usage, state management, and data fetching.

### 7.1 Component Patterns

All React components MUST be implemented as functional components. Class components are **PROHIBITED** for new code.

#### Functional Component Structure

Components MUST follow this structural pattern:

```typescript
// ✅ CORRECT - Functional component with explicit typing
import { useState, useCallback } from 'react'

import type { District } from '@/types/districts'

interface DistrictCardProps {
  district: District
  isSelected?: boolean
  onSelect?: (districtId: string) => void
}

export const DistrictCard: React.FC<DistrictCardProps> = ({
  district,
  isSelected = false,
  onSelect,
}) => {
  // 1. Hooks (state, refs, context, custom hooks)
  const [isExpanded, setIsExpanded] = useState(false)

  // 2. Derived state and memoized values
  const statusColor = district.status === 'active' ? 'green' : 'gray'

  // 3. Event handlers
  const handleClick = useCallback(() => {
    onSelect?.(district.id)
  }, [district.id, onSelect])

  // 4. Effects (if needed)
  // useEffect(() => { ... }, [deps])

  // 5. Render
  return (
    <div
      className={`district-card ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      <h3>{district.name}</h3>
      <span className={`status-${statusColor}`}>{district.status}</span>
    </div>
  )
}
```

#### Component Naming Conventions

| Component Type            | Naming Pattern     | Example                               |
| ------------------------- | ------------------ | ------------------------------------- |
| Page components           | `{Name}Page`       | `DashboardPage`, `DistrictDetailPage` |
| Layout components         | `{Name}Layout`     | `MainLayout`, `SidebarLayout`         |
| Container components      | `{Name}Container`  | `DistrictListContainer`               |
| Presentational components | `{Name}`           | `DistrictCard`, `StatBadge`           |
| Higher-order components   | `with{Capability}` | `withAuth`, `withErrorBoundary`       |

#### Props Interface Requirements

- Props interfaces MUST be defined using `interface`, not `type`
- Props interfaces MUST be named `{ComponentName}Props`
- Optional props MUST have default values defined in destructuring
- Callback props SHOULD follow the `on{Event}` naming convention

```typescript
// ✅ CORRECT - Props interface with proper conventions
interface FilterPanelProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  onReset?: () => void
  isDisabled?: boolean
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  onReset,
  isDisabled = false,
}) => {
  // ...
}
```

#### Component Composition Patterns

Components SHOULD use composition over inheritance:

```typescript
// ✅ CORRECT - Composition with children
interface CardProps {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export const Card: React.FC<CardProps> = ({ title, children, footer }) => (
  <div className="card">
    <div className="card-header">{title}</div>
    <div className="card-body">{children}</div>
    {footer && <div className="card-footer">{footer}</div>}
  </div>
)

// Usage
<Card title="District Statistics" footer={<Button>View Details</Button>}>
  <StatList stats={districtStats} />
</Card>
```

#### Prohibited Component Patterns

```typescript
// ❌ FORBIDDEN - Class components
class DistrictCard extends React.Component<Props> {
  render() { ... }
}

// ❌ FORBIDDEN - Inline object/array creation in JSX (causes re-renders)
<Component style={{ margin: 10 }} items={[1, 2, 3]} />

// ❌ FORBIDDEN - Anonymous functions in JSX (causes re-renders)
<Button onClick={() => handleClick(id)} />

// ✅ CORRECT - Memoized handlers and stable references
const handleButtonClick = useCallback(() => handleClick(id), [id])
<Button onClick={handleButtonClick} />
```

### 7.2 Hooks Usage Guidelines

Custom hooks MUST follow established patterns for reusability, testability, and consistency.

#### Built-in Hooks Usage

| Hook          | When to Use            | Requirements                                                         |
| ------------- | ---------------------- | -------------------------------------------------------------------- |
| `useState`    | Local component state  | MUST use for simple, independent state values                        |
| `useReducer`  | Complex state logic    | SHOULD use when state has multiple sub-values or complex transitions |
| `useEffect`   | Side effects           | MUST specify complete dependency array; MUST clean up subscriptions  |
| `useCallback` | Memoized callbacks     | SHOULD use for callbacks passed to child components                  |
| `useMemo`     | Expensive computations | SHOULD use for computationally expensive derived values              |
| `useRef`      | Mutable references     | MUST use for DOM refs and values that don't trigger re-renders       |
| `useContext`  | Consuming context      | MUST use with typed context; SHOULD wrap in custom hook              |

#### useEffect Requirements

Effects MUST follow these rules:

```typescript
// ✅ CORRECT - Effect with cleanup and complete dependencies
useEffect(() => {
  const controller = new AbortController()

  const fetchData = async () => {
    try {
      const response = await fetch(url, { signal: controller.signal })
      const data = await response.json()
      setData(data)
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setError(error)
      }
    }
  }

  fetchData()

  // Cleanup function
  return () => {
    controller.abort()
  }
}, [url]) // Complete dependency array

// ❌ FORBIDDEN - Missing dependencies
useEffect(() => {
  fetchData(userId) // userId not in deps!
}, [])

// ❌ FORBIDDEN - Missing cleanup for subscriptions
useEffect(() => {
  const subscription = eventEmitter.subscribe(handler)
  // No cleanup!
}, [])
```

#### Custom Hook Patterns

Custom hooks MUST:

- Be prefixed with `use`
- Be placed in `src/hooks/`
- Return a consistent interface
- Handle loading, error, and success states for async operations

```typescript
// ✅ CORRECT - Custom hook with proper structure
// src/hooks/useDistrict.ts
import { useState, useEffect } from 'react'

import { fetchDistrict } from '@/services/api'

import type { District } from '@/types/districts'

interface UseDistrictResult {
  district: District | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useDistrict(districtId: string): UseDistrictResult {
  const [district, setDistrict] = useState<District | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await fetchDistrict(districtId)
      setDistrict(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [districtId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { district, isLoading, error, refetch: fetchData }
}
```

#### Hook Rules Enforcement

The following rules are **MANDATORY** and enforced by ESLint:

1. Hooks MUST only be called at the top level of a function component or custom hook
2. Hooks MUST NOT be called inside loops, conditions, or nested functions
3. Hooks MUST only be called from React function components or custom hooks
4. Custom hooks MUST start with `use` prefix

```typescript
// ❌ FORBIDDEN - Conditional hook call
if (isEnabled) {
  const [value, setValue] = useState(0) // VIOLATION
}

// ❌ FORBIDDEN - Hook in loop
items.forEach(item => {
  const [selected, setSelected] = useState(false) // VIOLATION
})

// ✅ CORRECT - Hooks at top level, conditional logic inside
const [value, setValue] = useState(0)
const [selected, setSelected] = useState<Record<string, boolean>>({})

if (isEnabled) {
  // Use the state here
}
```

### 7.3 State Management

State management MUST follow a layered approach based on state scope and complexity.

#### State Management Hierarchy

| State Type              | Scope             | Solution      | Example                           |
| ----------------------- | ----------------- | ------------- | --------------------------------- |
| **Local UI State**      | Single component  | `useState`    | Form input values, toggle states  |
| **Complex Local State** | Single component  | `useReducer`  | Multi-step forms, complex toggles |
| **Shared UI State**     | Component subtree | React Context | Theme, sidebar open/closed        |
| **Server State**        | Application-wide  | React Query   | API data, cached responses        |
| **URL State**           | Application-wide  | React Router  | Current route, query parameters   |

#### Local State with useState

Use `useState` for simple, independent state values:

```typescript
// ✅ CORRECT - Simple local state
const [isOpen, setIsOpen] = useState(false)
const [searchTerm, setSearchTerm] = useState('')
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
```

#### Complex State with useReducer

Use `useReducer` when state has multiple related values or complex update logic:

```typescript
// ✅ CORRECT - Complex state with useReducer
interface FilterState {
  programYear: string | null
  districtStatus: 'all' | 'active' | 'inactive'
  sortBy: 'name' | 'performance' | 'date'
  sortOrder: 'asc' | 'desc'
}

type FilterAction =
  | { type: 'SET_PROGRAM_YEAR'; payload: string | null }
  | { type: 'SET_STATUS'; payload: FilterState['districtStatus'] }
  | {
      type: 'SET_SORT'
      payload: {
        sortBy: FilterState['sortBy']
        sortOrder: FilterState['sortOrder']
      }
    }
  | { type: 'RESET' }

const initialState: FilterState = {
  programYear: null,
  districtStatus: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
}

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_PROGRAM_YEAR':
      return { ...state, programYear: action.payload }
    case 'SET_STATUS':
      return { ...state, districtStatus: action.payload }
    case 'SET_SORT':
      return { ...state, ...action.payload }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

// Usage in component
const [filters, dispatch] = useReducer(filterReducer, initialState)
```

#### Shared State with Context

Use React Context for state that needs to be shared across a component subtree:

```typescript
// ✅ CORRECT - Context with typed provider
// src/contexts/ThemeContext.tsx
import { createContext, useContext, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Custom hook for consuming context (REQUIRED pattern)
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
```

#### Context Usage Requirements

- Context MUST be consumed via a custom hook that validates the context exists
- Context providers MUST be placed at the appropriate level in the component tree
- Context SHOULD NOT be used for frequently changing values (use React Query for server state)
- Context values SHOULD be memoized to prevent unnecessary re-renders

```typescript
// ✅ CORRECT - Memoized context value
const contextValue = useMemo(
  () => ({ theme, toggleTheme, setTheme }),
  [theme, toggleTheme, setTheme]
)

return (
  <ThemeContext.Provider value={contextValue}>
    {children}
  </ThemeContext.Provider>
)
```

#### Prohibited State Patterns

```typescript
// ❌ FORBIDDEN - Global mutable state
let globalState = { user: null }

// ❌ FORBIDDEN - Prop drilling through many levels
<GrandParent user={user}>
  <Parent user={user}>
    <Child user={user}>
      <GrandChild user={user} /> {/* Use Context instead */}
    </Child>
  </Parent>
</GrandParent>

// ❌ FORBIDDEN - Storing derived state
const [items, setItems] = useState([])
const [filteredItems, setFilteredItems] = useState([]) // Derive this instead!

// ✅ CORRECT - Derive state from source
const [items, setItems] = useState([])
const [filter, setFilter] = useState('')
const filteredItems = useMemo(
  () => items.filter(item => item.name.includes(filter)),
  [items, filter]
)
```

### 7.4 Data Fetching with React Query

All server state management MUST use [TanStack Query](https://tanstack.com/query) (React Query) for data fetching, caching, and synchronization.

#### React Query Setup

The application MUST configure React Query at the root level:

```typescript
// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes
      gcTime: 30 * 60 * 1000,          // 30 minutes (formerly cacheTime)
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

#### Query Key Conventions

Query keys MUST follow a hierarchical structure for proper cache invalidation:

```typescript
// ✅ CORRECT - Hierarchical query keys
const queryKeys = {
  // All districts queries
  districts: ['districts'] as const,

  // Districts list with filters
  districtList: (filters: DistrictFilters) =>
    [...queryKeys.districts, 'list', filters] as const,

  // Single district by ID
  district: (id: string) => [...queryKeys.districts, 'detail', id] as const,

  // District statistics
  districtStats: (id: string) =>
    [...queryKeys.districts, 'detail', id, 'stats'] as const,

  // All snapshots queries
  snapshots: ['snapshots'] as const,

  // Snapshot by ID
  snapshot: (id: string) => [...queryKeys.snapshots, 'detail', id] as const,
}

// Usage
const { data } = useQuery({
  queryKey: queryKeys.district(districtId),
  queryFn: () => fetchDistrict(districtId),
})
```

#### useQuery Patterns

Queries MUST follow these patterns:

```typescript
// ✅ CORRECT - Query with proper typing and error handling
import { useQuery } from '@tanstack/react-query'

import { fetchDistricts } from '@/services/api'
import { queryKeys } from '@/config/queryKeys'

import type { District, DistrictFilters } from '@/types/districts'

interface UseDistrictsOptions {
  filters?: DistrictFilters
  enabled?: boolean
}

export function useDistricts(options: UseDistrictsOptions = {}) {
  const { filters = {}, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.districtList(filters),
    queryFn: async (): Promise<District[]> => {
      const response = await fetchDistricts(filters)
      return response.data
    },
    enabled,
    staleTime: 5 * 60 * 1000, // Override default if needed
    select: (data) => data.sort((a, b) => a.name.localeCompare(b.name)),
  })
}

// Usage in component
function DistrictList() {
  const { data: districts, isLoading, error, refetch } = useDistricts({
    filters: { status: 'active' },
  })

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorDisplay error={error} onRetry={refetch} />
  if (!districts?.length) return <EmptyState />

  return (
    <ul>
      {districts.map(district => (
        <DistrictCard key={district.id} district={district} />
      ))}
    </ul>
  )
}
```

#### useMutation Patterns

Mutations MUST handle optimistic updates and error recovery:

```typescript
// ✅ CORRECT - Mutation with optimistic update
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateDistrict } from '@/services/api'
import { queryKeys } from '@/config/queryKeys'

import type { District, UpdateDistrictInput } from '@/types/districts'

export function useUpdateDistrict() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDistrictInput }) =>
      updateDistrict(id, data),

    // Optimistic update
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.district(id) })

      // Snapshot previous value
      const previousDistrict = queryClient.getQueryData<District>(
        queryKeys.district(id)
      )

      // Optimistically update
      if (previousDistrict) {
        queryClient.setQueryData<District>(queryKeys.district(id), {
          ...previousDistrict,
          ...data,
        })
      }

      return { previousDistrict }
    },

    // Rollback on error
    onError: (error, { id }, context) => {
      if (context?.previousDistrict) {
        queryClient.setQueryData(
          queryKeys.district(id),
          context.previousDistrict
        )
      }
    },

    // Refetch after success or error
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.district(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.districts })
    },
  })
}

// Usage in component
function DistrictEditor({ district }: { district: District }) {
  const updateMutation = useUpdateDistrict()

  const handleSave = (data: UpdateDistrictInput) => {
    updateMutation.mutate(
      { id: district.id, data },
      {
        onSuccess: () => {
          toast.success('District updated successfully')
        },
        onError: (error) => {
          toast.error(`Failed to update: ${error.message}`)
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit(handleSave)}>
      {/* Form fields */}
      <button type="submit" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
```

#### Caching Strategy

| Data Type             | staleTime        | gcTime     | Refetch Strategy |
| --------------------- | ---------------- | ---------- | ---------------- |
| Static reference data | 30 minutes       | 60 minutes | On mount only    |
| District list         | 5 minutes        | 30 minutes | On window focus  |
| District detail       | 5 minutes        | 30 minutes | On mount         |
| Snapshot data         | 10 minutes       | 60 minutes | Manual only      |
| User preferences      | 0 (always stale) | 30 minutes | On every render  |

#### Error Handling Patterns

Queries MUST handle errors gracefully:

```typescript
// ✅ CORRECT - Error handling with retry and fallback
export function useDistrictWithFallback(districtId: string) {
  const query = useQuery({
    queryKey: queryKeys.district(districtId),
    queryFn: () => fetchDistrict(districtId),
    retry: (failureCount, error) => {
      // Don't retry on 404
      if (error instanceof ApiError && error.status === 404) {
        return false
      }
      return failureCount < 3
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  return {
    ...query,
    // Provide typed error
    error: query.error as ApiError | null,
  }
}

// Error boundary integration
function DistrictPage({ districtId }: { districtId: string }) {
  const { data, error, isLoading } = useDistrictWithFallback(districtId)

  if (isLoading) {
    return <DistrictSkeleton />
  }

  if (error) {
    if (error.status === 404) {
      return <NotFoundPage message="District not found" />
    }
    throw error // Let error boundary handle other errors
  }

  return <DistrictDetail district={data} />
}
```

#### Prefetching Patterns

Data SHOULD be prefetched for improved perceived performance:

```typescript
// ✅ CORRECT - Prefetch on hover
function DistrictListItem({ district }: { district: District }) {
  const queryClient = useQueryClient()

  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.district(district.id),
      queryFn: () => fetchDistrict(district.id),
      staleTime: 5 * 60 * 1000,
    })
  }

  return (
    <Link
      to={`/districts/${district.id}`}
      onMouseEnter={handleMouseEnter}
    >
      {district.name}
    </Link>
  )
}
```

#### Prohibited Data Fetching Patterns

```typescript
// ❌ FORBIDDEN - Fetching in useEffect without React Query
useEffect(() => {
  fetch('/api/districts')
    .then(res => res.json())
    .then(setDistricts)
}, [])

// ❌ FORBIDDEN - Manual cache management
const [cache, setCache] = useState({})

// ❌ FORBIDDEN - Storing server state in local state
const [districts, setDistricts] = useState<District[]>([])

// ✅ CORRECT - Use React Query for all server state
const { data: districts } = useQuery({
  queryKey: ['districts'],
  queryFn: fetchDistricts,
})
```

---

## 8. UI Patterns

This section defines mandatory patterns for error handling, loading states, accessibility, and security in the frontend application.

### 8.1 Error Boundaries

Error boundaries MUST be used to catch and handle JavaScript errors in the component tree, preventing the entire application from crashing.

#### Error Boundary Implementation

The application MUST implement error boundaries at strategic levels:

| Boundary Level       | Scope               | Recovery Action                               |
| -------------------- | ------------------- | --------------------------------------------- |
| **Application Root** | Entire app          | Show full-page error with reload option       |
| **Route Level**      | Individual pages    | Show page-level error with navigation options |
| **Feature Level**    | Complex features    | Show feature-specific error with retry option |
| **Component Level**  | Critical components | Show inline error with fallback UI            |

#### Standard Error Boundary Component

```typescript
// ✅ CORRECT - Error boundary with proper typing and recovery
import { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to monitoring service
    console.error('Error caught by boundary:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div role="alert" className="error-boundary-fallback">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleReset}>Try again</button>
        </div>
      )
    }

    return this.props.children
  }
}
```

#### Error Boundary Placement Requirements

- The application root MUST be wrapped in an error boundary
- Each route SHOULD have its own error boundary
- Components that fetch data or perform complex operations SHOULD have error boundaries
- Error boundaries MUST NOT be used for event handler errors (use try-catch instead)

```typescript
// ✅ CORRECT - Error boundary placement
function App() {
  return (
    <ErrorBoundary fallback={<FullPageError />}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route
              path="/districts"
              element={
                <ErrorBoundary fallback={<PageError />}>
                  <DistrictsPage />
                </ErrorBoundary>
              }
            />
          </Routes>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
```

#### User-Facing Error Display Requirements

Error displays MUST:

- Provide a clear, non-technical message to users
- Offer actionable recovery options (retry, go back, contact support)
- Log technical details for debugging (not shown to users)
- Maintain brand styling and accessibility standards

```typescript
// ✅ CORRECT - User-friendly error display
interface ErrorDisplayProps {
  error: Error
  onRetry?: () => void
  onGoBack?: () => void
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onGoBack,
}) => (
  <div
    role="alert"
    aria-live="assertive"
    className="flex flex-col items-center justify-center p-8 text-center"
  >
    <h2 className="text-xl font-semibold text-tm-loyal-blue mb-4">
      Unable to load content
    </h2>
    <p className="text-gray-600 mb-6">
      We encountered an issue while loading this page. Please try again.
    </p>
    <div className="flex gap-4">
      {onGoBack && (
        <button
          onClick={onGoBack}
          className="tm-btn-secondary"
        >
          Go Back
        </button>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="tm-btn-primary"
        >
          Try Again
        </button>
      )}
    </div>
  </div>
)
```

#### Prohibited Error Handling Patterns

```typescript
// ❌ FORBIDDEN - Showing technical errors to users
<div>{error.stack}</div>

// ❌ FORBIDDEN - Silent error swallowing
try {
  await fetchData()
} catch (e) {
  // No handling!
}

// ❌ FORBIDDEN - Generic unhelpful messages
<div>Error occurred</div>

// ✅ CORRECT - Helpful error with recovery options
<ErrorDisplay
  error={error}
  onRetry={refetch}
  onGoBack={() => navigate(-1)}
/>
```

### 8.2 Loading States

Loading states MUST provide clear feedback to users during asynchronous operations. The application MUST use skeleton screens and progressive loading patterns.

#### Loading State Hierarchy

| Loading Type | Duration      | Pattern            | Example                       |
| ------------ | ------------- | ------------------ | ----------------------------- |
| **Instant**  | < 100ms       | No indicator       | Local state updates           |
| **Brief**    | 100ms - 300ms | Subtle indicator   | Button spinner                |
| **Standard** | 300ms - 1s    | Skeleton screen    | Page content loading          |
| **Extended** | > 1s          | Progress indicator | File uploads, data processing |

#### Skeleton Screen Implementation

Skeleton screens MUST be used for content that takes more than 300ms to load:

```typescript
// ✅ CORRECT - Skeleton screen component
interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'text' | 'circular' | 'rectangular'
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  variant = 'text',
  className = '',
}) => {
  const baseClasses = 'animate-pulse bg-gray-200'
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

// ✅ CORRECT - Content-specific skeleton
export const DistrictCardSkeleton: React.FC = () => (
  <div className="p-4 border rounded-lg" aria-label="Loading district">
    <Skeleton height="1.5rem" width="60%" className="mb-2" />
    <Skeleton height="1rem" width="40%" className="mb-4" />
    <div className="flex gap-2">
      <Skeleton height="2rem" width="4rem" variant="rectangular" />
      <Skeleton height="2rem" width="4rem" variant="rectangular" />
    </div>
  </div>
)
```

#### Progressive Loading Pattern

Content SHOULD load progressively to improve perceived performance:

```typescript
// ✅ CORRECT - Progressive loading with Suspense
import { Suspense, lazy } from 'react'

const DistrictDetails = lazy(() => import('./DistrictDetails'))
const DistrictAnalytics = lazy(() => import('./DistrictAnalytics'))

export const DistrictPage: React.FC<{ districtId: string }> = ({ districtId }) => {
  const { data: district, isLoading } = useDistrict(districtId)

  if (isLoading) {
    return <DistrictPageSkeleton />
  }

  return (
    <div>
      {/* Critical content loads first */}
      <DistrictHeader district={district} />

      {/* Secondary content loads progressively */}
      <Suspense fallback={<DistrictDetailsSkeleton />}>
        <DistrictDetails districtId={districtId} />
      </Suspense>

      {/* Non-critical content loads last */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <DistrictAnalytics districtId={districtId} />
      </Suspense>
    </div>
  )
}
```

#### Loading State Requirements

- Skeleton screens MUST match the layout of the content they replace
- Loading indicators MUST be accessible (use `aria-busy`, `aria-live`)
- Loading states MUST NOT cause layout shifts when content loads
- Buttons MUST show loading state and be disabled during submission

```typescript
// ✅ CORRECT - Button with loading state
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  loadingText?: string
  children: React.ReactNode
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading = false,
  loadingText = 'Loading...',
  children,
  disabled,
  ...props
}) => (
  <button
    {...props}
    disabled={disabled || isLoading}
    aria-busy={isLoading}
  >
    {isLoading ? (
      <>
        <Spinner className="mr-2" aria-hidden="true" />
        {loadingText}
      </>
    ) : (
      children
    )}
  </button>
)
```

#### Prohibited Loading Patterns

```typescript
// ❌ FORBIDDEN - Generic loading text without visual feedback
{isLoading && <p>Loading...</p>}

// ❌ FORBIDDEN - Layout shift when content loads
{isLoading ? null : <Content />}

// ❌ FORBIDDEN - No loading indication on buttons
<button onClick={handleSubmit}>Submit</button>

// ✅ CORRECT - Skeleton that matches content layout
{isLoading ? <ContentSkeleton /> : <Content />}
```

### 8.3 Accessibility

All frontend components MUST comply with WCAG 2.1 Level AA standards. Accessibility is a **mandatory requirement**, not an optional enhancement.

#### WCAG AA Compliance Requirements

| Criterion                        | Requirement                                     | Implementation                 |
| -------------------------------- | ----------------------------------------------- | ------------------------------ |
| **1.1.1 Non-text Content**       | All images MUST have alt text                   | Use `alt` attribute on `<img>` |
| **1.3.1 Info and Relationships** | Structure MUST be programmatically determinable | Use semantic HTML elements     |
| **1.4.3 Contrast (Minimum)**     | 4.5:1 for normal text, 3:1 for large text       | Use brand-compliant colors     |
| **2.1.1 Keyboard**               | All functionality MUST be keyboard accessible   | Handle keyboard events         |
| **2.1.2 No Keyboard Trap**       | Focus MUST be movable away from any component   | Manage focus properly          |
| **2.4.3 Focus Order**            | Focus order MUST be logical and meaningful      | Use proper DOM order           |
| **2.4.7 Focus Visible**          | Focus indicator MUST be visible                 | Style `:focus-visible`         |
| **4.1.2 Name, Role, Value**      | Components MUST have accessible names and roles | Use ARIA attributes            |

#### Keyboard Navigation Requirements

All interactive elements MUST be keyboard accessible:

```typescript
// ✅ CORRECT - Keyboard-accessible custom component
interface CustomButtonProps {
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  onClick,
  children,
  disabled = false,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!disabled) {
        onClick()
      }
    }
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      aria-disabled={disabled}
      className="custom-button"
    >
      {children}
    </div>
  )
}
```

#### Focus Management Requirements

Focus MUST be managed appropriately for dynamic content:

```typescript
// ✅ CORRECT - Focus management for dynamic content
import { useRef, useEffect } from 'react'

export const SearchResults: React.FC<{ results: Result[]; isNewSearch: boolean }> = ({
  results,
  isNewSearch,
}) => {
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Move focus to results when new search completes
    if (isNewSearch && results.length > 0) {
      resultsRef.current?.focus()
    }
  }, [results, isNewSearch])

  return (
    <div
      ref={resultsRef}
      tabIndex={-1}
      role="region"
      aria-label={`${results.length} search results`}
      aria-live="polite"
    >
      {results.map(result => (
        <ResultItem key={result.id} result={result} />
      ))}
    </div>
  )
}
```

#### ARIA Attributes Requirements

ARIA attributes MUST be used correctly:

| Attribute          | Usage                                            | Example                                 |
| ------------------ | ------------------------------------------------ | --------------------------------------- |
| `aria-label`       | Provide accessible name when text is not visible | `<button aria-label="Close">×</button>` |
| `aria-labelledby`  | Reference visible text as label                  | `<div aria-labelledby="section-title">` |
| `aria-describedby` | Reference additional description                 | `<input aria-describedby="help-text">`  |
| `aria-expanded`    | Indicate expandable state                        | `<button aria-expanded="true">`         |
| `aria-hidden`      | Hide decorative content from AT                  | `<span aria-hidden="true">★</span>`     |
| `aria-live`        | Announce dynamic content changes                 | `<div aria-live="polite">`              |
| `aria-busy`        | Indicate loading state                           | `<div aria-busy="true">`                |

```typescript
// ✅ CORRECT - Proper ARIA usage
export const Accordion: React.FC<AccordionProps> = ({ title, children, id }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentId = `${id}-content`
  const headerId = `${id}-header`

  return (
    <div className="accordion">
      <h3>
        <button
          id={headerId}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded(!isExpanded)}
          className="accordion-trigger"
        >
          {title}
          <span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
        </button>
      </h3>
      <div
        id={contentId}
        role="region"
        aria-labelledby={headerId}
        hidden={!isExpanded}
        className="accordion-content"
      >
        {children}
      </div>
    </div>
  )
}
```

#### Color and Contrast Requirements

For detailed color contrast requirements, see [toastmasters-brand-guidelines.md](./toastmasters-brand-guidelines.md).

Key requirements:

- Normal text (< 18pt) MUST have 4.5:1 contrast ratio
- Large text (≥ 18pt or ≥ 14pt bold) MUST have 3:1 contrast ratio
- Interactive elements MUST have 3:1 contrast against adjacent colors
- Color MUST NOT be the only means of conveying information

```typescript
// ✅ CORRECT - Status indicator with multiple cues
export const StatusBadge: React.FC<{ status: 'success' | 'error' | 'warning' }> = ({
  status,
}) => {
  const config = {
    success: { icon: '✓', label: 'Success', className: 'bg-green-100 text-green-800' },
    error: { icon: '✕', label: 'Error', className: 'bg-red-100 text-red-800' },
    warning: { icon: '!', label: 'Warning', className: 'bg-yellow-100 text-yellow-800' },
  }

  const { icon, label, className } = config[status]

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded ${className}`}>
      <span aria-hidden="true" className="mr-1">{icon}</span>
      {label}
    </span>
  )
}
```

#### Accessibility Testing Requirements

- All components MUST pass automated accessibility tests (axe-core)
- Manual keyboard navigation testing MUST be performed
- Screen reader testing SHOULD be performed for complex interactions
- Color contrast MUST be validated using automated tools

```typescript
// ✅ CORRECT - Accessibility test
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('DistrictCard Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<DistrictCard district={mockDistrict} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should be keyboard navigable', () => {
    render(<DistrictCard district={mockDistrict} onClick={mockClick} />)
    const card = screen.getByRole('button')
    card.focus()
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(mockClick).toHaveBeenCalled()
  })
})
```

### 8.4 Security

Frontend code MUST implement security measures to protect against common web vulnerabilities.

#### XSS Prevention Requirements

Cross-Site Scripting (XSS) attacks MUST be prevented through proper data handling:

| Attack Vector     | Prevention                    | Implementation                                     |
| ----------------- | ----------------------------- | -------------------------------------------------- |
| **Reflected XSS** | Sanitize URL parameters       | Validate and encode query params                   |
| **Stored XSS**    | Sanitize user input           | Never use `dangerouslySetInnerHTML` with user data |
| **DOM-based XSS** | Avoid direct DOM manipulation | Use React's virtual DOM                            |

```typescript
// ❌ FORBIDDEN - Direct HTML injection
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ❌ FORBIDDEN - Unvalidated URL parameters
const searchTerm = new URLSearchParams(location.search).get('q')
<div>{searchTerm}</div>  // Could contain malicious scripts

// ✅ CORRECT - Sanitized user input
import DOMPurify from 'dompurify'

const sanitizedContent = DOMPurify.sanitize(userInput)
<div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />

// ✅ CORRECT - Validated and encoded URL parameters
const searchTerm = new URLSearchParams(location.search).get('q') ?? ''
const sanitizedTerm = encodeURIComponent(searchTerm)
<div>{sanitizedTerm}</div>
```

#### Secure Data Handling Requirements

Sensitive data MUST be handled securely:

```typescript
// ❌ FORBIDDEN - Logging sensitive data
console.log('User data:', userData)

// ❌ FORBIDDEN - Storing sensitive data in localStorage
localStorage.setItem('authToken', token)

// ❌ FORBIDDEN - Exposing sensitive data in URLs
navigate(`/user?token=${authToken}`)

// ✅ CORRECT - Use secure storage for tokens
// Tokens should be stored in httpOnly cookies (handled by backend)
// Or in memory for short-lived sessions

// ✅ CORRECT - Sanitize data before display
const displayName = sanitizeForDisplay(user.name)
```

#### Content Security Policy Compliance

Frontend code MUST be compatible with strict Content Security Policy:

```typescript
// ❌ FORBIDDEN - Inline event handlers
<button onclick="handleClick()">Click</button>

// ❌ FORBIDDEN - eval() or Function() constructor
eval(userCode)
new Function(userCode)()

// ❌ FORBIDDEN - Inline styles from user input
<div style={userProvidedStyles} />

// ✅ CORRECT - React event handlers
<button onClick={handleClick}>Click</button>

// ✅ CORRECT - Validated style objects
const safeStyles = validateStyles(userStyles)
<div style={safeStyles} />
```

#### URL and Link Security

External links and URLs MUST be handled securely:

```typescript
// ✅ CORRECT - Safe external link handling
interface ExternalLinkProps {
  href: string
  children: React.ReactNode
}

export const ExternalLink: React.FC<ExternalLinkProps> = ({ href, children }) => {
  // Validate URL protocol
  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }

  if (!isValidUrl(href)) {
    console.warn('Invalid URL blocked:', href)
    return <span>{children}</span>
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"  // REQUIRED for external links
    >
      {children}
    </a>
  )
}
```

#### Form Security Requirements

Forms MUST implement security best practices:

```typescript
// ✅ CORRECT - Secure form handling
export const SecureForm: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Prevent double submission
    if (isSubmitting) return
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)

    // Validate input before submission
    const email = formData.get('email')
    if (!isValidEmail(email)) {
      setError('Invalid email format')
      setIsSubmitting(false)
      return
    }

    try {
      await submitForm(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <input
        type="email"
        name="email"
        autoComplete="email"
        required
        aria-describedby="email-error"
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
```

#### Security Checklist for Components

Before deploying components that handle user input:

- [ ] User input is validated and sanitized
- [ ] No use of `dangerouslySetInnerHTML` with user data
- [ ] External links use `rel="noopener noreferrer"`
- [ ] Sensitive data is not logged or exposed in URLs
- [ ] Forms prevent double submission
- [ ] URL parameters are validated before use

### 8.5 Modal Dialogs

For comprehensive modal dialog implementation patterns, see [modal-dialogs.md](./modal-dialogs.md).

Key requirements from that document:

- Modal overlays MUST use inline `style` attributes for fixed positioning
- Modal content MUST use inline `style` attributes for width constraints
- Modals SHOULD use `createPortal` to render at document body level
- Modals MUST include proper ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`)
- Modals MUST support keyboard dismissal (Escape key)
- Modals SHOULD implement focus trapping

#### Modal Integration with Error Boundaries

Modals SHOULD be wrapped in error boundaries to prevent modal errors from crashing the application:

```typescript
// ✅ CORRECT - Modal with error boundary
export const SafeModal: React.FC<ModalProps> = (props) => (
  <ErrorBoundary
    fallback={
      <div role="alert" className="p-4 text-center">
        <p>Unable to display this dialog.</p>
        <button onClick={props.onClose}>Close</button>
      </div>
    }
  >
    <Modal {...props} />
  </ErrorBoundary>
)
```

#### Modal Loading States

Modals with async content MUST show appropriate loading states:

```typescript
// ✅ CORRECT - Modal with loading state
export const DistrictDetailModal: React.FC<{ districtId: string; onClose: () => void }> = ({
  districtId,
  onClose,
}) => {
  const { data, isLoading, error } = useDistrict(districtId)

  return (
    <Modal onClose={onClose} title="District Details">
      {isLoading && <ModalContentSkeleton />}
      {error && <ErrorDisplay error={error} onRetry={() => {}} />}
      {data && <DistrictDetails district={data} />}
    </Modal>
  )
}
```

---

## 9. Firebase Hosting

This section defines mandatory standards for deploying the frontend application to Firebase Hosting, including build output organization, caching strategies, CDN behavior, environment configuration, and SPA routing.

### 9.1 Build Output and Asset Organization

The frontend build process MUST produce a structured output directory optimized for Firebase Hosting deployment.

#### Build Output Directory

The build output MUST be placed in the `dist/` directory (configured in `vite.config.ts`):

```text
frontend/dist/
├── index.html              # Main HTML entry point
├── assets/
│   ├── index-[hash].js     # Main JavaScript bundle
│   ├── index-[hash].css    # Main CSS bundle
│   ├── vendor-[hash].js    # Third-party dependencies (code-split)
│   └── [chunk]-[hash].js   # Lazy-loaded route chunks
├── fonts/
│   ├── Montserrat-*.woff2  # Headline font files
│   └── SourceSans3-*.woff2 # Body font files
├── images/
│   ├── logo.svg            # Application logo
│   └── icons/              # Icon assets
└── favicon.ico             # Browser favicon
```

#### Asset Organization Requirements

| Asset Type         | Location       | Naming Convention   | Rationale                               |
| ------------------ | -------------- | ------------------- | --------------------------------------- |
| JavaScript bundles | `dist/assets/` | `[name]-[hash].js`  | Content-hash enables immutable caching  |
| CSS bundles        | `dist/assets/` | `[name]-[hash].css` | Content-hash enables immutable caching  |
| Fonts              | `dist/fonts/`  | Original filename   | Fonts rarely change, separate directory |
| Images             | `dist/images/` | Original or hashed  | Depends on whether image changes        |
| HTML               | `dist/`        | `index.html`        | Must not be cached                      |
| Favicon            | `dist/`        | `favicon.ico`       | Standard location                       |

#### Vite Build Configuration

The Vite configuration MUST produce optimized output for Firebase Hosting:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Generate source maps for production debugging
    sourcemap: true,
    // Chunk splitting for optimal caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunk for better caching
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Separate React Query for independent updates
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
})
```

#### Build Output Requirements

- JavaScript and CSS files MUST include content hashes in filenames
- The `index.html` file MUST NOT include a hash (it's the entry point)
- Source maps SHOULD be generated for production debugging
- Vendor dependencies SHOULD be split into separate chunks for better caching
- Build output MUST be reproducible given the same source code

### 9.2 Cache-Control Headers

Cache-control headers MUST be configured to optimize performance while ensuring users receive updated content when deployments occur.

#### Cache Strategy Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CACHE STRATEGY OVERVIEW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  IMMUTABLE (1 year)          MODERATE (1 day)         NO CACHE          │
│  ┌─────────────────┐         ┌─────────────────┐     ┌─────────────────┐│
│  │ JS bundles      │         │ Images          │     │ index.html      ││
│  │ CSS bundles     │         │ (non-hashed)    │     │ service-worker  ││
│  │ Fonts           │         │                 │     │ manifest.json   ││
│  │ (content-hashed)│         │                 │     │                 ││
│  └─────────────────┘         └─────────────────┘     └─────────────────┘│
│                                                                          │
│  Rationale:                  Rationale:              Rationale:         │
│  Hash changes when           May change without      Must always fetch  │
│  content changes,            hash change,            latest version     │
│  safe to cache forever       moderate caching        for updates        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Cache-Control Header Configuration

The following cache-control headers MUST be configured in `firebase.json`:

| Asset Type               | Cache-Control Value                   | Max-Age | Rationale                          |
| ------------------------ | ------------------------------------- | ------- | ---------------------------------- |
| **JS bundles** (hashed)  | `public, max-age=31536000, immutable` | 1 year  | Content-hash ensures cache busting |
| **CSS bundles** (hashed) | `public, max-age=31536000, immutable` | 1 year  | Content-hash ensures cache busting |
| **Fonts**                | `public, max-age=31536000, immutable` | 1 year  | Fonts rarely change                |
| **Images** (hashed)      | `public, max-age=31536000, immutable` | 1 year  | Hash ensures cache busting         |
| **Images** (non-hashed)  | `public, max-age=86400`               | 1 day   | May change without hash            |
| **index.html**           | `no-cache, no-store, must-revalidate` | 0       | Must always fetch latest           |
| **service-worker.js**    | `no-cache, no-store, must-revalidate` | 0       | Must always fetch latest           |
| **manifest.json**        | `no-cache, no-store, must-revalidate` | 0       | Must always fetch latest           |

#### Firebase.json Headers Configuration

```json
{
  "hosting": {
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(woff|woff2|ttf|otf|eot)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          },
          {
            "key": "Access-Control-Allow-Origin",
            "value": "*"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=86400"
          }
        ]
      },
      {
        "source": "/index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      },
      {
        "source": "/service-worker.js",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      },
      {
        "source": "/manifest.json",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      }
    ]
  }
}
```

#### Cache Header Requirements

- Hashed assets MUST use `immutable` directive to prevent revalidation requests
- Entry point files (`index.html`, `service-worker.js`) MUST NOT be cached
- Font files MUST include `Access-Control-Allow-Origin: *` for cross-origin loading
- Cache headers MUST be tested after deployment to verify correct configuration

### 9.3 CDN Behavior and Cache Invalidation

Firebase Hosting uses a global CDN to serve content from edge locations close to users. Understanding CDN behavior is essential for optimal performance and correct cache invalidation.

#### CDN Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FIREBASE HOSTING CDN                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐     ┌──────────────────┐     ┌──────────────────────────┐ │
│  │  User    │────►│  Edge Location   │────►│  Firebase Origin         │ │
│  │  Browser │     │  (CDN Cache)     │     │  (Source of Truth)       │ │
│  └──────────┘     └──────────────────┘     └──────────────────────────┘ │
│       │                   │                           │                  │
│       │                   │                           │                  │
│       ▼                   ▼                           ▼                  │
│   Browser Cache      Edge Cache                  Origin Files           │
│   (per user)         (per region)                (deployed content)     │
│                                                                          │
│  CACHE HIT FLOW:                                                        │
│  User → Edge (HIT) → Response                                           │
│                                                                          │
│  CACHE MISS FLOW:                                                       │
│  User → Edge (MISS) → Origin → Edge (cache) → Response                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### CDN Behavior Characteristics

| Behavior                | Description                               | Implication                              |
| ----------------------- | ----------------------------------------- | ---------------------------------------- |
| **Global Distribution** | Content served from nearest edge location | Low latency for users worldwide          |
| **Automatic SSL**       | HTTPS enabled by default                  | Secure connections without configuration |
| **HTTP/2 Support**      | Multiplexed connections                   | Faster parallel asset loading            |
| **Compression**         | Automatic gzip/brotli compression         | Reduced transfer sizes                   |
| **Cache Propagation**   | Changes propagate to all edges            | May take minutes for global consistency  |

#### Cache Invalidation on Deployment

Firebase Hosting automatically invalidates CDN caches when new content is deployed:

1. **Deployment triggers invalidation**: When `firebase deploy` completes, the CDN cache is invalidated
2. **Atomic deployments**: All files are deployed atomically—users see either old or new version, never mixed
3. **Propagation delay**: Cache invalidation propagates globally within minutes (typically < 5 minutes)
4. **Version immutability**: Once deployed, a version's content cannot change

#### Cache Invalidation Requirements

- Deployments MUST use `firebase deploy` to ensure proper cache invalidation
- Manual cache purging SHOULD NOT be necessary under normal circumstances
- If cache issues occur, verify deployment completed successfully
- Content-hashed assets do not require explicit invalidation (new hash = new URL)

#### Handling Cache Invalidation Edge Cases

| Scenario                         | Behavior                  | Mitigation                                   |
| -------------------------------- | ------------------------- | -------------------------------------------- |
| **Deployment in progress**       | Users may see old version | Atomic deployment ensures consistency        |
| **Browser has stale index.html** | May load old JS/CSS       | `no-cache` on index.html forces revalidation |
| **CDN edge not yet updated**     | May serve old content     | Wait for propagation (< 5 minutes)           |
| **Service worker caching**       | May serve cached content  | Implement proper SW update strategy          |

#### Service Worker Cache Considerations

If the application uses a service worker:

```typescript
// Service worker update strategy
self.addEventListener('install', event => {
  // Skip waiting to activate immediately
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  // Clear old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CURRENT_CACHE_NAME)
          .map(name => caches.delete(name))
      )
    })
  )
})
```

Service worker requirements:

- Service worker file MUST NOT be cached (`no-cache, no-store, must-revalidate`)
- Service worker SHOULD implement `skipWaiting()` for immediate activation
- Old caches MUST be cleared on service worker activation
- Users SHOULD be notified when a new version is available

### 9.4 Environment Configuration

Frontend builds MUST support environment-specific configuration for different deployment targets (development, staging, production).

#### Environment Configuration Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENVIRONMENT CONFIGURATION FLOW                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  BUILD TIME                              RUNTIME                         │
│  ┌─────────────────────────────┐        ┌─────────────────────────────┐ │
│  │ .env.development            │        │ window.__ENV__ (optional)   │ │
│  │ .env.staging                │───────►│ or                          │ │
│  │ .env.production             │        │ Baked into bundle           │ │
│  └─────────────────────────────┘        └─────────────────────────────┘ │
│                                                                          │
│  Vite processes VITE_* variables at build time                          │
│  Variables are replaced with actual values in the bundle                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Environment Files

Environment configuration MUST use Vite's environment file convention:

| File               | Purpose                                  | Git Status |
| ------------------ | ---------------------------------------- | ---------- |
| `.env`             | Default values for all environments      | Committed  |
| `.env.local`       | Local overrides (developer-specific)     | Ignored    |
| `.env.development` | Development environment values           | Committed  |
| `.env.staging`     | Staging environment values               | Committed  |
| `.env.production`  | Production environment values            | Committed  |
| `.env.*.local`     | Local overrides for specific environment | Ignored    |

#### Environment Variable Naming

All environment variables exposed to the frontend MUST be prefixed with `VITE_`:

```bash
# .env.production
VITE_API_URL=https://toast-stats.web.app/api
VITE_ENVIRONMENT=production
VITE_ENABLE_ANALYTICS=true
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

```bash
# .env.staging
VITE_API_URL=https://staging-toast-stats.web.app/api
VITE_ENVIRONMENT=staging
VITE_ENABLE_ANALYTICS=false
VITE_SENTRY_DSN=
```

```bash
# .env.development
VITE_API_URL=http://localhost:5001/api
VITE_ENVIRONMENT=development
VITE_ENABLE_ANALYTICS=false
VITE_SENTRY_DSN=
```

#### Accessing Environment Variables

Environment variables MUST be accessed through `import.meta.env`:

```typescript
// ✅ CORRECT - Access environment variables
const apiUrl = import.meta.env.VITE_API_URL
const environment = import.meta.env.VITE_ENVIRONMENT
const analyticsEnabled = import.meta.env.VITE_ENABLE_ANALYTICS === 'true'

// ✅ CORRECT - Type-safe environment configuration
// src/config/environment.ts
interface EnvironmentConfig {
  apiUrl: string
  environment: 'development' | 'staging' | 'production'
  enableAnalytics: boolean
  sentryDsn: string | undefined
}

export const config: EnvironmentConfig = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:5001/api',
  environment:
    (import.meta.env.VITE_ENVIRONMENT as EnvironmentConfig['environment']) ??
    'development',
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  sentryDsn: import.meta.env.VITE_SENTRY_DSN || undefined,
}

// Validate required configuration
if (!config.apiUrl) {
  throw new Error('VITE_API_URL environment variable is required')
}
```

#### TypeScript Environment Type Definitions

Environment variables MUST be typed in `src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production'
  readonly VITE_ENABLE_ANALYTICS: string
  readonly VITE_SENTRY_DSN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

#### CI/CD Environment Configuration

Environment variables for CI/CD builds MUST be set in the build pipeline:

```yaml
# GitHub Actions example
- name: Build frontend (production)
  run: npm run build
  working-directory: frontend
  env:
    VITE_API_URL: https://toast-stats.web.app/api
    VITE_ENVIRONMENT: production
    VITE_ENABLE_ANALYTICS: true
```

#### Environment Configuration Requirements

- All frontend environment variables MUST be prefixed with `VITE_`
- Sensitive values (API keys, secrets) MUST NOT be included in frontend environment variables
- Environment files with sensitive local values MUST be added to `.gitignore`
- TypeScript type definitions MUST be provided for all environment variables
- A centralized configuration module SHOULD validate and export typed configuration
- Default values SHOULD be provided for optional configuration

#### Prohibited Environment Patterns

```typescript
// ❌ FORBIDDEN - Accessing process.env in frontend code
const apiUrl = process.env.API_URL // Not available in browser!

// ❌ FORBIDDEN - Non-prefixed environment variables
const apiUrl = import.meta.env.API_URL // Won't be exposed by Vite

// ❌ FORBIDDEN - Sensitive data in frontend environment
const apiSecret = import.meta.env.VITE_API_SECRET // Never expose secrets!

// ✅ CORRECT - Properly prefixed and accessed
const apiUrl = import.meta.env.VITE_API_URL
```

### 9.5 SPA Routing and Rewrites

Single Page Application (SPA) routing requires proper configuration to handle client-side navigation and API proxying.

#### SPA Routing Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SPA ROUTING FLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  REQUEST: https://toast-stats.web.app/districts/42                      │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Firebase Hosting                               │   │
│  │                                                                    │   │
│  │  1. Check if /districts/42 exists as static file                  │   │
│  │     → NO (it's a client-side route)                               │   │
│  │                                                                    │   │
│  │  2. Apply rewrite rules:                                          │   │
│  │     - /api/** → Cloud Run backend                                 │   │
│  │     - /** → /index.html (SPA fallback)                            │   │
│  │                                                                    │   │
│  │  3. Serve /index.html                                             │   │
│  │                                                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    React Router (Client-Side)                     │   │
│  │                                                                    │   │
│  │  4. React Router reads URL: /districts/42                         │   │
│  │  5. Renders DistrictDetailPage component                          │   │
│  │  6. Component fetches data from /api/districts/42                 │   │
│  │                                                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Firebase.json Rewrite Configuration

The `firebase.json` file MUST configure rewrites for SPA routing and API proxying:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "toast-stats-backend",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

#### Rewrite Rules Explanation

| Rule             | Source Pattern | Destination       | Purpose                       |
| ---------------- | -------------- | ----------------- | ----------------------------- |
| **API Proxy**    | `/api/**`      | Cloud Run service | Route API requests to backend |
| **SPA Fallback** | `**`           | `/index.html`     | Handle client-side routes     |

#### Rewrite Rule Order

Rewrite rules are evaluated in order. The configuration MUST follow this order:

1. **API routes first**: `/api/**` routes MUST be defined before the SPA fallback
2. **Static files**: Firebase automatically serves static files if they exist
3. **SPA fallback last**: The `**` catch-all MUST be the last rewrite rule

#### API Proxy Configuration

The API proxy rewrite MUST be configured to route requests to Cloud Run:

```json
{
  "source": "/api/**",
  "run": {
    "serviceId": "toast-stats-backend",
    "region": "us-central1"
  }
}
```

| Property    | Value                 | Description                           |
| ----------- | --------------------- | ------------------------------------- |
| `source`    | `/api/**`             | Match all paths starting with `/api/` |
| `serviceId` | `toast-stats-backend` | Cloud Run service name                |
| `region`    | `us-central1`         | Cloud Run service region              |

#### SPA Fallback Configuration

The SPA fallback MUST route all unmatched requests to `index.html`:

```json
{
  "source": "**",
  "destination": "/index.html"
}
```

This enables:

- Direct navigation to client-side routes (e.g., `/districts/42`)
- Browser refresh on any route
- Deep linking to specific pages

#### Complete Firebase.json Configuration

The complete `firebase.json` configuration combining all requirements:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "toast-stats-backend",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
          },
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains; preload"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(woff|woff2|ttf|otf|eot)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          },
          {
            "key": "Access-Control-Allow-Origin",
            "value": "*"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=86400"
          }
        ]
      },
      {
        "source": "/index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      },
      {
        "source": "/service-worker.js",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      },
      {
        "source": "/manifest.json",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      }
    ]
  }
}
```

#### Routing Requirements

- API routes MUST be proxied to Cloud Run using the `run` rewrite type
- The SPA fallback MUST be the last rewrite rule
- Static files MUST be served directly without rewriting
- The `public` directory MUST match the Vite build output directory (`dist`)
- Security headers MUST be applied to all responses

#### Testing Routing Configuration

After deployment, verify routing works correctly:

```bash
# Test SPA routing (should return index.html)
curl -I https://toast-stats.web.app/districts/42
# Expected: 200 OK, Content-Type: text/html

# Test API proxy (should route to Cloud Run)
curl https://toast-stats.web.app/api/health
# Expected: JSON response from backend

# Test static asset (should return with cache headers)
curl -I https://toast-stats.web.app/assets/index-abc123.js
# Expected: 200 OK, Cache-Control: public, max-age=31536000, immutable
```

---

## 10. Final Rules

> **Follow the established project structure for consistency.**  
> **Use TypeScript strictly—no `any` types allowed.**  
> **Comply with brand guidelines for all visual elements.**  
> **Co-locate tests with source files for maintainability.**  
> **Use path aliases for cross-feature imports.**  
> **Use functional components exclusively—class components are prohibited.**  
> **Follow hooks rules strictly—no conditional or nested hook calls.**  
> **Use React Query for all server state—no manual fetch in useEffect.**  
> **Prefer composition over inheritance for component reuse.**  
> **Implement error boundaries at appropriate levels to prevent crashes.**  
> **Use skeleton screens for loading states to prevent layout shifts.**  
> **Ensure WCAG AA compliance for all interactive components.**  
> **Sanitize all user input to prevent XSS attacks.**  
> **Follow modal-dialogs.md for all modal implementations.**  
> **Configure Firebase Hosting with proper cache headers and SPA rewrites.**  
> **Use content-hashed filenames for immutable caching of JS and CSS.**  
> **Never cache index.html—always fetch the latest version.**
