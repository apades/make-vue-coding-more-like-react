import type {
  ArrowFunctionExpression,
  Node,
  Identifier,
  FunctionExpression,
  ObjectPattern,
  StringLiteral,
  TSPropertySignature,
  TSTypeParameterDeclaration,
} from '@babel/types'
import {
  isImportDefaultSpecifier,
  isImportNamespaceSpecifier,
  isImportSpecifier,
  isStringLiteral,
  isExportDefaultDeclaration,
  isAssignmentPattern,
  isBooleanLiteral,
  isIdentifier,
  isObjectPattern,
  isObjectProperty,
  isRestElement,
  isTSTypeAnnotation,
  isTSTypeLiteral,
} from '@babel/types'
import { walkIdentifiers } from '@vue/compiler-dom'
import hashId from 'hash-sum'
import { isTypeLiteralNode } from 'typescript'
import { VineBindingTypes } from './constants'
import type {
  VineCompilerHooks,
  VineFileCtx,
  VineCompFnCtx,
  VineUserImport,
  VineFnPickedInfo,
  VineAnalyzeCtx,
  VineAnalyzeRunner,
  Nil,
  TsMorphCache,
  VINE_MACRO_NAMES,
  VineDestructuredProp,
  VinePropMeta,
  JsxCompAnalyzeRunner,
} from './types'
import { VinePropsDefinitionBy } from './types'
import {
  findVineTagTemplateStringReturn,
  getAllVinePropMacroCall,
  getFunctionParams,
  getFunctionPickedInfos,
  getImportStatements,
  getJsxCompFnArguments,
  getVineMacroCalleeName,
  getVinePropCallTypeParams,
  tryInferExpressionTSType,
} from './babel-helpers/ast'
import { isImportUsed } from './template/import-usage-check'
import { createLinkedCodeTag, isBasicBoolTypeNames } from './utils'
import {
  checkForBoolean,
  resolveVineCompFnProps,
} from './ts-morph/resolve-type'
import { vineErr, vineWarn } from './diagnostics'

function analyzeFileImportStmts(vineFileCtx: VineFileCtx) {
  const { root } = vineFileCtx
  const fileImportStmts = getImportStatements(root)
  if (!fileImportStmts.length) {
    return
  }
  for (const importStmt of fileImportStmts) {
    const source = importStmt.source.value // remove quotes
    const isImportTypeStmt = importStmt.importKind === 'type'
    const allSpecifiers = importStmt.specifiers
    for (const spec of allSpecifiers) {
      const importMeta: VineUserImport = {
        source,
        isType: isImportTypeStmt,
      }
      if (isImportSpecifier(spec)) {
        const importedName = isStringLiteral(spec.imported)
          ? spec.imported.value
          : spec.imported.name
        const localName = spec.local.name
        if (spec.importKind === 'type') {
          // `import { type XXX }` from '...'
          importMeta.isType = true
        } else if (importedName === 'default') {
          // `import { default as XXX }` from '...'
          importMeta.isDefault = true
        }
        if (source === 'vue') {
          vineFileCtx.vueImportAliases[importedName] = localName || importedName
        }
        vineFileCtx.userImports[localName] = importMeta
      } else if (isImportNamespaceSpecifier(spec)) {
        // `import * as xxx from '...'`
        importMeta.isNamespace = true
        vineFileCtx.userImports[spec.local.name] = importMeta
      } else if (isImportDefaultSpecifier(spec)) {
        // `import xxx from '...'`
        importMeta.isDefault = true
        vineFileCtx.userImports[spec.local.name] = importMeta
      }

      const specLocalName = spec.local.name
      importMeta.isUsedInTemplate = (compFnCtx) =>
        isImportUsed(compFnCtx, specLocalName)
    }
  }
  const lastImportStmt = fileImportStmts[fileImportStmts.length - 1]
  vineFileCtx.importsLastLine = lastImportStmt.loc
}

