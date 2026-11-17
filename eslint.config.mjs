// ESLint flat config. Run with `npm run lint`; `next build` also runs it and fails on errors.
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "data/**"] },

  // Next.js' own rules (React, hooks, accessibility, Next-specific) plus TypeScript.
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // A leading underscore marks a deliberately unused name; `const { a, ...rest }` drops `a` on purpose.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },

  // Plain Node.js files outside the Next.js bundle. They use require() by design.
  {
    files: ["websocket-server.js", "discord-presence.js", "scripts/**/*.js", "src/lib/admin/password.js"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  // Config and test files run directly by Node.
  {
    files: ["*.config.{js,mjs,ts}", "postcss.config.js", "tests/**/*.{ts,mjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
];

export default config;
