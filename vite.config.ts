import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Electron loads the production entry with `file://`, so emitted assets
  // must resolve relative to dist/index.html rather than the filesystem root.
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    // Electron checks use Node's built-in test runner (`node --test`), not Vitest.
    // Keeping them out of Vitest avoids treating their zero-suite files as failures.
    exclude: [...configDefaults.exclude, 'electron/**/*.test.cjs'],
  },
})
