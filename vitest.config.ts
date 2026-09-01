import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
  test: {
    projects: [
      {
        resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['tests/setup/unit.setup.ts'],
        },
      },
      {
        resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
        test: {
          name: 'rules',
          environment: 'node',
          include: ['tests/rules/**/*.test.ts'],
          testTimeout: 20_000,
          hookTimeout: 20_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
