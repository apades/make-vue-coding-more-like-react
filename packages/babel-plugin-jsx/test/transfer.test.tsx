import { describe, expect, it } from 'vitest'
import { transform } from '@babel/core'
import { mount, shallowMount } from '@vue/test-utils'
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
  'ref',
] as const

async function transpileCodeToLocalFnCode(
  code: string,
  opt?: VueJSXPluginOptions,
) {
  let transformed = await transpile(code, opt)
  transformed = transformed.replaceAll(/import.*from.*/g, '')
  vueImportNames.forEach((name) => {
    transformed = transformed.replaceAll(`_${name}`, name)
  })
  transformed = transformed.replaceAll(/\bexport .*/g, '')

  return transformed
}
async function transpiledFnCodeToVueComponent(fnCode: string, name = 'App') {
  const fnCodeFactory = `
  return ((${vueImportNames.join(', ')})=>{
      ${fnCode}
      return ${name}
    })(...arguments)
  `
  return new Function(fnCodeFactory)(
    ...vueImportNames.map(
      (name) =>
        // eslint-disable-next-line import/namespace
        vue[name],
    ),
  )
}

async function transpileCodeToVueComponent(code: string, name = 'App') {
  const fnCode = await transpileCodeToLocalFnCode(code)

  return transpiledFnCodeToVueComponent(fnCode, name)
}
describe('jsx fn component define', () => {
  it('function', async () => {
    const code = `
    function App() {
      return <div>hello</div>
    }
    `
    const fnCode = await transpileCodeToLocalFnCode(code)
    expect(fnCode).includes('defineComponent')
    const wrapper = shallowMount(await transpiledFnCodeToVueComponent(fnCode))
    expect(wrapper.text()).toBe('hello')
  })

  it('arrowFunction', async () => {
    const code = `
    const App = () => {
      return <div>hello</div>
    }
    `
    const fnCode = await transpileCodeToLocalFnCode(code)
    expect(fnCode).includes('defineComponent')

    const wrapper = shallowMount(await transpiledFnCodeToVueComponent(fnCode))
    expect(wrapper.text()).toBe('hello')
  })

  it('Not jsx defineComponent without return jsxElement', async () => {
    const code = `
    type Props = {
      a: number
    }
    const App = (props: Props) => {
      return 'hello' + props.a
    }
    `
    const fnCode = await transpileCodeToLocalFnCode(code)
    expect(fnCode).not.includes('defineComponent')

    const wrapper = shallowMount(await transpiledFnCodeToVueComponent(fnCode), {
      props: {
        a: 1,
      },
    })
    expect(Object.keys(wrapper.props())).toEqual([])
    expect(wrapper.text()).toBe('hello1')
  })

  it('Nested jsx arrow fn', async () => {
    const code = `
    const App = () => {
      const Child = () => {
        return <div>child</div>
      }
      return <div>{Child()}</div>
    }
    `
    const fnCode = await transpileCodeToLocalFnCode(code)
    // expect(fnCode).not.includes('const Child = defineComponent')

    const wrapper = shallowMount(await transpiledFnCodeToVueComponent(fnCode))
    expect(wrapper.text()).toBe('child')
  })

  it('Nested jsx fn', async () => {
    const code = `
    function App(){
      function Child(){
        return <div>child</div>
      }
      return <div>{Child()}</div>
    }
    `
    const fnCode = await transpileCodeToLocalFnCode(code)
    expect(fnCode).not.includes('const Child = defineComponent')

    const wrapper = shallowMount(await transpiledFnCodeToVueComponent(fnCode))
    expect(wrapper.text()).toBe('child')
  })

  it('Multi return jsx fn', async () => {
    const code = `
    const Child = (props: { count: Ref<number,number> }) => {
      const count = props.count
      const Nested = () => <div>count2</div>
      if(!count.value)
        return <div>count0</div>
      if(count.value > 1){
        if(count.value == 2) return Nested()
        if(count.value == 3) return "count3"
      }
      return <div>count4</div>
    }

    const App = () => {
      const count = ref(0)
      return <div onClick={()=>count.value++}>
        <Child count={count} />
      </div>
    }
    `
    const fnCode = await transpileCodeToLocalFnCode(code)
    expect(fnCode).not.includes('const Nested = defineComponent')
    const wrapper = mount(await transpiledFnCodeToVueComponent(fnCode))
    expect(wrapper.text()).toBe('count0')
    await wrapper.trigger('click')
    expect(wrapper.text()).toBe('count4')
    await wrapper.trigger('click')
    expect(wrapper.text()).toBe('count2')
    await wrapper.trigger('click')
    expect(wrapper.text()).toBe('count3')
    await wrapper.trigger('click')
    expect(wrapper.text()).toBe('count4')
    await wrapper.trigger('click')
    expect(wrapper.text()).toBe('count4')
  })
})

describe('jsx props define', () => {
  it('TypeLiteral Props', async () => {
    const code = `
    function App(props: {a: number}) {
      return <div>hello {props.a}</div>
    }
    `
    const wrapper = shallowMount(await transpileCodeToVueComponent(code), {
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
      return <div>hello {props.a}</div>
    }
    `
    const wrapper = shallowMount(await transpileCodeToVueComponent(code), {
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
      const wrapper = shallowMount(await transpileCodeToVueComponent(code), {
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
      const wrapper = shallowMount(await transpileCodeToVueComponent(code), {
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
      const wrapper = shallowMount(await transpileCodeToVueComponent(code), {
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
      const wrapper = shallowMount(await transpileCodeToVueComponent(code), {
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
    const wrapper = shallowMount(await transpileCodeToVueComponent(code), {
      props: {
        a: 'str',
        b: 2,
      },
    })
    expect(Object.keys(wrapper.props())).toEqual(['a', 'b'])
    expect(wrapper.text()).toBe('hello str 2')
  })
})
