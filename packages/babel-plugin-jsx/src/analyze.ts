import { type NodePath } from '@babel/traverse'
import t from '@babel/types'
import { getJsxFnParams } from './ast'
import type { State } from './interface'
import { getTsMorph, resolveJsxCompFnProps } from './ts-morph'
import type { TsMorphCache } from './types'

export function analyzeJsxParams(
  path: NodePath<t.FunctionDeclaration>,
  state: State,
) {
  const propsRecord: Record<string, t.TSPropertySignature> = {}
  const slotRecord: Record<
    string,
    {
      path: NodePath<t.FunctionDeclaration | t.ArrowFunctionExpression>
    }
  > = {}
  const [fnProps, fnRef] = getJsxFnParams(path) as [
    t.Identifier | t.ObjectPattern,
    t.Identifier,
  ]

  const rs = [propsRecord, slotRecord] as const

  if (!fnProps) return rs
  //   path.node.params[0]

  const propsTypeAnnotation = fnProps.typeAnnotation
  // TODO ts reference
  if (!t.isTSTypeAnnotation(propsTypeAnnotation)) return rs

  const typeAnnotation = propsTypeAnnotation.typeAnnotation
  const isContainsGenericTypeParams =
    (path.node.typeParameters as t.TSTypeParameterDeclaration)?.params?.length >
    0
  const isTypeLiteralProps = t.isTSTypeLiteral(typeAnnotation)

  // let tsMorphAnalyzedPropsInfo: Record<string, VinePropMeta> | undefined
  let tsMorphCache: TsMorphCache | undefined

  // Should initialize ts-morph when props is a type alias
  // or that type literal contains generic type parameters
  if (!isTypeLiteralProps || isContainsGenericTypeParams) {
    tsMorphCache = getTsMorph()
    // TODO
    const tsMorphAnalyzedPropsInfo = resolveJsxCompFnProps({
      tsMorphCache: getTsMorph(),
      fnName: path.node.id?.name || '',
      state,
    })
    return rs
  }

  if (isTypeLiteralProps) {
    ;(typeAnnotation.members as t.TSPropertySignature[]).forEach((member) => {
      const { key } = member
      if (
        (!t.isIdentifier(key) && !t.isStringLiteral(key)) ||
        !member.typeAnnotation
      ) {
        return
      }

      const propName = t.isIdentifier(key) ? key.name : key.value
      // TODO get prop type is vNode return, and add to slot
      const propType = member.typeAnnotation.typeAnnotation

      propsRecord[propName] = member
    })
    return rs
  }

  if (tsMorphCache) {
    return rs
  }

  throw Error('Not implemented')
}
