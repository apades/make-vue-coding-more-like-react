import type { NodePath } from '@babel/traverse'
import t from '@babel/types'
import type { analyzeJsxParams } from './analyze'
import type { State } from './interface'
import { createIdentifier, VUE_DFC } from './utils'

export function buildJsxFnComponentToVueDefineComponent(
  path: NodePath<t.FunctionDeclaration | t.ArrowFunctionExpression>,
  state: State,
  params: {
    params: ReturnType<typeof analyzeJsxParams>
    returnStatement: NodePath<t.ReturnStatement>
    fnName: string
  },
) {
  const isArrowFn = t.isArrowFunctionExpression(path.node)
  const bodyStatements = t.isArrowFunctionExpression(path.node)
    ? (path.get('body') as NodePath<t.BlockStatement>).node.body
    : path.node.body.body
  const bodyWithoutReturn = bodyStatements.filter(
    (node) => !t.isReturnStatement(node),
  )

  const fnName = params.fnName

  const [jsxProps, jsxSlot] = params.params

  const returnStatement = params.returnStatement.node

  const JSX_COMP_NAME = '__JSX'

  const innerJsxArrowFn = t.arrowFunctionExpression(
    [],
    t.blockStatement([returnStatement]),
  )
  innerJsxArrowFn.leadingComments = [
    {
      type: 'CommentBlock',
      value: VUE_DFC,
    },
  ]
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
              t.returnStatement(innerJsxArrowFn),
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

  const factoryArrowFn = t.arrowFunctionExpression(
    [],
    t.blockStatement([
      innerJsxCompFnWrapper,
      t.returnStatement(t.identifier(JSX_COMP_NAME)),
    ]),
  )
  factoryArrowFn.leadingComments = [
    {
      type: 'CommentBlock',
      value: VUE_DFC,
    },
  ]
  const jsxFactory = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(fnName),
      t.callExpression(factoryArrowFn, []),
    ),
  ])

  if (isArrowFn) {
    path.getStatementParent()?.replaceWith(jsxFactory)
  } else {
    path.replaceWith(jsxFactory)
  }
}
