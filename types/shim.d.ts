import { VNodeChild } from 'vue'
declare module 'merge-source-map' {
  export default function merge(oldMap: object, newMap: object): object
}

declare module 'estree-walker' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  export function walk<R, N extends import('@babel/types').Node>(
    root: R,
    options: {
      enter?: (node: N, parent: N | null) => any
      leave?: (node: N, parent: N | null) => any
      exit?: (node: N) => any
    } & ThisType<{ skip: () => void }>,
  )
}

/**
 * 告诉 TSX 编译器：当存在 JSX children 时，把它们分配给 props 的 `children` 字段。
 * 这是 TypeScript 的一个约定：如果定义了 JSX.ElementChildrenAttribute = { children: ... }
 * 则会把内嵌的 JSX 元素映射到 props.children。
 */
declare global {
  namespace JSX {
    // 指定 props 上哪个字段会接收 children（这是 TypeScript 的约定名）
    interface ElementChildrenAttribute {
      children: {}
    }

    // 可选：你可以更具体地声明 IntrinsicAttributes/IntrinsicElements，
    // 但通常不需要。保持最小改动。
  }
}
