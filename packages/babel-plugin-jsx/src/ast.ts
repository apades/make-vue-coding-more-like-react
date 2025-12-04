import { type NodePath, type Visitor } from '@babel/traverse'
import type { ArrowFunctionExpression, Node } from '@babel/types'
import t from '@babel/types'

export function getJsxFnParams(
  path: NodePath<t.FunctionDeclaration | t.ArrowFunctionExpression>,
) {
  if (t.isFunctionDeclaration(path.node)) {
    return path.node.params[0] as t.Identifier
  }
  if (
    t.isArrowFunctionExpression(path.node) ||
    t.isFunctionExpression(path.node)
  ) {
    return path.node.params[0] as t.Identifier
  }
}
