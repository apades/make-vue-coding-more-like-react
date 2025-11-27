import { type FunctionalComponent as FC } from 'vue'
type ComProps = {
  a: string
  b: number
  num?: number
  fn: () => void
}

function FnComponentWithPropsReference(props: ComProps, ref: any) {
  let com = props.a + props.num
  // block statement and return
  if (props.a) {
    return null
  }

  // only return
  if (props.b === 1) return null

  // return jsx
  return (
    <div>
      <div>AnotherComp</div>
      <p>foo:{props.num}</p>
      <p>bar:{props.b}</p>
    </div>
  )
}

function FnComponentWithPropsInline(
  props: {
    a: string
    b: number
    num?: number
    fn: () => void
  },
  ref: any,
) {
  return (
    <div>
      <div>AnotherComp</div>
      <p>foo:{props.num}</p>
      <p>bar:{props.b}</p>
    </div>
  )
}

const ArrowFn: FC<ComProps> = (props) => {
  return (
    <div>
      <div>AnotherComp</div>
      <p>foo:{props.num}</p>
      <p>bar:{props.b}</p>
    </div>
  )
}
