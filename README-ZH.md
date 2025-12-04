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
