import type { ExplorerGroup, ExplorerItem, GroupTree, ItemPath } from './types'
import { cloneDirectory, isGroup } from './types'

export function pathKey(path: ItemPath): string {
  return path.join('/')
}

export function pathToIndexes(path: ItemPath): number[] {
  return path.map((part) => Number.parseInt(part, 10))
}

export function getItemAtPath(directory: GroupTree, path: ItemPath): ExplorerItem | GroupTree | null {
  if (path.length === 0) return directory

  let current: ExplorerGroup = directory
  for (let depth = 0; depth < path.length; depth += 1) {
    const index = Number.parseInt(path[depth], 10)
    const item: ExplorerItem | undefined = current.elements[index]
    if (!item) return null
    if (depth === path.length - 1) return item
    if (!isGroup(item)) return null
    current = item
  }
  return null
}

export function getGroupAtPath(directory: GroupTree, path: ItemPath): ExplorerGroup | null {
  const item = getItemAtPath(directory, path)
  return item && isGroup(item) ? item : null
}

function getMutableGroupAtPath(directory: GroupTree, path: ItemPath): ExplorerGroup | null {
  if (path.length === 0) return directory
  let current: ExplorerGroup = directory
  for (const segment of path) {
    const next: ExplorerItem | undefined = current.elements[Number.parseInt(segment, 10)]
    if (!next || !isGroup(next)) return null
    current = next
  }
  return current
}

export function insertItem(
  directory: GroupTree,
  parentPath: ItemPath,
  item: ExplorerItem,
  index: number | null = null,
): { directory: GroupTree; insertedPath: ItemPath } {
  const next = cloneDirectory(directory)
  const parent = getMutableGroupAtPath(next, parentPath)
  if (!parent) return { directory, insertedPath: parentPath }

  const safeIndex = index === null ? parent.elements.length : Math.max(0, Math.min(index, parent.elements.length))
  parent.elements.splice(safeIndex, 0, structuredClone(item))
  return { directory: next, insertedPath: [...parentPath, String(safeIndex)] }
}

export function replaceItem(directory: GroupTree, path: ItemPath, item: ExplorerItem): GroupTree {
  if (path.length === 0) return directory
  const next = cloneDirectory(directory)
  const parent = getMutableGroupAtPath(next, path.slice(0, -1))
  const index = Number.parseInt(path.at(-1) ?? '', 10)
  if (!parent || !parent.elements[index]) return directory
  parent.elements[index] = structuredClone(item)
  return next
}

export function removeItemAtPath(
  directory: GroupTree,
  path: ItemPath,
): { directory: GroupTree; removed: ExplorerItem | null } {
  if (path.length === 0) return { directory, removed: null }
  const next = cloneDirectory(directory)
  const parent = getMutableGroupAtPath(next, path.slice(0, -1))
  const index = Number.parseInt(path.at(-1) ?? '', 10)
  if (!parent || !parent.elements[index]) return { directory, removed: null }
  const [removed] = parent.elements.splice(index, 1)
  return { directory: next, removed }
}

export function isSamePath(left: ItemPath, right: ItemPath): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

export function isDescendantPath(candidate: ItemPath, parent: ItemPath): boolean {
  return candidate.length > parent.length && parent.every((segment, index) => candidate[index] === segment)
}

export function adjustDestinationAfterRemoval(origin: ItemPath, destination: ItemPath): ItemPath {
  if (origin.length === 0 || destination.length === 0) return destination
  const originParent = origin.slice(0, -1)
  const commonParent = originParent.every((segment, index) => destination[index] === segment)
  if (!commonParent || destination.length <= originParent.length) return destination

  const removedIndex = Number.parseInt(origin.at(-1) ?? '', 10)
  const destinationIndex = Number.parseInt(destination[originParent.length], 10)
  if (destinationIndex <= removedIndex) return destination

  const adjusted = [...destination]
  adjusted[originParent.length] = String(destinationIndex - 1)
  return adjusted
}

export function listAncestors(directory: GroupTree, path: ItemPath): Array<{ item: ExplorerGroup; path: ItemPath }> {
  const result: Array<{ item: ExplorerGroup; path: ItemPath }> = [{ item: directory, path: [] }]
  for (let depth = 1; depth <= path.length; depth += 1) {
    const currentPath = path.slice(0, depth)
    const item = getItemAtPath(directory, currentPath)
    if (item && isGroup(item)) result.push({ item, path: currentPath })
  }
  return result
}

export function countItems(group: ExplorerGroup): number {
  return group.elements.reduce((count, item) => count + 1 + (isGroup(item) ? countItems(item) : 0), 0)
}
