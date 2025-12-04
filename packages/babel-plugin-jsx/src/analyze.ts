import type * as BabelCore from '@babel/core'
import { parseExpression } from '@babel/parser'
import { type NodePath } from '@babel/traverse'
import t from '@babel/types'
import {
  extractRuntimeProps,
  type SimpleTypeResolveContext,
} from '@vue/compiler-sfc'
import { getJsxFnParams } from './ast'
import type { State } from './interface'

function getTypeAnnotation(node: BabelCore.types.Node) {
  if (
    'typeAnnotation' in node &&
    node.typeAnnotation &&
    node.typeAnnotation.type === 'TSTypeAnnotation'
  ) {
    return node.typeAnnotation.typeAnnotation
  }
}

function analyzeFnPropsType(
  fnProps: t.FunctionParameter,
  ctx: SimpleTypeResolveContext,
) {
  // function App(props = {a: string} ) {}
  //                      ^^^^^^^^^^^
  if (t.isAssignmentPattern(fnProps)) {
    ctx.propsTypeDecl = getTypeAnnotation(fnProps.left)
    ctx.propsRuntimeDefaults = fnProps.right
    return
  }

  const typeAnnotation = getTypeAnnotation(fnProps)
  if (t.isTSTypeReference(typeAnnotation)) {
    ctx.propsTypeDecl = resolveTypeReference(typeAnnotation as any, ctx)
    return
  }

  ctx.propsTypeDecl = typeAnnotation
}

function resolveTypeReference(
  typeNode: t.FlowType | t.TSTypeParameter,
  ctx: SimpleTypeResolveContext,
) {
  if (!ctx) return

  if (!t.isTSTypeReference(typeNode)) return
  const typeName = getTypeReferenceName(typeNode)
  if (!typeName) return
  const typeDeclaration = findTypeDeclaration(typeName, ctx)

  return typeDeclaration as t.Node
}

function getTypeReferenceName(typeRef: BabelCore.types.TSTypeReference) {
  if (t.isIdentifier(typeRef.typeName)) {
    return typeRef.typeName.name
  } else if (t.isTSQualifiedName(typeRef.typeName)) {
    const parts: string[] = []
    let current: BabelCore.types.TSEntityName = typeRef.typeName

    while (t.isTSQualifiedName(current)) {
      if (t.isIdentifier(current.right)) {
        parts.unshift(current.right.name)
      }
      current = current.left
    }

    if (t.isIdentifier(current)) {
      parts.unshift(current.name)
    }

    return parts.join('.')
  }
  return null
}

function findTypeDeclaration(typeName: string, ctx: SimpleTypeResolveContext) {
  if (!ctx) return null

  for (const statement of ctx.ast) {
    if (
      t.isTSInterfaceDeclaration(statement) &&
      statement.id.name === typeName
    ) {
      return t.tsTypeLiteral(statement.body.body)
    }

    if (
      t.isTSTypeAliasDeclaration(statement) &&
      statement.id.name === typeName
    ) {
      return statement.typeAnnotation
    }

    if (t.isExportNamedDeclaration(statement) && statement.declaration) {
      if (
        t.isTSInterfaceDeclaration(statement.declaration) &&
        statement.declaration.id.name === typeName
      ) {
        return t.tsTypeLiteral(statement.declaration.body.body)
      }

      if (
        t.isTSTypeAliasDeclaration(statement.declaration) &&
        statement.declaration.id.name === typeName
      ) {
        return statement.declaration.typeAnnotation
      }
    }
  }

  return null
}

export function analyzeJsxFnComp(
  path: NodePath<t.FunctionDeclaration | t.ArrowFunctionExpression>,
  ctx: SimpleTypeResolveContext,
) {
  const fnProps = getJsxFnParams(path)

  const rs = {
    props: parseExpression('{}'),
    propsName: 'props' as string,
  } as const

  if (!fnProps) return rs
  if (t.isIdentifier(fnProps)) {
    ;(rs as any).propsName = fnProps.name
  }

  analyzeFnPropsType(fnProps, ctx)

  const runtimeProps = extractRuntimeProps(ctx)
  if (!runtimeProps) return rs
  ;(rs as any).props = parseExpression(runtimeProps)

  return rs
}
