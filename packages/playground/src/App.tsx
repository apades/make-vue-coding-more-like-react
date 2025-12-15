import { effect, ref } from 'vue'
import {
  ElButton,
  ElMention,
  ElRadio,
  ElTransfer,
  TransferInstance,
  ElUpload,
} from 'element-plus'
import CompB, { CanRefComp, type Handler } from './CompB'
import type { PropsB } from './type'
import 'element-plus/dist/index.css'
import { NAutoComplete } from 'naive-ui'

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
  const val = ref(0)
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
  const nVal = ref('')

  if (unuProps.a) {
    return null
  }

  return (
    <div>
      <div>AnotherComp</div>
      <p>foo:{unuProps.foo}</p>
      <p>bar:{unuProps.bar}</p>

      <NAutoComplete
        v-model={nVal.value}
        options={options.value}
      ></NAutoComplete>

      <ElMention
        v-model={mention.value}
        v-slots={
          {
            header: () => <div>header</div>,
          } as any
        }
        options={options.value}
        onSearch={(v) => {
          // console.log('onSearch s', v)
        }}
      ></ElMention>
      {/* <ElTransfer renderContent={} v-slots={{}}></ElTransfer> */}
      {/* <ElUpload withCredentials accept="asd"></ElUpload> */}
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
