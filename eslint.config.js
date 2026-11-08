import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["out/**", "dist/**", "release/**", "node_modules/**", ".claude/**"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ["src/main/**/*.ts", "src/core/**/*.ts", "scripts/**/*", "*.config.*"],
    languageOptions: { globals: globals.node },
  },
  {
    // The renderer and core never import Electron or Node built-ins directly.
    files: ["src/renderer/**/*.{ts,tsx}", "src/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["electron", "node:*", "@core/*"] }],
    },
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["electron", "@/*"] }],
    },
  },
);
