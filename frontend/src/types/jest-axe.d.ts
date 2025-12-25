declare module 'jest-axe' {
  export function axe(element: Element | Document): Promise<any>
  export function toHaveNoViolations(received: any): {
    message(): string
    pass: boolean
  }
}

declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toHaveNoViolations(): T
    }
  }
  
  namespace Vitest {
    interface Assertion<T = any> {
      toHaveNoViolations(): T
    }
  }
}