import { type NodePath, type Visitor } from '@babel/traverse'
import type { ArrowFunctionExpression, Node } from '@babel/types'
import t from '@babel/types'

export function getJsxFnParams(path: NodePath<t.FunctionDeclaration>) {
  if (t.isFunctionDeclaration(path.node)) {
    return path.node.params
  }
  if (
    t.isArrowFunctionExpression(path.node) ||
    t.isFunctionExpression(path.node)
  ) {
    return (path.node as ArrowFunctionExpression).params
  }

  return []
}
