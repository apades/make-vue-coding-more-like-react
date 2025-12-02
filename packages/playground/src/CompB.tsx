import { ref, type VNode as Jsx } from 'vue'
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

export default CompB
