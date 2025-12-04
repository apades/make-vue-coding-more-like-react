import fs from 'node:fs'
import nodePath from 'node:path'
import { codeFrameColumns } from '@babel/code-frame'
import type * as BabelCore from '@babel/core'
import { addNamed } from '@babel/helper-module-imports'
import { declare } from '@babel/helper-plugin-utils'
import { type NodePath } from '@babel/traverse'
import t from '@babel/types'
import {
  type SimpleTypeResolveContext,
  type SimpleTypeResolveOptions,
} from '@vue/compiler-sfc'
import { analyzeJsxFnComp } from './analyze'
import type { State } from './interface'
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

  const jsxProps = params.props

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
                  t.binaryExpression(
                    '===',
                    t.identifier('key'),
                    t.stringLiteral('children'),
                  ),
                  t.returnStatement(
                    t.optionalCallExpression(
                      t.memberExpression(
                        t.memberExpression(
                          t.identifier(JSX_COMP_CTX_NAME),
                          t.identifier('slots'),
                        ),
                        t.identifier('default'),
                      ),
                      [],
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
          t.objectProperty(t.identifier('props'), jsxProps),
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
              ...(params.expose
                ? [
                    // t.variableDeclaration('const', [
                    //   t.variableDeclarator(
                    //     t.identifier(DEFINE_EXPOSE),
                    //     t.memberExpression(
                    //       t.identifier(JSX_COMP_CTX_NAME),
                    //       t.identifier('expose'),
                    //     ),
                    //   ),
                    // ]),
                    t.expressionStatement(
                      t.callExpression(
                        t.memberExpression(
                          t.identifier(JSX_COMP_CTX_NAME),
                          t.identifier('expose'),
                        ),
                        [params.expose],
                      ),
                    ),
                  ]
                : []),
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

const plugin: (
  api: object,
  options: SimpleTypeResolveOptions | null | undefined,
  dirname: string,
) => BabelCore.PluginObj<State> = declare(({ types: t }, options, dirname) => {
  let ctx: SimpleTypeResolveContext | undefined
  let helpers: Set<string> | undefined

  options = {
    fs: {
      readFile: (p) => fs.readFileSync(nodePath.resolve(dirname, p), 'utf-8'),
      fileExists: (p) => fs.existsSync(nodePath.resolve(dirname, p)),
      realpath: (p) => fs.realpathSync(nodePath.resolve(dirname, p), 'utf-8'),
    },
  }
  const updateResolveTypeFs = (nowFileDirname: string) => {
    options!.fs!.readFile = (p) =>
      fs.readFileSync(nodePath.resolve(nowFileDirname, p), 'utf-8')
    options!.fs!.fileExists = (p) =>
      fs.existsSync(nodePath.resolve(nowFileDirname, p))
    options!.fs!.realpath = (p) =>
      fs.realpathSync(nodePath.resolve(nowFileDirname, p), 'utf-8')
  }

  return {
    name: 'transform-vue-define-component',
    pre(file) {
      const filename =
        (globalThis as any).__VITEST_FILENAME ||
        file.opts.filename ||
        'unknown.js'
      helpers = new Set()
      ctx = {
        filename: filename,
        source: file.code,
        options,
        ast: [...file.ast.program.body],
        isCE: false,
        error(msg, node) {
          throw new Error(
            `[@vue/babel-plugin-resolve-type] ${msg}\n\n${filename}\n${codeFrameColumns(
              file.code,
              {
                start: {
                  line: node.loc!.start.line,
                  column: node.loc!.start.column + 1,
                },
                end: {
                  line: node.loc!.end.line,
                  column: node.loc!.end.column + 1,
                },
              },
            )}`,
          )
        },
        helper(key) {
          helpers!.add(key)
          return `_${key}`
        },
        getString(node) {
          return file.code.slice(node.start!, node.end!)
        },
        propsTypeDecl: undefined,
        propsRuntimeDefaults: undefined,
        propsDestructuredBindings: {},
        emitsTypeDecl: undefined,
      }
    },
    post(file) {
      for (const helper of helpers!) {
        addNamed(file.path, `_${helper}`, 'vue')
      }
    },
    visitor: {
      Program: {
        enter(_, state) {
          const filename =
            state.file.opts.sourceFileName ||
            (globalThis as any).__VITEST_FILENAME

          if (filename) updateResolveTypeFs(nodePath.dirname(filename))
        },
      },
      FunctionDeclaration: {
        enter(path, state) {
          const returnStatement = isReturnJsxElementAndGetReturnStatement(path)
          if (!returnStatement) return
          const filename = state.file.opts.sourceFileName
          const fnName = path.node.id?.name || ''
          const analysisData = analyzeJsxFnComp(path, ctx!)
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
          const analysisData = analyzeJsxFnComp(path, ctx!)
          buildJsxFnComponentToVueDefineComponent(path, state, {
            returnStatement,
            fnName,
            ...analysisData,
          })
        },
      },
    },
  }
})

export default plugin
