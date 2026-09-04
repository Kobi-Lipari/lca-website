// vitest.integration.config.ts — integration tests inside the Workers runtime
// Uses the cloudflareTest() Vite plugin (current pool-workers API for
// Vitest 4; the old defineWorkersConfig/poolOptions form was removed).
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2024-08-01',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['DB'],
        bindings: {
          SUPABASE_URL: 'https://test-supabase.local',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
          STRIPE_SECRET_KEY: 'sk_test_harness',
          STRIPE_WEBHOOK_SECRET: 'whsec_test_harness_secret',
          RESEND_API_KEY: 're_test_harness',
          SITE_URL: 'https://www.louisianachess.org',
          FROM_EMAIL: 'noreply@louisianachess.org',
          CONTACT_EMAIL: 'contact@louisianachess.org',
          SUPPORT_EMAIL: 'support@louisianachess.org',
        },
      },
    }),
  ],
  test: {
    include: ['test/integration/**/*.test.ts'],
    setupFiles: ['./test/integration/setup.ts'],
  },
})