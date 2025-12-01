import type { Project, TypeChecker } from 'ts-morph'
export interface TsMorphCache {
  project: Project
  typeChecker: TypeChecker
}
