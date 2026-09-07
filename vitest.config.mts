import { defineConfig } from 'vitest/config'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local', quiet: true })

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'rls',
          include: ['tests/rls/**/*.test.ts'],
          environment: 'node',
          // Les tests d'isolation partagent une base : ils s'exécutent en série
          // pour que chaque assertion porte sur un etat connu.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
