import { defineConfig } from "vitest/config";
import path from "node:path";

/** tests/integration: the built app over HTTP against a real database. Run by scripts/test-integration.sh. */
export default defineConfig({
  test: { include: ["tests/integration/**/*.test.ts"], fileParallelism: false, testTimeout: 20_000 },
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
});
