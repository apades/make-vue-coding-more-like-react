import { describe, expect, it } from 'vitest'
import { transform } from '@babel/core'
import JSX, { type VueJSXPluginOptions } from '../src'
// import path from 'node:path'

const transpile = (source: string, options: VueJSXPluginOptions = {}) =>
  new Promise((resolve, reject) => {
    const nowFilename = import.meta.url
    ;(globalThis as any).__VITEST_FILENAME = nowFilename.replace('file:///', '')

    return transform(
      source,
      {
        filename: '',
        presets: null,
        plugins: [
          [JSX, options],
          [
            '@babel/plugin-transform-typescript',
            {
              isTSX: true,
              allExtensions: true,
            },
          ],
        ],
        configFile: false,
      },
      (error, result) => {
        if (error) {
          return reject(error)
        }
        resolve(result?.code)
      },
    )
  })

describe('jsx fn component define', () => {
  it('function', async () => {
    const code = `
    function App() {
      return <div>hello</div>
    }
    `
    expect(await transpile(code)).toMatchSnapshot()
  })

  it('arrowFunction', async () => {
    const code = `
    const App = () => {
      return <div>hello</div>
    }
    `
    expect(await transpile(code)).toMatchSnapshot()
  })
})

describe('jsx props define', () => {
  it('TypeLiteral Props', async () => {
    const code = `
    function App(props: {a: number}) {
      return <div>hello</div>
    }
    `
    expect(await transpile(code)).toMatchSnapshot()
  })

  it('TypeReference props', async () => {
    const code = `
    type Props = {
      a: number
    }
    function App(props: Props) {
      return <div>hello</div>
    }
    `
    expect(await transpile(code)).toMatchSnapshot()
  })

  it('Complex props', async () => {
    const code = `
    type PropsComplex = {
      b?: string
    }
    type PropsAnd = {
      a: number
    } & PropsComplex

    function CompAndRefer(props: PropsAnd) {
      return <div>hello</div>
    }

    function CompAndInner(params: {
      a: number
    } & PropsComplex) {
      return <div>hello</div>
    }

    type PropsUnion = {
      a: number
    } | PropsComplex

    function CompUnionRefer(props: PropsUnion) {
      return <div>hello</div>
    }

    function CompUnionInner(params: {
      a: number
    } | PropsComplex) {
      return <div>hello</div>
    }
    `
    expect(await transpile(code)).toMatchSnapshot()
  })

  it('Cross file type', async () => {
    const code = `
    import { Props } from './type'
    type FnProps = {
      a: string    
    } & Props
    function App(props: FnProps) {
      return <div>hello</div>
    }
    `
    expect(await transpile(code)).toMatchSnapshot()
  })
})
