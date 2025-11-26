import type { ParseResult } from '@babel/parser'
import type {
  ExportNamedDeclaration,
  File,
  Node,
  TaggedTemplateExpression,
  ImportDeclaration,
  ReturnStatement,
  Identifier,
  VariableDeclarator,
  CallExpression,
  TSType,
} from '@babel/types'
import {
  isExportNamedDeclaration,
  isExportDefaultDeclaration,
  isVariableDeclaration,
  isArrowFunctionExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isBlockStatement,
  isReturnStatement,
  isIdentifier,
  isTaggedTemplateExpression,
  isImportDeclaration,
  traverse,
  isVariableDeclarator,
  isCallExpression,
  isMemberExpression,
} from '@babel/types'
import type {
  BabelFunctionNodeTypes,
  BabelFunctionParams,
  Nil,
  VINE_MACRO_NAMES,
  VineBabelRoot,
  VineFnPickedInfo,
  VinePropMacroInfo,
} from '../types'
import { _breakableTraverse, exitTraverse } from '../utils'
import { VINE_MACROS } from '../constants'

export function isCallOf(
  node: Node | null | undefined,
  test: string | ((id: string) => boolean) | null | undefined,
): node is CallExpression {
  return !!(
    node &&
    test &&
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    (typeof test === 'string'
      ? node.callee.name === test
      : test(node.callee.name))
  )
}

export function fineAllExplicitExports(
  exportNamedDeclarations: ExportNamedDeclaration[],
): string[] {
  const explicitExports: string[] = []
  for (const exportDecl of exportNamedDeclarations) {
    for (const specifier of exportDecl.specifiers) {
      if (isIdentifier(specifier.exported)) {
        explicitExports.push(specifier.exported.name)
      }
    }
  }
  return explicitExports
}

export function isStatementContainsVineMacroCall(node: Node): boolean {
  let result = false
  _breakableTraverse(node, (descendant) => {
    if (isVineMacroCallExpression(descendant)) {
      result = true
      throw exitTraverse
    }
  })
  return result
}

export function isVineMacroCallExpression(node: Node): node is CallExpression {
  if (isCallExpression(node)) {
    const calleeName = getVineMacroCalleeName(node)
    return (VINE_MACROS as any as string[]).includes(calleeName)
  }
  return false
}

export function tryInferExpressionTSType(node: Node): string {
  switch (node.type) {
    case 'BooleanLiteral':
      return 'boolean'
    case 'NumericLiteral':
      return 'number'
    case 'BigIntLiteral':
      return 'bigint'
    case 'StringLiteral':
      return 'string'
    case 'NullLiteral':
      return 'null'
    case 'Identifier':
      return node.name === 'undefined' ? 'undefined' : `typeof ${node.name}`

    default:
      return 'any' // Can't infer
  }
}

export function getVinePropCallTypeParams(
  node: CallExpression,
): TSType | undefined {
  // We restricted the `vineProp` can only have 1 type parameter
  return node.typeParameters?.params?.[0]
}

/**
 * Check if it belongs to a certain category of macro instead of directly checking callee name
 * @param name - The name of the macro or an array of macro names
 */
export function isVineMacroOf(
  name: VINE_MACRO_NAMES | Array<VINE_MACRO_NAMES>,
) {
  return (node: Node | Nil): node is CallExpression => {
    if (!isCallExpression(node)) {
      return false
    }

    const macroCalleeName = getVineMacroCalleeName(node) as VINE_MACRO_NAMES
    return Array.isArray(name)
      ? name.includes(macroCalleeName)
      : macroCalleeName.includes(name)
  }
}
export function getVineMacroCalleeName(node: CallExpression): string {
  const callee = node.callee
  if (isIdentifier(callee)) {
    return callee.name
  }
  if (isMemberExpression(callee)) {
    // Recursively build the member expression chain
    const buildMemberPath = (node: Node): string => {
      if (isIdentifier(node)) {
        return node.name
      }
      if (isMemberExpression(node)) {
        const objPath = buildMemberPath(node.object)
        if (isIdentifier(node.property)) {
          return `${objPath}.${node.property.name}`
        }
      }
      return ''
    }

    return buildMemberPath(callee)
  }
  return ''
}

export function getAllVinePropMacroCall(
  fnItselfNode: BabelFunctionNodeTypes,
): VinePropMacroInfo[] {
  const allVinePropMacroCalls: VinePropMacroInfo[] = [] // [macro Call, defined prop name]
  traverse(fnItselfNode.body, {
    enter(node, parent) {
      if (!isVineMacroOf('vineProp')(node)) {
        return
      }

      const statement = parent.find((ancestor) =>
        isVariableDeclaration(ancestor.node),
      )
      const propVarDeclarator = parent.find(
        (ancestor) =>
          isVariableDeclarator(ancestor.node) && isIdentifier(ancestor.node.id),
      )
      if (!propVarDeclarator) {
        return
      }
      const propVarIdentifier = (propVarDeclarator.node as VariableDeclarator)
        .id as Identifier
      allVinePropMacroCalls.push({
        macroCall: node,
        identifier: propVarIdentifier,
        jsDocComments:
          statement?.node.leadingComments?.filter(
            (comment) => comment.type === 'CommentBlock',
          ) ?? [],
      })
    },
  })

  return allVinePropMacroCalls
}

