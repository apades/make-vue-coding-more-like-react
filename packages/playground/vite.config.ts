import { defineConfig } from 'vite'
import vueJsx from '@mvcmlr/plugin-vue-jsx'
// import babelReact from '@babel/preset-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vueJsx()],
  server: {
    watch: {
      ignored: ['!**/node_modules/@mvcmlr/plugin-vue-jsx/**'],
    },
  },
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
    },
  },
})
