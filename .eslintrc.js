module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void somePromise()` is this codebase's deliberate fire-and-forget
    // idiom — only flag `void` in expression position.
    'no-void': ['warn', { allowAsStatement: true }],
  },
};
