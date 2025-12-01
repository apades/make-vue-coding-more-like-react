import { defineConfig } from 'vite'
import vueJsx from '@mvcmlr/plugin-vue-jsx'
// import babelReact from '@babel/preset-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vueJsx({
      // options are passed on to @vue/babel-plugin-jsx
      mergeProps: true,
      enableObjectSlots: true,
    }),
  ],
  server: {
    watch: {
      ignored: ['!**/node_modules/@mvcmlr/plugin-vue-jsx/**'],
    },
  },
})
