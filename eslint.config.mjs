import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  js.configs.recommended,
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "middleware/**/*.{ts,tsx}", "scripts/**/*.{js,mjs,ts}", "services/**/*.{ts,tsx}"],
    rules: {
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },
];

export default eslintConfig;
