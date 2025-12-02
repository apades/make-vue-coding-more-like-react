import { dirname, extname, isAbsolute, resolve } from 'node:path'
import { getTsconfig } from 'get-tsconfig'
import { Project, Node as TmNode } from 'ts-morph'
import type {
  FunctionDeclaration,
  VariableDeclaration,
  FunctionExpression,
  ArrowFunction,
  TaggedTemplateExpression,
  Symbol,
} from 'ts-morph'
import type t from '@babel/types'
import type { TsMorphCache } from './types'
import type { State } from './interface'

interface CreateTsMorphOptions {
  fileId?: string
  tsConfigPath?: string
}

function resolveTsConfigResult(options: CreateTsMorphOptions) {
  const { fileId, tsConfigPath } = options
  try {
    if (tsConfigPath) {
      // If it's a file path (has extension), use dirname; otherwise use as-is
      const searchPath = extname(tsConfigPath)
        ? dirname(tsConfigPath)
        : tsConfigPath
      return getTsconfig(searchPath)
    }
    if (fileId) {
      // If it's a file path (has extension), use dirname; otherwise use as-is (directory)
      const searchPath = extname(fileId) ? dirname(fileId) : fileId
      return getTsconfig(searchPath)
    }
    return undefined
  } catch (err) {
    console.error(err)
    return undefined
  }
}

function createByConfigFile(options: CreateTsMorphOptions) {
  const tsconfig = resolveTsConfigResult(options)
  if (!tsconfig) {
    return
  }

  const project = new Project({
    tsConfigFilePath: tsconfig.path,
    compilerOptions: {
      strict: true, // Ensure more accurate type analysis
    },
  })

  // Read the reference configurations
  const tsconfigDir = dirname(tsconfig.path)
  tsconfig.config.references?.forEach((ref) => {
    project.addSourceFilesFromTsConfig(
      isAbsolute(ref.path) ? ref.path : resolve(tsconfigDir, ref.path),
    )
  })

  return project
}

let tsMorphCache: TsMorphCache | undefined

export function getTsMorph(): TsMorphCache {
  if (!tsMorphCache) {
    throw Error('No ts-morph project created')
  }
  return tsMorphCache
}

export function createTsMorph(options: CreateTsMorphOptions): TsMorphCache {
  const project = createByConfigFile(options)
  if (!project) {
    throw new Error('[Vue Vine] Failed to create ts-morph project')
  }

  const typeChecker = project.getTypeChecker()

  tsMorphCache = {
    project,
    typeChecker,
  }

  return tsMorphCache
}

export function resolveJsxCompFnProps(params: {
  tsMorphCache: TsMorphCache
  fnName: string
  state: State
}) {
  const { tsMorphCache, state, fnName } = params
  const { typeChecker, project } = tsMorphCache
  const sourceFile = project.getSourceFile(state.file.opts.sourceFileName!)
  if (!sourceFile) {
    return {}
  }

  const propsInfo: Record<string, Symbol> = {}

  const targetFn = sourceFile.getFirstDescendant(tsAstFindJsxCompFn(fnName)) as
    | FunctionDeclaration
    | VariableDeclaration
    | undefined

  if (!targetFn) {
    return propsInfo
  }
  const propsParams = (
    TmNode.isFunctionDeclaration(targetFn)
      ? targetFn.getParameters()
      : (
          targetFn.getInitializer() as FunctionExpression | ArrowFunction
        )?.getParameters()
  )?.[0]

  if (!propsParams) {
    return propsInfo
  }
  const propsIdentifier = propsParams.getNameNode()
  const propsType = propsIdentifier.getType()

  for (const prop of propsType.getProperties()) {
    const propType = typeChecker.getTypeOfSymbolAtLocation(
      prop,
      propsIdentifier,
    )

    const propName = prop.getName()

    // Regular expression to test if a string is a valid JavaScript identifier
    const identRE = /^[_$a-z\xA0-\uFFFF][\w$\xA0-\uFFFF]*$/i
    // Check if prop name is not a valid identifier (e.g., kebab-case like 'aria-atomic')
    const nameNeedQuoted = !identRE.test(propName)

    propsInfo[propName] = prop
  }

  return propsInfo
}

function tsAstFindJsxCompFn(
  jsxCompFnName: string,
): Parameters<TmNode['getFirstDescendant']>[0] {
  return (node) => {
    // Function declaration: function ...() {}
    if (!TmNode.isFunctionDeclaration(node)) {
      // Variable declaration: const ... = () => {} / const ... = function() {}
      if (
        !TmNode.isVariableDeclaration(node) ||
        !node.getInitializer() ||
        (!TmNode.isFunctionExpression(node.getInitializer()) &&
          !TmNode.isArrowFunction(node.getInitializer()))
      ) {
        return false
      }
    }

    const body = TmNode.isFunctionDeclaration(node)
      ? node.getBody()
      : (node.getInitializer() as FunctionExpression | ArrowFunction).getBody()
    if (!body) {
      return false
    }

    // Look for return statement with tagged template literal tagged with `vine`
    const returnStatement = body.getFirstDescendant(
      (nodeInReturnStmt) =>
        TmNode.isReturnStatement(nodeInReturnStmt) &&
        TmNode.isJsxExpression(nodeInReturnStmt.getExpression()),
    )

    const fnName = TmNode.isFunctionDeclaration(node)
      ? node.getName()
      : node.getNameNode()?.getText()

    return !!returnStatement && fnName === jsxCompFnName
  }
}
