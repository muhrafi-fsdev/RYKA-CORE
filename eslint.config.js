//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      'public/**',
      'scripts/**',
      'dist/**',
      '.output/**',
      '.tanstack/**',
      'src/routeTree.gen.ts',
      '*.config.js',
      '*.config.ts',
    ],
  },
  ...tanstackConfig,
  {
    // Pengecekan defensif pada data MediaPipe/DOM sengaja dipertahankan;
    // tipe bilang non-null tetapi data runtime tidak dijamin. Tinjau per kasus.
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'warn',
    },
  },
]
