import type * as BabelCore from '@babel/core'
import { declare } from '@babel/helper-plugin-utils'
import _template from '@babel/template'
import t from '@babel/types'
import { addNamed, addNamespace, isModule } from '@babel/helper-module-imports'
// @ts-expect-error
import _syntaxJsx from '@babel/plugin-syntax-jsx'
import { type NodePath, visitors } from '@babel/traverse'
import type { State, VueJSXPluginOptions } from './interface'
import sugarFragmentVisitor from './sugar-fragment'
import transformVueDefineComponentPlugin from './transform-vue-define-component'
import transformVueJSXVisitor from './transform-vue-jsx'

export { VueJSXPluginOptions }

const hasJSX = (parentPath: NodePath<t.Program>) => {
  let fileHasJSX = false
  parentPath.traverse({
    JSXElement(path) {
      // skip ts error
      fileHasJSX = true
      path.stop()
    },
    JSXFragment(path) {
      fileHasJSX = true
      path.stop()
    },
  })

  return fileHasJSX
}

const JSX_ANNOTATION_REGEX = /\*?\s*@jsx\s+([^\s]+)/

/* #__NO_SIDE_EFFECTS__ */
function interopDefault(m: any) {
  return m.default || m
}

const syntaxJsx = /*#__PURE__*/ interopDefault(_syntaxJsx)
const template = /*#__PURE__*/ interopDefault(_template)

const plugin: (
  api: object,
  options: VueJSXPluginOptions | null | undefined,
  dirname: string,
) => BabelCore.PluginObj<State> = declare<
  VueJSXPluginOptions,
  BabelCore.PluginObj<State>
>((api, opt, dirname) => {
  const { types } = api
  const transformVueDefineComponent = transformVueDefineComponentPlugin(
    api,
    {},
    dirname,
  )

  // createTsMorph({
  //   fileId: dirname,
  // })
  // console.log('dirname', dirname, api)
  return {
    ...transformVueDefineComponent,
    name: 'babel-plugin-jsx',
    inherits: /*#__PURE__*/ interopDefault(syntaxJsx),
    visitor: visitors.merge([
      transformVueJSXVisitor,
      transformVueDefineComponent.visitor,
      sugarFragmentVisitor,
      {
        Program: {
          enter(path, state) {
            if (hasJSX(path)) {
              const vueImportNames = [
                'createVNode',
                'Fragment',
                'resolveComponent',
                'withDirectives',
                'vShow',
                'vModelSelect',
                'vModelText',
                'vModelCheckbox',
                'vModelRadio',
                'vModelDynamic',
                'resolveDirective',
                'mergeProps',
                'createTextVNode',
                'defineComponent',
                'isVNode',
              ]
              if (isModule(path)) {
                // import { createVNode } from "vue";
                const importMap: Record<
                  string,
                  t.MemberExpression | t.Identifier
                > = {}
                vueImportNames.forEach((name) => {
                  state.set(name, () => {
                    if (importMap[name]) {
                      return types.cloneNode(importMap[name])
                    }
                    const identifier = addNamed(path, name, 'vue', {
                      ensureLiveReference: true,
                    })
                    importMap[name] = identifier
                    return identifier
                  })
                })
                const enableObjectSlots = true
                if (enableObjectSlots) {
                  state.set('@vue/babel-plugin-jsx/runtimeIsSlot', () => {
                    if (importMap.runtimeIsSlot) {
                      return importMap.runtimeIsSlot
                    }
                    const { name: isVNodeName } = state.get(
                      'isVNode',
                    )() as t.Identifier
                    const isSlot = path.scope.generateUidIdentifier('isSlot')
                    const ast = template.ast`
                      function ${isSlot.name}(s) {
                        return typeof s === 'function' || (Object.prototype.toString.call(s) === '[object Object]' && !${isVNodeName}(s));
                      }
                    `
                    const lastImport = (path.get('body') as NodePath[])
                      .filter((p) => p.isImportDeclaration())
                      .pop()
                    if (lastImport) {
                      lastImport.insertAfter(ast)
                    }
                    importMap.runtimeIsSlot = isSlot
                    return isSlot
                  })
                }
              } else {
                // var _vue = require('vue');
                let sourceName: t.Identifier
                vueImportNames.forEach((name) => {
                  state.set(name, () => {
                    if (!sourceName) {
                      sourceName = addNamespace(path, 'vue', {
                        ensureLiveReference: true,
                      })
                    }
                    return t.memberExpression(sourceName, t.identifier(name))
                  })
                })

                const helpers: Record<string, t.Identifier> = {}

                const enableObjectSlots = true
                if (enableObjectSlots) {
                  state.set('@vue/babel-plugin-jsx/runtimeIsSlot', () => {
                    if (helpers.runtimeIsSlot) {
                      return helpers.runtimeIsSlot
                    }
                    const isSlot = path.scope.generateUidIdentifier('isSlot')
                    const { object: objectName } = state.get(
                      'isVNode',
                    )() as t.MemberExpression
                    const ast = template.ast`
                      function ${isSlot.name}(s) {
                        return typeof s === 'function' || (Object.prototype.toString.call(s) === '[object Object]' && !${
                          (objectName as t.Identifier).name
                        }.isVNode(s));
                      }
                    `

                    const nodePaths = path.get('body') as NodePath[]
                    const lastImport = nodePaths
                      .filter(
                        (p) =>
                          p.isVariableDeclaration() &&
                          p.node.declarations.some(
                            (d) =>
                              (d.id as t.Identifier)?.name === sourceName.name,
                          ),
                      )
                      .pop()
                    if (lastImport) {
                      lastImport.insertAfter(ast)
                    }
                    return isSlot
                  })
                }
              }

              const {
                opts: { pragma = '' },
                file,
              } = state

              if (pragma) {
                state.set('createVNode', () => t.identifier(pragma))
              }

              if (file.ast.comments) {
                for (const comment of file.ast.comments) {
                  const jsxMatches = JSX_ANNOTATION_REGEX.exec(comment.value)
                  if (jsxMatches) {
                    state.set('createVNode', () => t.identifier(jsxMatches[1]))
                  }
                }
              }
            }
          },
        },
      },
    ]),
  }
})

export default plugin
