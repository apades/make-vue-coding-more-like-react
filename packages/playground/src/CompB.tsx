import {
  type VNodeChild,
  VNode,
  ref,
  type VNode as Jsx,
  defineExpose,
} from 'vue'
const CompB = (props: {
  a: string
  footer: (inner: string) => Jsx
  children?: Jsx
}) => {
  const propsCount = ref(1)

  return (
    <div>
      CompB: {props.a}
      <hr />
      <p onClick={() => propsCount.value++}>footer: to add propsCount</p>
      <div>
        {props.footer(`this is inner props, propsCount ${propsCount.value}`)}
      </div>
      <hr />
      {props.children}
    </div>
  )
}

type Props = {
  name: string
  header: (count: number) => VNodeChild
  children?: Jsx
}
export type Handler = {
  addCount: () => void
}
export function CanRefComp(props: Props) {
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

export default CompB
