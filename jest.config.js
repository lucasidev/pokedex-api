/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.test.json' }],
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  // mongodb-memory-server downloads the mongod binary on a cold cache (CI),
  // which can take longer than jest's default 5s and would time out the
  // startInMemoryMongo hook. 30s gives the download room.
  testTimeout: 30_000,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/index.ts',
    // Infra adapters are thin wrappers around external clients (mongoose,
    // redis, pino transport). They are exercised by the running app and the
    // health checks, not unit-tested, so they are out of the coverage gate.
    '!src/shared/infra/database.ts',
    '!src/shared/infra/redis.ts',
    '!src/shared/infra/logger.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
