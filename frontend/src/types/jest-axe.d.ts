declare module 'jest-axe' {
  export function axe(element: Element | Document): Promise<any>
  export function toHaveNoViolations(): any
}

declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toHaveNoViolations(): T
    }
  }
}