import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Habilitar polyfills específicos para LangGraph
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Excluir polyfills que no necesitamos
      exclude: [
        'fs',
        'path',
        'url',
        'util',
        'stream',
        'crypto',
        'assert',
        'os',
        'events',
        'child_process',
        'cluster',
        'dgram',
        'dns',
        'http',
        'https',
        'net',
        'readline',
        'repl',
        'tls',
        'tty',
        'zlib',
        'vm'
      ],
      // Habilitar solo los que necesitamos
      protocolImports: true,
    })
  ],
  optimizeDeps: {
    include: ['buffer', 'process'],
    exclude: []
  }
})