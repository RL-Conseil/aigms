import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescriptConfig from 'eslint-config-next/typescript'

const config = [
  ...coreWebVitals,
  ...typescriptConfig,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'supabase/.temp/**',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Le client service_role contourne la RLS : il n'a rien a faire
              // dans un parcours applicatif.
              group: ['**/supabase/admin', '@/lib/supabase/admin'],
              message: "Le client service_role ne s'importe que depuis scripts/ et tests/.",
            },
          ],
        },
      ],
    },
  },
]

export default config
