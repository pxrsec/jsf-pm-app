/* eslint-disable @typescript-eslint/no-empty-object-type */
type Messages = typeof import("../../messages/en-US.json");

declare global {
  // Use type safe message keys with `next-intl`
  interface IntlMessages extends Messages {}
}

export {};
