import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["es-MX", "en-US"],
  defaultLocale: "es-MX",
  localePrefix: {
    mode: "as-needed",
    prefixes: {
      "en-US": "/en",
    },
  },
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
