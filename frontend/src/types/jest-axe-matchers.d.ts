/**
 * `toHaveNoViolations` matcher typing for vitest 5 (#1529).
 *
 * NOT a re-declaration of the `jest-axe` module — that was the #1368/#1389/#1393
 * mistake (an ambient `declare module 'jest-axe'` outranks the installed
 * `@types/jest-axe`, see tasks/lessons). `axe()`, `RunOptions`, `AxeResults` and
 * the `toHaveNoViolations` matchers object all still come from
 * `@types/jest-axe`, untouched.
 *
 * What changed: `@types/jest-axe` publishes its assertion signature by
 * augmenting the global `jest.Matchers` namespace. Vitest 4 picked that up for
 * free because `@vitest/expect`'s `JestAssertion<T>` extended
 * `jest.Matchers<void, T>`. Vitest 5 inlined the `expect` package
 * (vitest-dev/vitest#10221) and dropped that `jest.Matchers` bridge, so the
 * augmentation no longer reaches `expect(...)` — 45 × TS2339
 * "Property 'toHaveNoViolations' does not exist on type 'Assertion<…>'".
 *
 * Vitest 5's supported extension point is the (deliberately empty) `Matchers`
 * interface exported from the `vitest` module; `Assertion` and
 * `AsymmetricMatchersContaining` both extend it, so one augmentation covers
 * every call form. This is the same mechanism
 * `@testing-library/jest-dom/types/vitest.d.ts` uses, which is why the jest-dom
 * matchers kept typechecking across the same major.
 *
 * Runtime behaviour is unchanged and always was: `jest-axe/extend-expect`
 * (imported by src/__tests__/setup.ts) registers the matcher via
 * `expect.extend`, and the axe suites ran green on vitest 5 before this file
 * existed. This is a types-only bridge.
 */
import 'vitest'

declare module 'vitest' {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>> {
    toHaveNoViolations(): R
  }
}
