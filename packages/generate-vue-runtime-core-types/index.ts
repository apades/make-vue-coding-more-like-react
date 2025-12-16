import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import * as babel from '@babel/core'
import { types as t } from '@babel/core'
// @ts-ignore
import typescript from '@babel/plugin-syntax-typescript'

// const __dirname = import.meta.dirname
const vueRuntimeCorePath = require.resolve('@vue/runtime-core')
const runtimeCorePath = path.resolve(
  path.dirname(vueRuntimeCorePath),
  './dist/runtime-core.d.ts',
)

const code = readFileSync(runtimeCorePath, 'utf-8')

function main() {
  const result = babel.transformSync(code, {
    babelrc: false,
    ast: true,
    plugins: [
      [typescript],
      {
        visitor: {
          Program: {
            enter(path) {
              /** 
                 * type ToVModelChildsMap<T> = {
                        [K in keyof T as `v-model:${string & K}`]: T[K]
                    }
                 */
              const utilsToVModelChildsMap = t.tsTypeAliasDeclaration(
                t.identifier('ToVModelChildsMap'),
                t.tsTypeParameterDeclaration([
                  t.tsTypeParameter(null, null, 'T'),
                ]),
                t.tsMappedType(
                  t.tsTypeParameter(
                    t.tsTypeOperator(t.tsTypeReference(t.identifier('T'))),
                    null,
                    'K',
                  ),
                  t.tsIndexedAccessType(
                    t.tsTypeReference(t.identifier('T')),
                    t.tsTypeReference(t.identifier('K')),
                  ),
                  t.tsLiteralType(
                    t.templateLiteral(
                      [
                        t.templateElement(
                          { raw: 'v-model:', cooked: 'v-model:' },
                          false,
                        ),
                        t.templateElement({ raw: '', cooked: '' }, true),
                      ],
                      [
                        // 插入 "string & K" 的类型表达式
                        t.tsIntersectionType([
                          t.tsStringKeyword(),
                          t.tsTypeReference(t.identifier('K')), // 这里仅示意，实际表达式需要把 K 变量捕获进来
                        ]),
                      ],
                    ),
                  ),
                ),
              )

              path.pushContainer('body', utilsToVModelChildsMap)
            },
          },
          TSTypeAliasDeclaration: {
            enter(path) {
              if (path.node.id.name !== 'ComponentPublicInstance') return
              const typeParams = path.node.typeParameters!.params
              const slotTypeName = typeParams[11].name
              const propsTypeName = typeParams[0].name

              let typeAnnotation = path.node.typeAnnotation
              if (t.isTSIntersectionType(typeAnnotation)) {
                typeAnnotation = typeAnnotation.types[0]
              }
              // resolve $props type declaration
              if (t.isTSTypeLiteral(typeAnnotation)) {
                // const $slotsType = typeAnnotation.members.find(
                //   (member) =>
                //     t.isTSPropertySignature(member) &&
                //     t.isIdentifier(member.key) &&
                //     member.key.name === '$slots',
                // )?.typeAnnotation
                const $propsType = typeAnnotation.members.find(
                  (member) =>
                    t.isTSPropertySignature(member) &&
                    t.isIdentifier(member.key) &&
                    member.key.name === '$props',
                )?.typeAnnotation

                if (!$propsType)
                  throw new Error('Failed to find $props type declaration')
                // if (!$slotsType)
                //   throw new Error('Failed to find $slots type declaration')

                const tsPropertySignature = (
                  params: Parameters<typeof t.tsPropertySignature>,
                  opt?: Partial<{
                    optional?: boolean
                    readonly?: boolean
                  }>,
                ) => {
                  const node = t.tsPropertySignature(...params)

                  if (opt?.optional) {
                    node.optional = true
                  }
                  if (opt?.readonly) {
                    node.readonly = true
                  }
                  return node
                }

                const vSlotsAndVModelAstCode = `
                type aaa = {
                    'v-slots'?: (keyof S) extends never ? any : UnwrapSlotsType<S>, 
                    'v-model'?: P extends { modelValue?: infer S } ? S : any
                }
                `
                const vSlotsAndVModelAstResult = babel.transformSync(
                  vSlotsAndVModelAstCode,
                  {
                    babelrc: false,
                    ast: true,
                    plugins: [typescript],
                  },
                )!.ast!
                const vSlotsAndVModelAst = (
                  vSlotsAndVModelAstResult.program
                    .body[0] as t.TSTypeAliasDeclaration
                ).typeAnnotation

                const vModelChildsAstCode = `type VModelChilds = (P extends {
                    [K in \`onUpdate:\${string}\`]: any
                } ?
                    // to v-models:xxx format
                    ToVModelChildsMap<{
                        [K in keyof P as K extends \`onUpdate:\${infer U}\`
                        ? U
                        : never]: K extends \`onUpdate:\${infer U}\`
                        ? U extends keyof P
                        ? P[U]
                        : never
                        : never
                    }> : {})`
                const vModelChildsAstResult = babel.transformSync(
                  vModelChildsAstCode,
                  {
                    babelrc: false,
                    ast: true,
                    plugins: [typescript],
                  },
                )!.ast!
                const vModelChildsAst = (
                  vModelChildsAstResult.program
                    .body[0] as t.TSTypeAliasDeclaration
                ).typeAnnotation

                const new$propsType = t.tsIntersectionType([
                  $propsType.typeAnnotation,
                  /** 
                   * {
                        'v-slots'?: (keyof S) extends never ? any : UnwrapSlotsType<S>, 'v-model'?: P extends { modelValue?: infer S } ? S : any
                     }
                   */
                  vSlotsAndVModelAst,
                  //   t.tsTypeLiteral([
                  //     tsPropertySignature(
                  //       [
                  //         t.identifier('v-slots'),
                  //         t.tsTypeAnnotation(
                  //           t.tsConditionalType(
                  //             t.tsParenthesizedType(
                  //               t.tsTypeOperator(
                  //                 t.tsTypeReference(
                  //                   t.identifier('keyof'),
                  //                   t.tsTypeParameterInstantiation([
                  //                     t.tsTypeReference(
                  //                       t.identifier(slotTypeName),
                  //                     ),
                  //                   ]),
                  //                 ),
                  //               ),
                  //             ),
                  //             t.tsTypeReference(t.identifier('never')),
                  //             t.tsTypeReference(t.identifier('any')),
                  //             t.tsTypeReference(
                  //               t.identifier('UnwrapSlotsType'),
                  //               t.tsTypeParameterInstantiation([
                  //                 t.tsTypeReference(t.identifier(slotTypeName)),
                  //               ]),
                  //             ),
                  //           ),
                  //         ),
                  //       ],
                  //       { optional: true },
                  //     ),
                  //     tsPropertySignature(
                  //       [
                  //         t.identifier('v-model'),
                  //         t.tsTypeAnnotation(
                  //           t.tsConditionalType(
                  //             t.tsTypeReference(t.identifier(propsTypeName)),
                  //             t.tsTypeLiteral([
                  //               tsPropertySignature(
                  //                 [
                  //                   t.identifier('modelValue'),
                  //                   t.tsTypeAnnotation(
                  //                     t.tsInferType(
                  //                       t.tsTypeParameter(null, null, 'S'),
                  //                     ),
                  //                   ),
                  //                 ],
                  //                 { optional: true },
                  //               ),
                  //             ]),
                  //             t.tsTypeReference(t.identifier('S')),
                  //             t.tsTypeReference(t.identifier('any')),
                  //           ),
                  //         ),
                  //       ],
                  //       { optional: true },
                  //     ),
                  //   ]),
                  vModelChildsAst,
                  //   t.tsConditionalType(
                  //     t.tsTypeReference(t.identifier(propsTypeName)),
                  //     t.tsTypeLiteral([
                  //       tsPropertySignature([
                  //         t.identifier(
                  //           '[K in keyof P as K extends `onUpdate:${infer U}` ? U : never]',
                  //         ),
                  //         t.tsTypeAnnotation(
                  //           t.tsConditionalType(
                  //             t.tsTypeReference(t.identifier('K')),
                  //             t.tsTypeReference(t.identifier('any')),
                  //             t.tsConditionalType(
                  //               t.tsTypeReference(t.identifier('K')),
                  //               t.tsTypeReference(t.identifier('any')),
                  //               t.tsConditionalType(
                  //                 t.tsTypeReference(t.identifier('U')),
                  //                 t.tsTypeReference(t.identifier('keyof P')),
                  //                 t.tsIndexedAccessType(
                  //                   t.tsTypeReference(t.identifier('P')),
                  //                   t.tsTypeReference(t.identifier('U')),
                  //                 ),
                  //                 t.tsTypeReference(t.identifier('never')),
                  //               ),
                  //               t.tsTypeReference(t.identifier('never')),
                  //             ),
                  //           ),
                  //         ),
                  //       ]),
                  //     ]),
                  //     t.tsTypeLiteral([]),
                  //   ),
                ])

                $propsType.typeAnnotation = new$propsType
              }
            },
          },
        },
      },
    ],
    sourceMaps: false,
    sourceFileName: 'runtime-core.d.ts',
    configFile: false,
  })

  writeFileSync(path.resolve(__dirname, 'runtime-core.d.ts'), result!.code!)
}

main()
