import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.recommended],
  },
);
