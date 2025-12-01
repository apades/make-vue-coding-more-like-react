import type { NodePath } from '@babel/traverse'
import t from '@babel/types'
import type { analyzeJsxParams } from './analyze'
import type { State } from './interface'
import { createIdentifier } from './utils'

export function buildJsxComponentToVueDefineComponent(
  path: NodePath<t.FunctionDeclaration>,
  state: State,
  params: {
    params: ReturnType<typeof analyzeJsxParams>
    returnStatement: NodePath<t.ReturnStatement>
  },
) {
  const body = path.node.body
  const bodyWithoutReturn = body.body.filter(
    (node) => !t.isReturnStatement(node),
  )

  const fnName = path.node.id?.name || ''

  const [jsxProps, jsxSlot] = params.params

  const returnStatement = params.returnStatement.node

  const JSX_COMP_NAME = '__JSX'
  const innerJsxCompFnWrapper = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(JSX_COMP_NAME),
      // TODO defineComponent
      t.callExpression(createIdentifier(state, 'defineComponent'), [
        t.objectExpression([
          t.objectProperty(t.identifier('name'), t.stringLiteral(fnName)),
          t.objectProperty(
            t.identifier('props'),
            t.arrayExpression(
              Object.keys(jsxProps).map((key) => t.stringLiteral(key)),
            ),
          ),
          t.objectMethod(
            'method',
            t.identifier('setup'),
            [
              // TODO get props name
              t.identifier('props'),
              t.identifier('ctx'),
            ],
            t.blockStatement([
              t.expressionStatement(
                t.callExpression(
                  t.memberExpression(
                    t.identifier('ctx'),
                    t.identifier('expose'),
                  ),
                  // TODO get component expose
                  [],
                ),
              ),
              ...bodyWithoutReturn,
              t.returnStatement(
                t.arrowFunctionExpression(
                  [],
                  t.blockStatement([returnStatement]),
                ),
              ),
            ]),
          ),
          // t.functionDeclaration(
          //   t.identifier('setup'),
          //   [],
          //   t.blockStatement([]),
          // ),
        ]),
      ]),
    ),
  ])

  const jsxFactory = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(fnName),
      t.callExpression(
        t.arrowFunctionExpression(
          [],
          t.blockStatement([
            innerJsxCompFnWrapper,
            t.returnStatement(t.identifier(JSX_COMP_NAME)),
          ]),
        ),
        [],
      ),
    ),
  ])

  path.replaceWith(jsxFactory)
}