function buildVineCompFnCtx(
  vineCompilerHooks: VineCompilerHooks,
  vineFileCtx: VineFileCtx,
  vineFnInfo: VineFnPickedInfo,
) {
  // Get the function AST node itself
  // - for normal function declaration `function xxx(...) {...}`:
  //       the AST node is the declaration itself
  // - for variable function declaration
  //       - `const xxx = function(...) {...}`
  //       - `const xxx = (...) => {...}`:
  //       the AST node is the the function expression
  const { fnDeclNode, fnName, fnItselfNode } = vineFnInfo
  const { templateReturn, templateStringNode } =
    findVineTagTemplateStringReturn(fnDeclNode)
  const scopeId = hashId(`${vineFileCtx.fileId}:${fnName}`)
  const templateStringQuasiNode = templateStringNode?.quasi.quasis[0]
  const templateSource = templateStringQuasiNode?.value.raw ?? ''
  const vineCompFnCtx: VineCompFnCtx = {
    fileCtx: vineFileCtx,
    isExportDefault: isExportDefaultDeclaration(fnDeclNode),
    isAsync: fnItselfNode?.async ?? false,
    isCustomElement: false,
    fnName,
    scopeId,
    fnDeclNode,
    fnItselfNode,
    templateStringNode,
    templateReturn,
    templateSource,
    templateComponentNames: new Set<string>(),
    templateRefNames: new Set<string>(),
    macrosInfoForVolar: [],
    propsDestructuredNames: {},
    propsDefinitionBy: VinePropsDefinitionBy.typeLiteral,
    propsAlias: 'props',
    emitsAlias: 'emits',
    props: {},
    emits: [],
    slots: {},
    slotsAlias: 'slots',
    slotsNamesInTemplate: ['default'], // Vue component's default slot name
    vineModels: {},
    bindings: {},
    cssBindings: {},
    externalStyleFilePaths: [],
    hoistSetupStmts: [],

    getPropsTypeRecordStr({
      joinStr = ', ',
      isNeedLinkedCodeTag = false,
      isNeedJsDoc = false,
    } = {}): string {
      const fields = Object.entries(this.props)
        .map(([propName, propMeta]) => {
          const leadingJsDoc = isNeedJsDoc
            ? `${propMeta.jsDocComments?.map((comment) => `/*${comment.value}*/`).join('\n')}\n`
            : ''
          const propNameKey =
            (isNeedLinkedCodeTag
              ? `${createLinkedCodeTag('left', propName.length)}${propName}`
              : propName) + (propMeta.isRequired ? '' : '?')

          return `${leadingJsDoc}${propNameKey}: ${propMeta.typeAnnotationRaw ?? 'any'}`
        })
        .filter(Boolean)
        .join(joinStr)

      return `{${fields.length > 0 ? `\n${fields}\n` : ''}}`
    },
  }
  const analyzeCtx: VineAnalyzeCtx = {
    vineCompilerHooks,
    vineFileCtx,
    vineCompFnCtx,
  }

  // Divide the handling into two cases
  // by the kind of the function declaration
  analyzeDifferentKindVineFunctionDecls(analyzeCtx)

  return vineCompFnCtx
}

