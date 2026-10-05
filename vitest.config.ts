import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    isolate: true,
    maxWorkers: 2,
    globals: false,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    allowOnly: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text-summary", "html", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      reportOnFailure: true,
    },
    projects: [
      { extends: true, test: { name: "unit", include: ["test/unit/**/*.test.ts"] } },
      {
        extends: true,
        test: { name: "integration", include: ["test/integration/**/*.test.ts"] },
      },
      {
        extends: true,
        test: { name: "e2e", include: ["test/e2e/**/*.test.ts"], testTimeout: 120_000 },
      },
      {
        extends: true,
        test: {
          name: "media",
          include: ["test/media/**/*.test.ts", "test/e2e/studies-assets.test.ts"],
          setupFiles: ["test/support/media.ts"],
          env: { CODEBOARD_TEST_MEDIA: "1" },
          testTimeout: 120_000,
        },
      },
    ],
  },
});
