import { ref } from 'vue'
import CompB from './CompB'
type ComProps = {
  foo: string
  bar: number
  a?: number
  d: () => void
}

const ChildComp = (
  unuProps: ComProps,
  // ref: any,
) => {
  let com = unuProps.a + unuProps.foo
  const val = ref(0)

  if (unuProps.a) {
    return null
  }

  return (
    <div>
      <div>AnotherComp</div>
      <p>foo:{unuProps.foo}</p>
      <p>bar:{unuProps.bar}</p>
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
  const count = ref(1)
  return (
    <div>
      <p>this is APP</p>
      <ChildComp bar={1} foo="hello" d={() => {}} />
      <hr />

      <CompB
        a="asd"
        footer={(inner) => (
          <div onClick={() => count.value++}>
            text: <p style={{ color: 'red' }}>{inner}</p>
            <p>props count : {count.value}</p>
          </div>
        )}
      >
        <p style={{ color: 'green' }}>default slot count {count.value}</p>
      </CompB>
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
