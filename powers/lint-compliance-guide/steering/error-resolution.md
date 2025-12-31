# Error Resolution Patterns and Strategies

This guide provides detailed patterns and strategies for safely fixing lint errors while maintaining code functionality and type safety.

## Safe `any` Type Elimination

### The Unknown-First Pattern

When removing `any` types to achieve lint compliance, always use `unknown` as an intermediate step:

```typescript
// BAD: Direct any casting
const result = data as any as SpecificType

// GOOD: Safe type assertion via unknown
const result = data as unknown as SpecificType
```

**Why this works:**

- `unknown` forces you to think about type safety
- TypeScript requires explicit type checking or assertion
- Prevents accidental type coercion bugs

### Helper Function Pattern

Create type-safe parsing utilities for common conversions:

```typescript
// Create reusable helpers
function parseIntSafe(value: unknown): number {
  return typeof value === 'string' ? parseInt(value, 10) : 0
}

function ensureString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseJsonSafe<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

// Usage
const userId = parseIntSafe(request.params.id)
const name = ensureString(userData.name)
const config = parseJsonSafe(configString, defaultConfig)
```

### Interface Creation Pattern

Define proper interfaces instead of using `Partial<RealType>`:

```typescript
// BAD: Partial real type
const mock: Partial<ToastmastersScraper> = {
  scrapeDistrictData: vi.fn(),
}

// GOOD: Dedicated mock interface
interface MockToastmastersScraper {
  scrapeDistrictData: Mock<Procedure | Constructable>
  scrapeClubData: Mock<Procedure | Constructable>
}

const mock: MockToastmastersScraper = {
  scrapeDistrictData: vi.fn(),
  scrapeClubData: vi.fn(),
}
```

## Test Mock Type Safety

### Complete Mock Interfaces

Always define all required properties for test mocks:

```typescript
// BAD: Incomplete mock
const mockUser = {
  id: 1,
  name: 'John',
  // Missing required properties
}

// GOOD: Complete mock interface
interface MockUser {
  id: number
  name: string
  email: string
  createdAt: Date
}

const mockUser: MockUser = {
  id: 1,
  name: 'John',
  email: 'john@example.com',
  createdAt: new Date(),
}
```

### Type-Safe Mock Creation

Use proper typing for mock return values:

```typescript
// BAD: Untyped mock
const mockFetch = vi.fn()

// GOOD: Typed mock with return type
const mockFetch = vi.fn<[string], Promise<Response>>()

// Even better: Mock with implementation
const mockFetch = vi
  .fn<[string], Promise<Response>>()
  .mockImplementation(async (url: string) => {
    return new Response(JSON.stringify({ data: 'test' }))
  })
```

### Null Safety in Tests

Add proper null checks before assertions:

```typescript
// BAD: No null check
expect(result.data.user.name).toBe('John')

// GOOD: Proper null checks
expect(result.data).toBeDefined()
expect(result.data?.user).toBeDefined()
expect(result.data?.user?.name).toBe('John')

// Even better: Use optional chaining with fallback
expect(result.data?.user?.name ?? 'unknown').toBe('John')
```

## Type Assertion Best Practices

### When Type Assertions Are Necessary

1. **Prefer**: `unknown as SpecificType`
2. **Avoid**: `value as any as SpecificType`
3. **Document**: Why the assertion is safe
4. **Plan**: Migration to proper typing

```typescript
// GOOD: Documented type assertion
// Safe assertion: API response validated by schema
const user = apiResponse as unknown as User

// BETTER: Type guard function
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'name' in obj
}

if (isUser(apiResponse)) {
  // TypeScript knows this is User type
  console.log(apiResponse.name)
}
```

### Type Guard Patterns

Create reusable type guards for complex validations:

```typescript
// Generic type guard helper
function hasProperty<T extends object, K extends string>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return prop in obj
}

// Specific type guards
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    hasProperty(error, 'message') &&
    hasProperty(error, 'code') &&
    typeof error.message === 'string' &&
    typeof error.code === 'number'
  )
}

// Usage
try {
  await apiCall()
} catch (error) {
  if (isApiError(error)) {
    console.log(`API Error ${error.code}: ${error.message}`)
  } else {
    console.log('Unknown error:', error)
  }
}
```

