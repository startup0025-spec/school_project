const path = require("path");

const eslintJs = require(path.resolve(__dirname, "mobile/node_modules/@eslint/js"));
const tsParser = require(path.resolve(__dirname, "mobile/node_modules/@typescript-eslint/parser/dist/parser.js"));
const tsPlugin = require(path.resolve(__dirname, "mobile/node_modules/@typescript-eslint/eslint-plugin/dist/index.js"));
const reactHooksPlugin = require(path.resolve(__dirname, "mobile/node_modules/eslint-plugin-react-hooks"));
const reactPlugin = require(path.resolve(__dirname, "mobile/node_modules/eslint-plugin-react"));

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "**/local_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/android/**",
      "**/ios/**",
      "**/.expo/**",
      "**/.agents/**",
      "**/.git/**",
      "**/*.d.ts",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
      react: reactPlugin,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        jsx: true,
      },
    },
    rules: {
      ...eslintJs.configs.recommended.rules,
      ...tsPlugin.configs["eslint-recommended"].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-console": ["warn", { "allow": ["log", "warn", "error", "info"] }],
    },
  },
];
