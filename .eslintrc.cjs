/* Root ESLint config for the monorepo */
module.exports = {
  root: true,
  env: {
    es2020: true,
    node: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.base.json"],
    sourceType: "module"
  },
  plugins: ["@typescript-eslint", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  ignorePatterns: ["dist", "node_modules"],
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  },
  overrides: [
    {
      files: ["*.tsx"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "JSXOpeningElement:has(JSXAttribute[name.name='onClick']):not(:has(JSXAttribute[name.name='data-testid']))",
            message: "Interactive elements with onClick must have a data-testid attribute for E2E testing."
          }
        ]
      }
    }
  ]
};

