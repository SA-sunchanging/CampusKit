import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the @app/* path aliases declared in tsconfig.json. The app and lib tsconfigs
  // exclude spec files, so read the aliases through tsconfig.check.json, which includes them.
  plugins: [tsconfigPaths({ projects: ['./tsconfig.check.json'] })],
  test: {
    globals: true,
    root: './',
    include: ['apps/**/*.spec.ts', 'libs/**/*.spec.ts'],
  },
});
