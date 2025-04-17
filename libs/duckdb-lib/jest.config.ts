/* eslint-disable */
export default {
  displayName: 'duckdb',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.m?[tj]s$': ['@swc/jest'],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  coverageDirectory: '../../coverage/libs/duckdb',
};
