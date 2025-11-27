import { babelParse } from './src/babel-helpers/parse'

const code = `
type ComProps = {
  foo: string;
  bar: number;
  a?: number
  d: () => void
}

function AnotherComp(props: ComProps, ref: any) {

  let com = props.a + props.foo
  if(props.a) {
    return null
  }

  return <>
    <div>AnotherComp</div>
    <p>foo:{ foo }</p>
    <p>bar:{ bar }</p>
  </>
}`

const rs = babelParse(code)
console.log(rs)
