/* Lint for the site's own scripts (run: npm run lint in tests/). The pages are classic scripts that
   share one global scope (shared.js, supabase-client.js, the engines …), so undefined names are not
   checked here – the browser tests catch those. What it does catch: unused code, typos in comparisons,
   unreachable code, duplicate keys and similar slips. No imports, so it runs with the copy of ESLint in tests/. */
export default [
  {
    ignores: ["tests/**", "supabase/**", "**/node_modules/**"]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script"
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    rules: {
      "no-unused-vars": ["error", { vars: "local", args: "none", caughtErrors: "none" }],
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-dupe-else-if": "error",
      "no-unreachable": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-cond-assign": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "no-unsafe-negation": "error",
      "no-sparse-arrays": "error",
      "no-redeclare": "error",
      "no-shadow-restricted-names": "error",
      "eqeqeq": ["error", "smart"]
    }
  }
];
