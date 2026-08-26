import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import next from 'eslint-config-next';

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.emulator-data/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,
  {
    // Typed linting, scoped to source files so the config files themselves are not
    // dragged into the program.
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@google-cloud/storage',
              message: 'Use the StorageAdapter from @/lib/storage instead of the GCS SDK directly.',
            },
          ],
        },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // The GCS adapter is the one place allowed to touch the SDK.
    files: ['src/lib/storage/gcs.adapter.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // These are console-driven tools; their output is the deliverable.
    files: ['scripts/**/*.{ts,mjs}', 'tests/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);
