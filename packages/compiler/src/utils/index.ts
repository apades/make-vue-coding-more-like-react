import { traverse } from '@babel/types'

export function createLinkedCodeTag(
  side: 'left' | 'right',
  itemLength: number,
) {
  return `/* __LINKED_CODE_${side.toUpperCase()}__#${itemLength} */`
}

export function isBasicBoolTypeNames(type: string): boolean {
  return ['boolean', 'Boolean', 'true', 'false'].includes(type)
}

export class ExitTraverseError extends Error {
  constructor() {
    super('ExitTraverse')
  }
}
export const exitTraverse: ExitTraverseError = new ExitTraverseError()
export const _breakableTraverse: typeof traverse = (node, handlers) => {
  try {
    return traverse(node, handlers)
  } catch (e) {
    if (e instanceof ExitTraverseError) {
      return
    }
    // else:
    throw e
  }
}

export function showIf(condition: boolean, s: string, not?: string): string {
  return condition ? s : (not ?? '')
}

export function filterJoin(arr: string[], join: string): string {
  return arr.filter(Boolean).join(join)
}

export function appendToMapArray<K extends object, V>(
  storeMap: WeakMap<K, V[]>,
  key: K,
  value: V,
): void {
  const arr = storeMap.get(key)
  if (!arr) {
    storeMap.set(key, [value])
  } else {
    arr.push(value)
  }
}
