# make Vue coding more like React

- [English README](./README.md)

如标题所述

<details>
  <summary>
    <b>Why this ?</b>
  </summary>
  <br>

如果你用过Vue官方的jsx插件，会发现语法有一股怪味，尤其是从React转过来，面对**props需要手动定义 + defineComponent.setup**写法浑身难受

```tsx
import { ref, type VNode, defineComponent } from 'vue'
type Props = {
  name: string
  header: (count: number) => VNode
}
type Handler = {
  addCount: () => void
}
const Child = defineComponent<Props>({
  props: ['name', 'header'],
  setup(props, ctx) {
    const innerCount = ref(0)
    ctx.expose<Handler>({
      addCount() {
        innerCount.value++
      },
    })
    return () => (
      <>
        <div class="mb-2 border-b-[1px]">{props.header(innerCount.value)}</div>
        <div class="cursor-pointer" onClick={() => innerCount.value++}>
          {props.name} count: {innerCount.value}
        </div>
        {ctx.slots.default?.()}
      </>
    )
  },
})
```

该项目就是为了解决上面的啰嗦写法，转向React只用一个函数定义jsx component的写法，具体[example](#Example)

</details>

## How to use

> [!WARNING]
> 该插件目前只支持:
> Vue3 + Typescript + setup

```bash
npm i @mvcmlr/plugin-vue-jsx -D
```

vite.mts

```ts
import { defineConfig } from 'vite'
import vueJsx from '@mvcmlr/plugin-vue-jsx'

export default defineConfig({
  plugins: [vueJsx()],
})
```

tsconfig.json

```jsonc
{
  "compilerOptions": {
    // ...
    "jsx": "preserve",
    "jsxImportSource": "vue",
  },
}
```

## 语法警告

- 定义 jsx function

```tsx
// ✔ 返回 jsx element
const App = () => <div></div>
// ✔
function App() {
  return <div></div>
}
// 🚫 没有返回 jsx element
const App = () => '1111'
// 🚫 引用 jsx 值变量
const Child = <div></div>
const App = () => Child
```

- 嵌套 jsx function

```tsx
const App = () => {
  const Child = (props: { a: number }) => {
    // 🚫 🤔 现不支持，未来可能支持
    defineExpose({})
    return <div>{props.a}</div>
  }

  // 🚫 🤔 现不支持，未来可能支持
  return <Child a={1} />
  // ✔
  return Child({ a: 1 })
}
```

- 多个 return

```tsx
const App = (props: { a: number }) => {
  // ✔ 在return前用hook
  const count1 = ref(0)
  if (props.a == 1) return <div>1</div>
  // 🚫 不要在return后用hook
  const count2 = ref(0)
  if (props.a == 2) return <div>2</div>
  return <div>3</div>
}
```

## Example

```tsx
import { effect, ref, type VNode } from 'vue'
type Props = {
  name: string
  header: (count: number) => VNode
  children?: VNode
}
type Handler = {
  addCount: () => void
}
function ChildComp(props: Props) {
  const innerCount = ref(0)
  defineExpose<Handler>({
    addCount() {
      innerCount.value++
    },
  })
  return (
    <>
      <div class="mb-2 border-b-[1px]">{props.header(innerCount.value)}</div>
      <div class="cursor-pointer" onClick={() => innerCount.value++}>
        {props.name} count: {innerCount.value}
      </div>
      {props.children}
    </>
  )
}

function App() {
  const count = ref(0)
  const childCompRef = ref<Handler>()
  effect(() => {
    console.log('count change', count.value)
  })

  return (
    <div>
      <div class="cursor-pointer" onClick={() => count.value++}>
        app count: {count.value}
      </div>
      <div
        class="cursor-pointer"
        onClick={() => childCompRef.value?.addCount()}
      >
        click to add count in child comp
      </div>

      <ChildComp
        name="hello"
        header={(count) => (
          <>
            <div>header </div>
            <p>from ChildComp count :{count}</p>
          </>
        )}
        ref={childCompRef}
      >
        <div>
          <div>child app count: {count.value}</div>
        </div>
      </ChildComp>
    </div>
  )
}

export default App
```

## 鸣谢

代码基于以下项目修改:

- [@vue/babel-plugin-resolve-type](https://github.com/vuejs/babel-plugin-jsx/tree/main/packages/babel-plugin-resolve-type)
- [@vue/babel-plugin-jsx](https://github.com/vuejs/babel-plugin-jsx/tree/main/packages/babel-plugin-jsx)
- [@vue/babel-helper-vue-transform-on](https://github.com/vuejs/babel-plugin-jsx/tree/main/packages/babel-helper-vue-transform-on)
- [@vitejs/plugin-vue-jsx](https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue-jsx)

受启发:

- [vue-vine](https://github.com/vue-vine/vue-vine)
