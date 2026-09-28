export type Organisation = 'horizontal' | 'verticale'

export type LinkItem = {
  type: 'link'
  titre: string
  url: string
  note?: string
  imageUrl?: string
}

export type GroupTree = {
  type: 'groupTree'
  titre: string
  imageUrl?: string
  organisation: Organisation
  elements: ExplorerItem[]
}

export type GroupBlock = {
  type: 'groupBlock'
  titre: string
  imageUrl?: string
  organisation: Organisation
  elements: ExplorerItem[]
}

export type GroupPage = {
  type: 'groupPage'
  titre: string
  imageUrl?: string
  organisation: Organisation
  elements: ExplorerItem[]
}

export type ApollonViewport = {
  x: number
  y: number
  zoom: number
}

export type ApollonItem = {
  type: 'apollon'
  content: string
  params?: {
    viewport?: ApollonViewport
    [key: string]: unknown
  }
}

export type ExplorerGroup = GroupTree | GroupBlock | GroupPage
export type ExplorerItem = LinkItem | ExplorerGroup | ApollonItem
export type ItemPath = string[]
export type InsertPosition = number | null
export type ClipboardMode = 'copy' | 'cut'
export type GroupKind = ExplorerGroup['type']
export type CreatableKind = 'link' | GroupKind | 'apollon'

export type Clipboard = {
  item: ExplorerItem
  mode: ClipboardMode
  originPath: ItemPath
}

export type EditorDraft = {
  kind: CreatableKind
  titre: string
  url: string
  note: string
  imageUrl: string
  organisation: Organisation
}

export const EMPTY_DIRECTORY: GroupTree = {
  type: 'groupTree',
  titre: 'Mes liens',
  organisation: 'verticale',
  elements: [],
}

export function isGroup(item: ExplorerItem): item is ExplorerGroup {
  return item.type === 'groupTree' || item.type === 'groupBlock' || item.type === 'groupPage'
}

export function cloneDirectory(directory: GroupTree): GroupTree {
  return structuredClone(directory)
}

export function cloneItem(item: ExplorerItem): ExplorerItem {
  return structuredClone(item)
}
