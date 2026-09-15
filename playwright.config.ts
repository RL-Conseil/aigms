import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local', quiet: true })

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Le parcours est verifie sur un build de production : c'est ce qui sera
    // deploye.
    // Sans captcha : les tests ne resolvent pas un defi Turnstile, et la mire
    // refuserait de se connecter tant que la cle publique est presente. Le
    // captcha se verifie a la main sur la Preview, pas ici.
    command: 'npm run build && npm run start -- --port 3000 --hostname 127.0.0.1',
    env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: '' },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
