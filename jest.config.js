/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/backend'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  collectCoverageFrom: [
    'backend/**/*.ts',
    '!backend/__tests__/**',
    '!backend/index.ts'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  passWithNoTests: true
};

