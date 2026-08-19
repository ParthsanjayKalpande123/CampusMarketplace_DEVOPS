'use strict';

module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2022: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-var': 'error',
    'prefer-const': 'error',
    strict: ['error', 'global'],
    eqeqeq: ['error', 'always'],
    'no-shadow': 'warn',
    'no-return-await': 'error',
    'require-await': 'warn',
  },
  ignorePatterns: ['node_modules/', 'coverage/', 'public/'],
};
