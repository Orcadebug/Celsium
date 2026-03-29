import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
    env: {
      FORGESYNC_AGENT_API_TOKEN: "test-secret-token",
    },
  },
});
