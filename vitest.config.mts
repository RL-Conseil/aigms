import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local', quiet: true })

export default defineConfig({
  // Le meme alias que Next : un module teste importe ses voisins comme il le
  // fait en production, sans chemin relatif propre aux tests.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Fourni par Next, absent de node_modules : voir tests/helpers/server-only.ts.
      'server-only': fileURLToPath(new URL('./tests/helpers/server-only.ts', import.meta.url)),
    },
  },
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
