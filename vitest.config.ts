import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/domain/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    include: ["src/**/*.test.ts"],
  },
});
