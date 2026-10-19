import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the @app/* path aliases declared in tsconfig.json.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['apps/**/*.spec.ts', 'libs/**/*.spec.ts'],
  },
});
