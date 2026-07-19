import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: https://<user>.github.io/jj-swoop/
const repoName = 'jj-swoop'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? `/${repoName}/` : '/',
}))
