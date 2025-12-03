import { defineComponent, ref } from 'vue'
import { type PropsB } from './type'

type PropsA = {
  msg: string
  optional?: boolean
} & PropsB

const CompProps = defineComponent<PropsA>((props) => {
  return () => <div>inner:{props.msg}</div>
})

const App = defineComponent({
  setup() {
    const count = ref(0)
    return () => (
      <div onClick={() => count.value++}>
        <div>out count {count.value}</div>
        <hr />
        <CompProps msg={`inner count ${count.value}`} />
      </div>
    )
  },
})

export default App
