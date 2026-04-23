import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "extension/dist/**",
    "extension/node_modules/**",
    "next-env.d.ts",
    // Local/browser test artifacts:
    "coverage/**",
    "playwright-report/**",
    "playwright-screenshots/**",
    "test-results/**",
    "debug-*.js",
    "inspect-phase1.js",
  ]),
]);

export default eslintConfig;
