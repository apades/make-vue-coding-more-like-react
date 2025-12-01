import type { Node } from '@babel/types'
import {
  isArrowFunctionExpression,
  isBlockStatement,
  isExportDefaultDeclaration,
  isExportNamedDeclaration,
  isFunctionDeclaration,
  isFunctionExpression,
  isJSXElement,
  isReturnStatement,
  isVariableDeclaration,
} from '@babel/types'
import * as t from '@babel/types'
import type { BabelFunctionNodeTypes, VineBabelRoot } from '../types'
import { isBabelFunctionTypes } from './ast'

export function isJsxElementFnDecl(target: Node) {
  if (
    (isExportNamedDeclaration(target) || isExportDefaultDeclaration(target)) &&
    target.declaration
  ) {
    target = target.declaration
  }

  if (isBabelFunctionTypes(target)) {
    return checkFunctionReturnsJsx(target)
  }

  if (isVariableDeclaration(target)) {
    const declValue = target.declarations[0].init
    if (!declValue || !isBabelFunctionTypes(declValue)) {
      return false
    }
    return checkFunctionReturnsJsx(declValue)
  }

  return false
}

export function findAllJsxFnDeclarations(root: VineBabelRoot): Node[] {
  const jsxFnDecls = new Set<Node>()
  for (const stmt of root.program.body) {
    if (isJsxElementFnDecl(stmt)) {
      jsxFnDecls.add(stmt)
    }
  }
  return [...jsxFnDecls.values()]
}

export function isJsx(node: Node | null | undefined) {
  return t.isJSX(node)
}

export function checkFunctionReturnsJsx(fn: BabelFunctionNodeTypes) {
  if (isFunctionDeclaration(fn) || isFunctionExpression(fn)) {
    const returnStmt = fn.body?.body.find((node) => isReturnStatement(node))
    if (!returnStmt) {
      return false
    }

    return isJsx(returnStmt.argument)
  }

  if (isArrowFunctionExpression(fn)) {
    const arrowFnReturns = isBlockStatement(fn.body)
      ? fn.body.body.find((node) => isReturnStatement(node))
      : fn.body
    if (isReturnStatement(arrowFnReturns)) {
      return isJsx(arrowFnReturns.argument)
    }
    return isJsx(arrowFnReturns)
  }
}
