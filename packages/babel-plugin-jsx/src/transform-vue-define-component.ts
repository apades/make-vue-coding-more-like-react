import type { NodePath } from '@babel/traverse'
import t from '@babel/types'
import type { analyzeJsxFnComp } from './analyze'
import type { State } from './interface'
import { createIdentifier, VUE_DFC } from './utils'

export function buildJsxFnComponentToVueDefineComponent(
  path: NodePath<t.FunctionDeclaration | t.ArrowFunctionExpression>,
  state: State,
  params: {
    returnStatement: NodePath<t.ReturnStatement>
    fnName: string
  } & ReturnType<typeof analyzeJsxFnComp>,
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
  const JSX_COMP_SLOT_NAME = '__SLOT'
  const JSX_COMP_PROPS_NAME = '__PROPS'
  const JSX_COMP_CTX_NAME = '__CTX'

  const slotsStatement = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(JSX_COMP_SLOT_NAME),
      t.arrayExpression(
        Object.keys(jsxSlot).map((key) => t.stringLiteral(key)),
      ),
    ),
  ])

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

  /* 
   const props = new Proxy({},{get:(_,key)=>{
      if(__slots.includes(key)) return ctx.slots[key]
      return __props[key]
    }})
  */
  const propsProxyStatement = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(params.propsName),
      t.newExpression(t.identifier('Proxy'), [
        t.objectExpression([]),
        t.objectExpression([
          t.objectProperty(
            t.identifier('get'),
            t.arrowFunctionExpression(
              [t.identifier('_'), t.identifier('key')],
              t.blockStatement([
                t.ifStatement(
                  t.callExpression(
                    t.memberExpression(
                      t.identifier(JSX_COMP_SLOT_NAME),
                      t.identifier('includes'),
                    ),
                    [t.identifier('key')],
                  ),
                  t.returnStatement(
                    t.memberExpression(
                      t.memberExpression(
                        t.identifier(JSX_COMP_CTX_NAME),
                        t.identifier('slots'),
                      ),
                      t.identifier('key'),
                      true,
                    ),
                  ),
                ),

                t.returnStatement(
                  t.memberExpression(
                    t.identifier(JSX_COMP_PROPS_NAME),
                    t.identifier('key'),
                    true,
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ]),
    ),
  ])

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
          t.objectProperty(
            t.identifier('slots'),
            t.identifier(JSX_COMP_SLOT_NAME),
          ),
          t.objectMethod(
            'method',
            t.identifier('setup'),
            [
              t.identifier(JSX_COMP_PROPS_NAME),
              t.identifier(JSX_COMP_CTX_NAME),
            ],
            t.blockStatement([
              t.expressionStatement(
                t.callExpression(
                  t.memberExpression(
                    t.identifier(JSX_COMP_CTX_NAME),
                    t.identifier('expose'),
                  ),
                  // TODO get component expose
                  [],
                ),
              ),
              propsProxyStatement,
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
      slotsStatement,
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
