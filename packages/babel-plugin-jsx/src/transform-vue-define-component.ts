import { type NodePath, type Visitor } from '@babel/traverse'
import t from '@babel/types'
import { analyzeJsxFnComp } from './analyze'
import type { State, Slots } from './interface'
import { createIdentifier, isVueDfc, VUE_DFC } from './utils'

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
        // Object.keys(jsxSlot).map((key) => t.stringLiteral(key)),
        [t.stringLiteral('children')],
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
                    t.callExpression(
                      t.memberExpression(
                        t.memberExpression(
                          t.identifier(JSX_COMP_CTX_NAME),
                          t.identifier('slots'),
                        ),
                        t.identifier('default'),
                      ),
                      [],
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
          // t.objectProperty(
          //   t.identifier('slots'),
          //   t.identifier(JSX_COMP_SLOT_NAME),
          // ),
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

const isReturnJsxElementAndGetReturnStatement = (
  parentPath: NodePath<t.FunctionDeclaration | t.ArrowFunctionExpression>,
) => {
  let isJsxFn = false
  let returnStatement: NodePath<t.ReturnStatement> | undefined
  parentPath.traverse({
    ReturnStatement(returnPath) {
      // skip ts error
      returnPath.traverse({
        JSXElement(jsxPath) {
          isJsxFn = true
          returnStatement = returnPath
          jsxPath.stop()
          returnPath.stop()
        },
      })
    },
  })

  return isJsxFn ? returnStatement : undefined
}

const visitor: Visitor<State> = {
  FunctionDeclaration: {
    enter(path, state) {
      const returnStatement = isReturnJsxElementAndGetReturnStatement(path)
      if (!returnStatement) return
      const filename = state.file.opts.sourceFileName
      const fnName = path.node.id?.name || ''
      const analysisData = analyzeJsxFnComp(path, state, fnName)
      buildJsxFnComponentToVueDefineComponent(path, state, {
        returnStatement,
        fnName,
        ...analysisData,
      })
    },
  },
  ArrowFunctionExpression: {
    enter(path, state) {
      // √ () => {}
      // × /* VUE DFC */() => {}
      if (isVueDfc(path.node)) return
      // √ const A = () => <div></div>
      // × () => <div></div>
      if (!t.isVariableDeclarator(path.parent)) return
      const returnStatement = isReturnJsxElementAndGetReturnStatement(path)
      if (!returnStatement) return
      const filename = state.file.opts.sourceFileName
      const fnName = (path.parent.id as t.Identifier).name || ''
      const analysisData = analyzeJsxFnComp(path, state, fnName)
      buildJsxFnComponentToVueDefineComponent(path, state, {
        returnStatement,
        fnName,
        ...analysisData,
      })
    },
  },
}

export default visitor
