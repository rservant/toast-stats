declare module 'jest-axe' {
  export function axe(element: Element | Document): Promise<unknown>
  export function toHaveNoViolations(received: unknown): {
    message(): string
    pass: boolean
  }
}

declare global {
  namespace Vi {
    interface Assertion<T = unknown> {
      toHaveNoViolations(): T
    }
  }
  
  namespace Vitest {
    interface Assertion<T = unknown> {
      toHaveNoViolations(): T
    }
  }
}