export function analyzeJsx(
  vineCompilerHooks: VineCompilerHooks,
  vineFileCtx: VineFileCtx,
  vineCompFnDecls: Node[],
): void {
  // Analyze all import statements in this file
  // and make a userImportAlias for key methods in 'vue', like 'ref', 'reactive'
  // in order to create binding records
  analyzeFileImportStmts(vineFileCtx)

  // Analyze all Vine component function in this file
  vineCompFnDecls.forEach((vineFnCompDecl) => {
    // Get the function AST node itself
    // - for normal function declaration `function xxx(...) {...}`:
    //       the AST node is the declaration itself
    // - for variable function declaration
    //       - `const xxx = function(...) {...}`
    //       - `const xxx = (...) => {...}`:
    //       the AST node is the the function expression
    const pickedInfos = getFunctionPickedInfos(vineFnCompDecl)
    pickedInfos.forEach((vineFnInfo) => {
      vineFileCtx.vineCompFns.push(
        buildVineCompFnCtx(vineCompilerHooks, vineFileCtx, vineFnInfo),
      )
    })
  })

  // check if there are any reference
  // to identifiers that will be hoisted.
  const makeErrorOnRefHoistedIdentifiers = (
    vineFnComp: VineCompFnCtx,
    identifiers: Identifier[],
  ) => {
    for (const id of identifiers) {
      const binding = vineFnComp.bindings[id.name]
      if (binding && binding !== VineBindingTypes.LITERAL_CONST) {
        vineCompilerHooks.onError(
          vineWarn(
            { vineFileCtx },
            {
              msg: `Cannot reference "${id.name}" locally declared variables because it will be hoisted outside of component's setup() function.`,
              location: id.loc,
            },
          ),
        )
      }
    }
  }
  // check if there are any reference
  // to identifiers that will be hoisted.
  for (const vineFnComp of vineFileCtx.vineCompFns) {
    // In the following conditions:
    // - `vineProp`'s validator function
    const allValidatorFnBodys = Object.entries(vineFnComp.props)
      .filter(([_, propMeta]) => Boolean(propMeta.validator))
      .map(
        ([_, propMeta]) =>
          (
            propMeta.validator as
              | FunctionExpression
              | ArrowFunctionExpression
              | undefined
          )?.body,
      )

    for (const validatorFnBody of allValidatorFnBodys) {
      if (!validatorFnBody) {
        continue
      }
      const identifiers: Identifier[] = []
      walkIdentifiers(validatorFnBody, (id) => identifiers.push(id))
      makeErrorOnRefHoistedIdentifiers(vineFnComp, identifiers)
    }
    // - `vineOptions`'s argument object
    const vineOptionsArg = vineFnComp.options
    if (vineOptionsArg) {
      const identifiers: Identifier[] = []
      walkIdentifiers(vineOptionsArg, (id) => identifiers.push(id))
      makeErrorOnRefHoistedIdentifiers(vineFnComp, identifiers)
    }
    // - `vineModel`'s 2nd argument, its options
    if (vineFnComp.vineModels) {
      for (const { modelOptions } of Object.values(vineFnComp.vineModels)) {
        if (!modelOptions) {
          continue
        }
        const identifiers: Identifier[] = []
        walkIdentifiers(modelOptions, (id) => identifiers.push(id))
        makeErrorOnRefHoistedIdentifiers(vineFnComp, identifiers)
      }
    }
  }
}

