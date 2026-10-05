/** @type {import('jest').Config} */
export default {
  runner: "jest-light-runner/child-process",
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  roots: ["<rootDir>/test", "<rootDir>/src"],
  cacheDirectory: "<rootDir>/.preview/jest-cache",
  maxWorkers: 2,
  transform: {},
  setupFilesAfterEnv: ["<rootDir>/test/setup.mjs"],
};
