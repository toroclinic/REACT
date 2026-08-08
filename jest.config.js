// Minimal jest, deliberately.
//
// This app had no test runner at all — only @types/jest, which types tests
// nobody could run. That gap is why five drifted clinical classifiers survived
// here for three months after the same code was deleted from the web client.
//
// Scope is PURE MODULES ONLY: node environment, no react-native preset, no
// component rendering. Everything under test must be free of react-native
// imports by construction (see services/submitScreening.ts, which takes its
// collaborators as arguments precisely so it can be tested without a device).
// Widening this to render components means the RN preset, a transform
// allowlist for node_modules, and native mocks — a real project, and one to
// start deliberately rather than by accident.

module.exports = {
  testEnvironment: 'node',
  // babel-jest picks up babel.config.js, which carries the RN preset and so
  // handles the TypeScript syntax here.
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.(ts|tsx)'],
  // A run that matches nothing must fail. "0 tests passed" and "the runner
  // could not find the tests" are the same green tick otherwise, which is the
  // failure this whole codebase keeps re-learning.
  passWithNoTests: false,
};
