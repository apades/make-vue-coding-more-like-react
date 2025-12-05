# make Vue coding more like React

- [简体中文](./README-ZH.md)

As the title says
<details>
  <summary>
    <b>Why this ?</b>
  </summary>
  <br>

If you have used Vue's official jsx plugin, you will get how strange the syntax is, especially when you switch from React. You need to manually define **props + defineComponent.setup** and feel uncomfortable writing it.

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

This project is to solve the above verbose writing method and turn to React to use only one function to define jsx component writing method, [example](#Example)
</details>

## How to use
> [!WARNING]
> THIS PLUGIN ONLY SUPPORT WITH
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
```333333

tsconfig.json
```jsonc
{
  "compilerOptions": {
    // ...
    "jsx": "preserve",
    "jsxImportSource": "vue",
  }
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

## Credit
Code based on:
- [@vue/babel-plugin-resolve-type](https://github.com/vuejs/babel-plugin-jsx/tree/main/packages/babel-plugin-resolve-type)
- [@vue/babel-plugin-jsx](https://github.com/vuejs/babel-plugin-jsx/tree/main/packages/babel-plugin-jsx)
- [@vue/babel-helper-vue-transform-on](https://github.com/vuejs/babel-plugin-jsx/tree/main/packages/babel-helper-vue-transform-on)
- [@vitejs/plugin-vue-jsx](https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue-jsx)

Inspired:
- [vue-vine](https://github.com/vue-vine/vue-vine)