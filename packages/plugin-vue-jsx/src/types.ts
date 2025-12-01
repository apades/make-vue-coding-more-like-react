import type { VueJSXPluginOptions } from '@mvcmlr/babel-plugin-jsx'
import type { FilterPattern } from 'vite'

export interface FilterOptions {
  include?: FilterPattern
  exclude?: FilterPattern
}

export interface Options extends VueJSXPluginOptions, FilterOptions {
  babelPlugins?: any[]
  /** @default ['defineComponent'] */
  defineComponentName?: string[]
  tsPluginOptions?: any
  /** @default 'babel' */
  tsTransform?: 'babel' | 'built-in'
}
