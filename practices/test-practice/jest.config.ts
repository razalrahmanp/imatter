import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  globalSetup: "<rootDir>/src/__tests__/setup.ts",
  globalTeardown: "<rootDir>/src/__tests__/teardown.ts",
  coverageProvider: "v8",
  collectCoverageFrom: [
    "src/functions/**/*.ts",
    "src/shared/**/*.ts",
    "!src/**/__tests__/**",
    "!src/**/*.d.ts",
  ],
  coverageThresholds: {
    global: {
      lines: 80,
      branches: 80,
      functions: 80,
      statements: 80,
    },
  },
  coverageReporters: ["text", "lcov", "html"],
};

export default config;
