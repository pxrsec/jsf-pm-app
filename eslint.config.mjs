import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Prisma is forbidden. Use Supabase client boundaries and migrations instead.",
            },
            {
              name: "prisma",
              message:
                "Prisma is forbidden. Use Supabase client boundaries and migrations instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/app/!(api)/**",
      "src/components/**",
      "src/hooks/**",
      "src/lib/!(supabase/admin.ts)**",
      "proxy.ts",
      "src/proxy.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "Privileged admin Supabase client (src/lib/supabase/admin) must not be imported in client components, shared modules, or middleware.",
            },
            {
              name: "src/lib/supabase/admin",
              message:
                "Privileged admin Supabase client (src/lib/supabase/admin) must not be imported in client components, shared modules, or middleware.",
            },
            {
              name: "@/lib/notifications/config",
              message:
                "Notification provider configuration and adapters are server-only and cannot be imported in client components, shared modules, or middleware.",
            },
            {
              name: "@/lib/notifications/types",
              message:
                "Notification provider configuration and adapters are server-only and cannot be imported in client components, shared modules, or middleware.",
            },
            {
              name: "@/lib/notifications/channel-adapters",
              message:
                "Notification provider configuration and adapters are server-only and cannot be imported in client components, shared modules, or middleware.",
            },
            {
              name: "@/lib/notifications/errors",
              message:
                "Notification provider configuration and adapters are server-only and cannot be imported in client components, shared modules, or middleware.",
            },
            {
              name: "src/lib/notifications/config",
              message:
                "Notification provider configuration and adapters are server-only and cannot be imported in client components, shared modules, or middleware.",
            },
            {
              name: "src/lib/notifications/types",
              message:
                "Notification provider configuration and adapters are server-only and cannot be imported in client components, shared modules, or middleware.",
            },
            {
              name: "src/lib/notifications/channel-adapters",
              message:
                "Notification provider configuration and adapters are server-only and cannot be imported in client components, shared modules, or middleware.",
            },
            {
              name: "src/lib/notifications/errors",
              message:
                "Notification provider configuration and adapters are server-only and cannot be imported in client components, shared modules, or middleware.",
            },
            {
              name: "@/lib/notifications/provider-endpoint-guards",
              message:
                "Notification provider endpoint guards are server-only and cannot be imported in client components, shared modules, or middleware.",
            },
            {
              name: "src/lib/notifications/provider-endpoint-guards",
              message:
                "Notification provider endpoint guards are server-only and cannot be imported in client components, shared modules, or middleware.",
            },
            {
              name: "@prisma/client",
              message:
                "Prisma is forbidden. Use Supabase client boundaries and migrations instead.",
            },
            {
              name: "prisma",
              message:
                "Prisma is forbidden. Use Supabase client boundaries and migrations instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/notifications/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "Privileged admin Supabase client (src/lib/supabase/admin) must not be imported in client components, shared modules, or middleware.",
            },
            {
              name: "src/lib/supabase/admin",
              message:
                "Privileged admin Supabase client (src/lib/supabase/admin) must not be imported in client components, shared modules, or middleware.",
            },
            {
              name: "@prisma/client",
              message:
                "Prisma is forbidden. Use Supabase client boundaries and migrations instead.",
            },
            {
              name: "prisma",
              message:
                "Prisma is forbidden. Use Supabase client boundaries and migrations instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/notifications/alert-evaluator-actions.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Prisma is forbidden. Use Supabase client boundaries and migrations instead.",
            },
            {
              name: "prisma",
              message:
                "Prisma is forbidden. Use Supabase client boundaries and migrations instead.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
