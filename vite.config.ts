import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@aws-amplify/backend', replacement: path.resolve(__dirname, './src/empty.ts') },
      { find: '@aws-amplify/backend-cli', replacement: path.resolve(__dirname, './src/empty.ts') },
      { find: 'aws-cdk-lib', replacement: path.resolve(__dirname, './src/empty.ts') },
      { find: /^.*amplify\/data\/resource$/, replacement: path.resolve(__dirname, './src/empty.ts') }
    ],
  },
})
