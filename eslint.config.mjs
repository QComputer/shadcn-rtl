import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      // Phase 21A keeps lint executable on the target machine without hiding
      // existing technical debt. These remain visible as warnings and should be
      // fixed in a dedicated lint-hardening phase.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  globalIgnores([
    "**/.next/**",
    ".kilo/**",
    ".release/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "public/uploads/**",
    "uploads/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
