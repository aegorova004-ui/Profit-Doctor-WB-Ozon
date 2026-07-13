import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    coverage: {
      include: ["src/domain/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
