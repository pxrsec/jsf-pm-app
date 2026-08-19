declare module "jest-axe" {
  export function axe(
    html: Element | string,
    options?: Record<string, unknown>,
  ): Promise<unknown>;

  export const toHaveNoViolations: {
    toHaveNoViolations(
      this: unknown,
      received: unknown,
      ...args: unknown[]
    ): { pass: boolean; message: () => string };
  };
}

declare namespace Chai {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}
