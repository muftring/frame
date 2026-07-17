import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(require('./package.json').version)
  },
  build: {
    outDir: 'dist/renderer'
  }
})
