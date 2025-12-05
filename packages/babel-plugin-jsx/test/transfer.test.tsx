import { describe, expect, it } from 'vitest'
import { transform } from '@babel/core'
import { shallowMount } from '@vue/test-utils'
import * as vue from 'vue'
import JSX, { type VueJSXPluginOptions } from '../src'
// import path from 'node:path'

const transpile = (source: string, options: VueJSXPluginOptions = {}) =>
  new Promise<string>((resolve, reject) => {
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
        resolve(result?.code ?? '')
      },
    )
  })

async function getComponent(code: string, name = 'App') {
  const vueImportNames = [
    'createVNode',
    'Fragment',
    'resolveComponent',
    'withDirectives',
    'vShow',
    'vModelSelect',
    'vModelCheckbox',
    'vModelRadio',
    'vModelText',
    'vModelDynamic',
    'resolveDirective',
    'mergeProps',
    'createTextVNode',
    'defineComponent',
    'isVNode',
  ] as const

  let transformed = await transpile(code)
  transformed = transformed.replaceAll(/import.*from.*/g, '')
  vueImportNames.forEach((name) => {
    transformed = transformed.replaceAll(`_${name}`, name)
  })
  transformed = transformed.replaceAll(/\bexport .*/g, '')

  const fnCode = `
      return ((${vueImportNames.join(', ')})=>{
      ${transformed}
      return ${name}
    })(...arguments)
    `

  return new Function(fnCode)(
    ...vueImportNames.map(
      (name) =>
        // eslint-disable-next-line import/namespace
        vue[name],
    ),
  )
}
describe('jsx fn component define', () => {
  it('function', async () => {
    const code = `
    function App() {
      return <div>hello</div>
    }
    `
    const wrapper = shallowMount(await getComponent(code))
    expect(wrapper.text()).toBe('hello')
  })

  it('arrowFunction', async () => {
    const code = `
    const App = () => {
      return <div>hello</div>
    }
    `
    const wrapper = shallowMount(await getComponent(code))
    expect(wrapper.text()).toBe('hello')
  })
})

describe('jsx props define', () => {
  it('TypeLiteral Props', async () => {
    const code = `
    function App(props: {a: number}) {
      return <div>hello {props.a}</div>
    }
    `
    const wrapper = shallowMount(await getComponent(code), {
      props: {
        a: 1,
      },
    })
    expect(wrapper.text()).toBe('hello 1')
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
    const wrapper = shallowMount(await getComponent(code), {
      props: {
        a: 1,
      },
    })
    expect(wrapper.text()).toBe('hello 1')
  })

  describe('Complex props', () => {
    it('TypeReference and', async () => {
      const code = `
      type PropsComplex = {
        b?: string
      }
      type PropsAnd = {
        a: number
      } & PropsComplex

      function App(props: PropsAnd) {
        return <div>hello {props.a}</div>
      }
      `
      const wrapper = shallowMount(await getComponent(code), {
        props: {
          a: 1,
        },
      })
      expect(Object.keys(wrapper.props())).toEqual(['a', 'b'])
      expect(wrapper.text()).toBe('hello 1')
    })

    it('TypeLiteral and', async () => {
      const code = `
      type PropsComplex = {
        b?: string
      }

      function App(props: {
        a: number
      } & PropsComplex) {
        return <div>hello {props.a}</div>
      }
      `
      const wrapper = shallowMount(await getComponent(code), {
        props: {
          a: 1,
        },
      })
      expect(Object.keys(wrapper.props())).toEqual(['a', 'b'])
      expect(wrapper.text()).toBe('hello 1')
    })

    it('TypeReference union', async () => {
      const code = `
      type PropsComplex = {
        b?: string
      }
      type PropsUnion = {
        a: number
      } | PropsComplex

      function App(props: PropsUnion) {
        return <div>hello {props.a}</div>
      }
      `
      const wrapper = shallowMount(await getComponent(code), {
        props: {
          a: 1,
        },
      })
      expect(Object.keys(wrapper.props())).toEqual(['a', 'b'])
      expect(wrapper.text()).toBe('hello 1')
    })

    it('TypeLiteral union', async () => {
      const code = `
      type PropsComplex = {
        b?: string
      }

      function App(props: {
        a: number
      } | PropsComplex) {
        return <div>hello {props.a}</div>
      }
      `
      const wrapper = shallowMount(await getComponent(code), {
        props: {
          a: 1,
        },
      })
      expect(Object.keys(wrapper.props())).toEqual(['a', 'b'])
      expect(wrapper.text()).toBe('hello 1')
    })
  })

  it('Cross file type', async () => {
    const code = `
    import { Props } from './type'
    type FnProps = {
      a: string    
    } & Props
    function App(props: FnProps) {
      return <div>hello {props.a} {props.b}</div>
    }
    `
    const wrapper = shallowMount(await getComponent(code), {
      props: {
        a: 'str',
        b: 2,
      },
    })
    expect(Object.keys(wrapper.props())).toEqual(['a', 'b'])
    expect(wrapper.text()).toBe('hello str 2')
  })
})
