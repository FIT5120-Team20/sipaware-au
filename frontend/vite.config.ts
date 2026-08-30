import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { normalizePath } from 'vite'
import { defineConfig } from 'vitest/config'

function frontendDependencyPath(packageName: string): string {
  return normalizePath(
    fileURLToPath(new URL(`./node_modules/${packageName}`, import.meta.url)),
  )
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Root-level tests resolve their frontend-owned packages from frontend/.
  resolve:
    mode === 'test'
      ? {
          alias: [
            {
              find: '@testing-library',
              replacement: frontendDependencyPath('@testing-library'),
            },
            {
              find: 'fake-indexeddb',
              replacement: frontendDependencyPath('fake-indexeddb'),
            },
            {
              find: 'idb',
              replacement: frontendDependencyPath('idb'),
            },
            {
              find: 'react',
              replacement: frontendDependencyPath('react'),
            },
          ],
        }
      : undefined,
  server: {
    port: 5173,
    strictPort: true,
    ...(mode === 'test' ? { fs: { allow: ['..'] } } : {}),
  },
  test: {
    include: ['../tests/epic1/frontend/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    setupFiles: ['../tests/shared/frontend/setup.ts'],
  },
}))
