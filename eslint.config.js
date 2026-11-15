// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import functional from 'eslint-plugin-functional';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Browser and runtime globals the pure core must never touch. */
const shellGlobals = [
  'window',
  'document',
  'navigator',
  'location',
  'localStorage',
  'sessionStorage',
  'chrome',
  'browser',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'fetch',
].map((name) => ({ name, message: 'The core is pure: receive this through a port instead.' }));

const impureProperties = [
  { object: 'Date', property: 'now', message: 'Time is an input: pass it in on the command.' },
  { object: 'Math', property: 'random', message: 'Randomness is an input: pass a Roll in.' },
];

export default tseslint.config(
  { ignores: ['.output/**', '.wxt/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: true },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Spies on DOM methods are passed to expect() unbound on purpose.
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
  {
    // Build-time tooling: imperative pixel loops are fine here.
    files: ['scripts/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },

  // Functional core: domain/ and application/.
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    ignores: ['**/*.test.ts'],
    plugins: { functional },
    rules: {
      'functional/no-classes': 'error',
      'functional/no-this-expressions': 'error',
      'functional/no-let': 'error',
      'functional/immutable-data': 'error',
      'functional/no-throw-statements': 'error',
      'functional/no-try-statements': 'error',
      'functional/no-loop-statements': 'error',
      'functional/no-promise-reject': 'error',
      'functional/prefer-property-signatures': 'error',
      'functional/readonly-type': ['error', 'keyword'],
      'functional/prefer-readonly-type': 'off',
      'functional/type-declaration-immutability': [
        'error',
        {
          rules: [
            {
              identifiers: '.+',
              immutability: 'ReadonlyDeep',
              comparator: 'AtLeast',
              fixer: false,
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...shellGlobals],
      'no-restricted-properties': ['error', ...impureProperties],
    },
  },

  // Layer rule: imports only point down.
  {
    files: ['src/domain/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\./)',
              message: 'domain/ is pure and imports nothing outside domain/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/application/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\./|\\.\\./domain/)',
              message: 'application/ is pure and imports domain/ only.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)entrypoints(/|$)',
              message: 'infrastructure/ must not import entrypoints/.',
            },
          ],
        },
      ],
    },
  },

  prettier,
);
