import { describe, expect, it } from 'vitest'
import { transform } from '@babel/core'
import JSX, { type VueJSXPluginOptions } from '../src'

const transpile = (source: string, options: VueJSXPluginOptions = {}) =>
  new Promise((resolve, reject) =>
    transform(
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
    ),
  )

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

  // TODO
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
})
