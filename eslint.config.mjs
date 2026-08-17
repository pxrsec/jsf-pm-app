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
      "src/app/**",
      "src/components/**",
      "src/hooks/**",
      "src/lib/!(supabase/admin.ts)**",
      "middleware.ts",
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