## Error Resolution Priority and Workflow

### Priority Order

Fix lint errors in this specific order:

1. **Critical**: Explicit `any` types (breaks both lint and type safety)
2. **High**: Incomplete mock interfaces (breaks type safety)
3. **Medium**: Missing null checks in tests (runtime safety)
4. **Low**: Style and formatting issues

### Verification Workflow

After fixing lint errors, follow this verification process:

```bash
# 1. Verify lint compliance
npm run lint
# Expected: 0 errors, 0 warnings

# 2. Verify TypeScript compilation
npx tsc --noEmit
# Expected: No TypeScript errors

# 3. Run tests to ensure functionality preserved
npm test
# Expected: All tests pass

# 4. Optional: Check type coverage improvement
npx type-coverage --detail
# Expected: Increased type coverage percentage
```

### Systematic Error Resolution

For large codebases with many errors:

```bash
# 1. Get baseline error count
npm run lint > lint-errors-before.txt

# 2. Fix errors by category (use grep to filter)
npm run lint | grep "no-explicit-any" | head -10
# Fix these 10 errors first

# 3. Verify progress
npm run lint > lint-errors-after.txt
diff lint-errors-before.txt lint-errors-after.txt

# 4. Commit incremental progress
git add .
git commit -m "fix: resolve 10 explicit any type errors"
```

## Common Anti-Patterns to Avoid

### Don't Use These Approaches

❌ **Using `@ts-ignore` to suppress lint errors**

```typescript
// BAD: Suppressing instead of fixing
// @ts-ignore
const result = data.someProperty
```

❌ **Converting `any` directly to specific types**

```typescript
// BAD: Direct casting without unknown
const user = apiData as User
```

❌ **Creating overly broad interfaces**

```typescript
// BAD: Too permissive
interface LooseUser {
  [key: string]: any
}
```

❌ **Disabling lint rules instead of fixing**

```typescript
// BAD: Disabling rules globally
/* eslint-disable @typescript-eslint/no-explicit-any */
```

❌ **Using Partial for test mocks**

```typescript
// BAD: Incomplete mock types
const mock: Partial<RealType> = { someProperty: 'value' }
```

### Use These Approaches Instead

✅ **Fix the underlying issue**

```typescript
// GOOD: Proper type definition
interface User {
  id: number
  name: string
  email: string
}
const result: User = parseUserData(data)
```

✅ **Use unknown for safe type assertions**

```typescript
// GOOD: Safe type assertion
const user = apiData as unknown as User
```

✅ **Create specific interfaces**

```typescript
// GOOD: Specific, complete interface
interface MockUser {
  id: number
  name: string
  email: string
}
```

✅ **Use targeted rule disables with justification**

```typescript
// GOOD: Specific disable with reason and timeline
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyData: any = thirdPartyLib.getData() // TODO: Add types in v2.0
```

## Advanced Patterns

### Generic Type Helpers

Create reusable generic helpers for common patterns:

```typescript
// API response wrapper
type ApiResponse<T> = {
  data: T
  status: number
  message: string
}

// Safe property access
type SafeAccess<T, K extends keyof T> = T[K] extends undefined ? never : T[K]

// Utility for making specific properties required
type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>

// Usage
type UserWithRequiredEmail = RequireFields<User, 'email'>
```

### Error Boundary Patterns

Create type-safe error handling patterns:

```typescript
// Result type for error handling
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

// Safe async function wrapper
async function safeAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

// Usage
const result = await safeAsync(() => fetchUserData(userId))
if (result.success) {
  console.log(result.data.name) // TypeScript knows this is safe
} else {
  console.error(result.error.message)
}
```

This comprehensive error resolution guide provides the patterns and strategies needed to safely eliminate lint errors while maintaining code quality and type safety.