export function getFunctionParams(
  fnItselfNode: BabelFunctionNodeTypes,
): BabelFunctionParams {
  const params: BabelFunctionParams = []
  if (isFunctionDeclaration(fnItselfNode)) {
    params.push(...fnItselfNode.params)
  } else if (
    isFunctionExpression(fnItselfNode) ||
    isArrowFunctionExpression(fnItselfNode)
  ) {
    params.push(...fnItselfNode.params)
  }
  return params
}

export function findVineTagTemplateStringReturn(node: Node): {
  templateReturn: ReturnStatement | undefined
  templateStringNode: TaggedTemplateExpression | undefined
} {
  let templateReturn: ReturnStatement | undefined
  let templateStringNode: TaggedTemplateExpression | undefined
  traverse(node, (descendant) => {
    if (isReturnStatement(descendant)) {
      templateReturn = descendant

      if (isVineTaggedTemplateString(descendant.argument)) {
        templateStringNode = descendant.argument
      }
    }
  })
  return {
    templateReturn,
    templateStringNode,
  }
}

export function getFunctionPickedInfos(fnDecl: Node): VineFnPickedInfo[] {
  const pickedInfo: Array<{
    fnDeclNode: Node
    fnItselfNode: BabelFunctionNodeTypes
    fnName: string
  }> = []

  let target = fnDecl
  const isExportDefault = isExportDefaultDeclaration(fnDecl)
  if (
    (isExportNamedDeclaration(target) || isExportDefaultDeclaration(target)) &&
    target.declaration
  ) {
    target = target.declaration
  }

  if (isVariableDeclaration(target)) {
    target.declarations.forEach((decl) => {
      if (
        (isFunctionExpression(decl.init) ||
          isArrowFunctionExpression(decl.init)) &&
        isIdentifier(decl.id)
      ) {
        pickedInfo.push({
          fnDeclNode: fnDecl,
          fnItselfNode: decl.init,
          fnName: decl.id.name,
        })
      }
    })

    return pickedInfo
  }

  if (isFunctionDeclaration(target)) {
    pickedInfo.push({
      fnDeclNode: fnDecl,
      fnItselfNode: target,
      fnName: target.id?.name ?? '',
    })
  }

  if (isFunctionExpression(target) || isArrowFunctionExpression(target)) {
    pickedInfo.push({
      fnDeclNode: fnDecl,
      fnItselfNode: target,
      fnName: isExportDefault
        ? isArrowFunctionExpression(target)
          ? 'default'
          : ''
        : '',
    })
  }

  return pickedInfo
}

export function getImportStatements(
  root: ParseResult<File>,
): ImportDeclaration[] {
  const importStmts: ImportDeclaration[] = []
  for (const stmt of root.program.body) {
    if (isImportDeclaration(stmt)) {
      importStmts.push(stmt)
    }
  }
  return importStmts
}

// TO isTsxElementFnDecl
export function isVineCompFnDecl(target: Node): boolean {
  if (
    (isExportNamedDeclaration(target) || isExportDefaultDeclaration(target)) &&
    target.declaration
  ) {
    target = target.declaration
  }

  if (isBabelFunctionTypes(target)) {
    return checkFunctionReturnsVineTemplate(target)
  }

  if (isVariableDeclaration(target)) {
    const declValue = target.declarations[0].init
    if (!declValue || !isBabelFunctionTypes(declValue)) {
      return false
    }
    return checkFunctionReturnsVineTemplate(declValue)
  }

  return false
}

export function isVineTaggedTemplateString(
  node: Node | null | undefined,
): node is TaggedTemplateExpression {
  return (
    isTaggedTemplateExpression(node) &&
    isIdentifier(node.tag) &&
    node.tag.name === 'vine'
  )
}

function checkFunctionReturnsVineTemplate(fn: BabelFunctionNodeTypes): boolean {
  if (isFunctionDeclaration(fn) || isFunctionExpression(fn)) {
    const returnStmt = fn.body?.body.find((node) => isReturnStatement(node))
    if (!returnStmt) {
      return false
    }
    return !!(
      returnStmt.argument && isVineTaggedTemplateString(returnStmt.argument)
    )
  }

  if (isArrowFunctionExpression(fn)) {
    const arrowFnReturns = isBlockStatement(fn.body)
      ? fn.body.body.find((node) => isReturnStatement(node))
      : fn.body
    if (isReturnStatement(arrowFnReturns)) {
      return !!(
        arrowFnReturns.argument &&
        isVineTaggedTemplateString(arrowFnReturns.argument)
      )
    }
    return isVineTaggedTemplateString(arrowFnReturns)
  }

  return false
}

export function isBabelFunctionTypes(
  node: Node,
): node is BabelFunctionNodeTypes {
  return (
    isFunctionDeclaration(node) ||
    isFunctionExpression(node) ||
    isArrowFunctionExpression(node)
  )
}

export function findVineCompFnDecls(root: VineBabelRoot): Node[] {
  const vineFnComps: Node[] = []
  for (const stmt of root.program.body) {
    if (isVineCompFnDecl(stmt)) {
      vineFnComps.push(stmt)
    }
  }
  return vineFnComps
}

export function findAllExportNamedDeclarations(
  root: ParseResult<File>,
): ExportNamedDeclaration[] {
  const exportNamedDeclarations: ExportNamedDeclaration[] = []
  for (const stmt of root.program.body) {
    if (isExportNamedDeclaration(stmt)) {
      exportNamedDeclarations.push(stmt)
    }
  }

  return exportNamedDeclarations
}
