import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'

// Tests run without the TanStack Start plugin from vite.config.ts: it rewrites
// module resolution for SSR, which loads a second copy of React and breaks
// hook tests ("Cannot read properties of null (reading 'useEffect')").
export default defineConfig({
  plugins: [viteTsConfigPaths({ projects: ['./tsconfig.json'] }), viteReact()],
  test: {
    environment: 'node',
  },
})
