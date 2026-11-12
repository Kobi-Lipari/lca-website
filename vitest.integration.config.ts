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
        r2Buckets: ['CLUB_LOGOS'],
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
          ANTHROPIC_API_KEY: 'sk-ant-test-harness',
          // A made-up key for the links in optional email, used nowhere else: a test signs with env.MAIL_LINK_SECRET.
          MAIL_LINK_SECRET: 'harness-made-up-mail-link-key-0042',
          // Amazon SES's key for the harness: AKIDEXAMPLE is the example key id of AWS's own documentation, which
          // opens nothing, and the secret is made up; the harness's catch point checks each request's signature with it.
          SES_ACCESS_KEY_ID: 'AKIDEXAMPLE',
          SES_SECRET_ACCESS_KEY: 'harness-made-up-ses-secret-0042',
          // A made-up topic for the receiver of Amazon's reports, in the account of twelve zeros, which is no one's; the
          // harness's helper signs each message the tests post with a key and a certificate of its own.
          SES_SNS_TOPIC_ARN: 'arn:aws:sns:us-east-1:000000000000:lca-mail-events',
        },
      },
    }),
  ],
  test: {
    include: ['test/integration/**/*.test.ts'],
    setupFiles: ['./test/integration/setup.ts'],
  },
})