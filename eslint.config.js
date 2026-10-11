// @ts-check
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import astro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "dist/",
      ".astro/",
      ".wrangler/",
      "coverage/",
      "playwright-report/",
      "test-results/",
      "worker-configuration.d.ts",
      // Generado por `pnpm db:types`.
      "src/infrastructure/supabase/database.types.ts",
      // El prototipo estático es material de referencia; se porta en la fase F4.
      "prototypes/",
      // Ejemplos de las reglas de Semgrep: código inseguro a propósito.
      ".semgrep/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Errores esperables como valores (Result), no excepciones sin tipo.
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      // `as` se permite (los tests lo usan para evitar el estrechamiento), pero no `<T>x`.
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "as" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      // TypeScript estricto exige `process.env["X"]` para índices: no forzar el punto.
      "@typescript-eslint/dot-notation": ["error", { allowIndexSignaturePropertyAccess: true }],
    },
  },
  ...astro.configs.recommended,
  ...astro.configs["jsx-a11y-strict"],
  {
    // El parser de Astro no soporta `projectService`; usa el tsconfig del proyecto.
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: { projectService: false, project: "./tsconfig.json" },
    },
  },
  {
    files: ["**/*.tsx"],
    ...jsxA11y.configs.strict,
  },
  {
    // Archivos de configuración en JS: sin chequeo de tipos.
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
);
