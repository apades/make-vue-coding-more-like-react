import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as babel from '@babel/core'
import jsx from '@mvcmlr/plugin-vue-jsx'

const __dirname = import.meta.dirname
const resolve = (p: string) => path.resolve(__dirname, p)

describe('babel', () => {
  it('@vitejs/plugin-vue-jsx', async () => {
    console.log('__dirname', __dirname)
    const code = fs.readFileSync(resolve('../template/fc.tsx'), 'utf-8')

    const result = babel.transformSync(code, {
      babelrc: false,
      ast: true,
      plugins: [
        [
          // @ts-ignore
          await import('@babel/plugin-transform-typescript').then(
            (r) => r.default,
          ),
          {
            isTSX: true,
            allExtensions: true,
          },
        ],
        [jsx, {}],
      ],
      sourceMaps: true,
      sourceFileName: 'fc.tsx',
      configFile: false,
    })!

    console.log('result', result)
  })
})
