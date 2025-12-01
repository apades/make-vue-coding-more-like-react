import { ref } from 'vue'
import CompB from './CompB'
type ComProps = {
  foo: string
  bar: number
  a?: number
  d: () => void
}

function ChildComp(
  props: {
    foo: string
    bar: number
    a?: number
    d: () => void
  },
  // ref: any,
) {
  let com = props.a + props.foo
  const val = ref(0)

  if (props.a) {
    return null
  }

  return (
    <div>
      <div>AnotherComp</div>
      <p>foo:{props.foo}</p>
      <p>bar:{props.bar}</p>
      <p
        onClick={() => {
          val.value++
        }}
      >
        val: {val.value}
      </p>
    </div>
  )
}

function App() {
  return (
    <div>
      <p>this is APP</p>
      <ChildComp bar={1} foo="hello" d={() => {}} />
      <hr />

      <CompB a="asd" />
    </div>
  )
}

export default App

// const ArrowFn: FC<ComProps> = (props) => {
//   return (
//     <div>
//       <div>AnotherComp</div>
//       <p>foo:{props.num}</p>
//       <p>bar:{props.b}</p>
//     </div>
//   )
// }