/* 
TODO FC define

import { type FC } from '@mvcmlr/utils'

type Props = {
  a: string
}
const App:FC<Props> = (props) => {
  return <div>{props.a}</div>
}
*/
const analyzeJsxCompProps: JsxCompAnalyzeRunner = (
  { vineCompilerHooks, vineCompFnCtx, vineFileCtx },
  rootNode,
) => {
  const [propsFormalParam, refFormalParam] = getJsxCompFnArguments(
    rootNode,
  ) as any as [Identifier | ObjectPattern, Identifier | ObjectPattern]

  // The Vine validator has guranateed there's only one formal params,
  // its type is `identifier`, and it must have an object literal type annotation.
  // Save this parameter's name as `propsAlias`
  const defaultsFromDestructuredProps: Record<string, Node> = {}

  // If this formal parameter has destructuring,
  // we need to record these destructed names as `desctructedPropNames`
  if (isObjectPattern(propsFormalParam)) {
    for (const property of propsFormalParam.properties) {
      if (isRestElement(property)) {
        const restProp = property.argument as Identifier
        vineCompFnCtx.propsDestructuredNames[restProp.name] = {
          node: restProp,
          isRest: true,
        }
      } else if (isObjectProperty(property)) {
        const propItemKey = property.key as Identifier | StringLiteral
        const propItemName = isIdentifier(propItemKey)
          ? propItemKey.name
          : propItemKey.value
        const data: VineDestructuredProp = {
          node: propItemKey,
          isRest: false,
        }
        if (
          isIdentifier(property.value) &&
          property.value.name !== propItemName
        ) {
          data.alias = property.value.name
        } else if (isAssignmentPattern(property.value)) {
          data.default = property.value.right
          defaultsFromDestructuredProps[propItemName] = property.value.right
          // Check if there's an alias in the assignment pattern's left side
          if (
            isIdentifier(property.value.left) &&
            property.value.left.name !== propItemName
          ) {
            data.alias = property.value.left.name
          }
        }

        // Why we mark it as `SETUP_REF` instead of `PROPS_ALIASED`?
        // Because we will actually destructure from our user-land, customized `props`
        // which may come from `useDefaults`
        vineCompFnCtx.bindings[propItemName] = VineBindingTypes.SETUP_REF
        vineCompFnCtx.propsDestructuredNames[propItemName] = data
      }
    }
  } else {
    vineCompFnCtx.propsAlias = propsFormalParam.name
  }

  const propsTypeAnnotation = propsFormalParam.typeAnnotation
  if (!isTSTypeAnnotation(propsTypeAnnotation)) {
    return
  }

  const { typeAnnotation } = propsTypeAnnotation
  vineCompFnCtx.propsFormalParamType = typeAnnotation

  const isTypeLiteralProps = isTSTypeLiteral(typeAnnotation)
  const isContainsGenericTypeParams = (fnItselfNode.typeParameters as
    | TSTypeParameterDeclaration
    | Nil)
    ? (fnItselfNode.typeParameters as TSTypeParameterDeclaration).params
        .length > 0
    : false
  const isTsMorphDisabled =
    vineCompilerHooks.getCompilerCtx().options.tsMorphOptions?.disabled
  let tsMorphAnalyzedPropsInfo: Record<string, VinePropMeta> | undefined
  let tsMorphCache: TsMorphCache | undefined

  // Should initialize ts-morph when props is a type alias
  // or that type literal contains generic type parameters
  if (!isTypeLiteralProps || isContainsGenericTypeParams) {
    vineCompFnCtx.propsDefinitionBy = VinePropsDefinitionBy.typeReference
    tsMorphCache = getTsMorph(vineCompilerHooks)
    if (tsMorphCache) {
      // Use ts-morph to analyze props info
      tsMorphAnalyzedPropsInfo = resolveVineCompFnProps({
        tsMorphCache,
        vineCompFnCtx,
        defaultsFromDestructuredProps,
      })
    }
  }

  // 1. Fast-path for explicit type literal
  if (isTypeLiteralProps) {
    ;(typeAnnotation.members as TSPropertySignature[])?.forEach((member) => {
      if (
        (!isIdentifier(member.key) && !isStringLiteral(member.key)) ||
        !member.typeAnnotation
      ) {
        return
      }
      const propName = isIdentifier(member.key)
        ? member.key.name
        : member.key.value
      const propType = vineFileCtx.getAstNodeContent(
        member.typeAnnotation.typeAnnotation,
      )
      const propMeta: VinePropMeta = {
        isFromMacroDefine: false,
        isRequired: member.optional === undefined ? true : !member.optional,
        isMaybeBool:
          isBasicBoolTypeNames(propType) ||
          Boolean(tsMorphAnalyzedPropsInfo?.[propName]?.isMaybeBool),
        typeAnnotationRaw: propType,
      }
      vineCompFnCtx.props[propName] = propMeta

      // If the prop is already defined as a binding at destructure,
      // we should skip defining it as a PROPS binding.
      vineCompFnCtx.bindings[propName] ??= VineBindingTypes.PROPS

      if (defaultsFromDestructuredProps[propName]) {
        vineCompFnCtx.props[propName].default =
          defaultsFromDestructuredProps[propName]
      }
      if (!isIdentifier(member.key)) {
        vineCompFnCtx.props[propName].nameNeedQuoted = true
      }
    })
  }
  // 2. Use ts-morph to analyze complex props
  else if (tsMorphCache && tsMorphAnalyzedPropsInfo) {
    vineCompFnCtx.props = tsMorphAnalyzedPropsInfo
  }
  // If ts-morph is enabled, missing props info is unexpected!
  else if (!isTsMorphDisabled) {
    vineCompilerHooks.onError(
      vineErr(
        { vineFileCtx, vineCompFnCtx },
        {
          msg: `Failed to analyze props type info of '${vineCompFnCtx.fnName}'`,
          location: vineCompFnCtx.fnItselfNode?.loc,
        },
      ),
    )
  }
}
