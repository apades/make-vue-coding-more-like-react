import { ElMention, ElTransfer, ElUpload } from 'element-plus'
import 'element-plus/dist/index.css'
import { NAutoComplete, NDatePicker } from 'naive-ui'
import { effect, ref } from 'vue'
import CompB, { CanRefComp, type Handler } from './CompB'
import type { PropsB } from './type'

type ComProps = {
  foo: string
  bar: number
  a?: number
  d: () => void
}

const ChildComp = (
  unuProps: ComProps & PropsB,
  // ref: any,
) => {
  let com = unuProps.a + unuProps.foo
  const dVal = ref(0)
  const sVal = ref('')
  const bVal = ref(false)
  const mention = ref('')
  const options = ref([
    {
      label: 'Fuphoenixes',
      value: 'Fuphoenixes',
    },
    {
      label: 'kooriookami',
      value: 'kooriookami',
    },
    {
      label: 'Jeremy',
      value: 'Jeremy',
    },
    {
      label: 'btea',
      value: 'btea',
    },
  ])

  effect(() => {
    console.log('sVal change', sVal.value)
  })

  if (unuProps.a) {
    return null
  }

  return (
    <div>
      <div>AnotherComp</div>
      <p>foo:{unuProps.foo}</p>
      <p>bar:{unuProps.bar}</p>

      <NAutoComplete
        // v-model:value={sVal.value}
        v-model:value={'asd'}
        options={options.value}
        v-slots={{}}
      ></NAutoComplete>

      <NDatePicker v-model:show={bVal.value}></NDatePicker>

      <ElMention
        v-model={sVal.value}
        v-slots={{
          header: () => <div>header</div>,
        }}
        options={options.value}
        onSearch={(v) => {
          console.log('onSearch s', v)
        }}
      ></ElMention>
      <ElTransfer v-slots={{ h: () => <div>asd</div> }}></ElTransfer>
      <ElUpload withCredentials accept="asd" v-slots={{}}>
        <div>upload</div>
      </ElUpload>
      <p
        onClick={() => {
          dVal.value++
        }}
      >
        val: {dVal.value}
      </p>
    </div>
  )
}

function App() {
  const count = ref(1)
  const compRef = ref<Handler>()
  return (
    <div>
      <p>this is APP</p>
      <p
        onClick={() => {
          compRef.value?.addCount()
        }}
      >
        click to change canRefComp val
      </p>
      <ChildComp bar={1} foo="hello" d={() => {}} />
      <hr />
      <CanRefComp
        header={(count) => `name: ${count}`}
        name="adsf"
        ref={compRef}
      />
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
