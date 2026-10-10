import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relative : le site fonctionne sous https://<user>.github.io/<repo>/ comme en local.
export default defineConfig({
  base: './',
  plugins: [react()],
})
