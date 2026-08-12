import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
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
