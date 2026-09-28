import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  FolderOpen,
  FolderTree,
  Home,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  Scissors,
  Trash2,
  Undo2,
} from 'lucide-react'
import { loadDirectory as fetchDirectory, openLink as requestOpenLink, saveDirectory as writeDirectory } from './api'
import { DiagramEditor, DiagramPreview } from './components/Diagram'
import { ItemEditorModal, type EditorModalState } from './components/ItemEditorModal'
import {
  adjustDestinationAfterRemoval,
  getGroupAtPath,
  getItemAtPath,
  insertItem,
  isDescendantPath,
  isSamePath,
  listAncestors,
  pathKey,
  removeItemAtPath,
  replaceItem,
} from './tree'
import {
  cloneDirectory,
  cloneItem,
  isGroup,
  type ApollonItem,
  type Clipboard,
  type CreatableKind,
  type EditorDraft,
  type ExplorerGroup,
  type ExplorerItem,
  type GroupPage,
  type GroupTree,
  type ItemPath,
  type LinkItem,
} from './types'
import './explorer.css'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type Toast = { message: string; tone: 'success' | 'error' | 'info' }

const EMPTY_DRAFT: EditorDraft = {
  kind: 'link',
  titre: '',
  url: '',
  note: '',
  imageUrl: '',
  organisation: 'verticale',
}

function draftFromItem(item: ExplorerItem): EditorDraft {
  if (item.type === 'link') {
    return {
      kind: item.type,
      titre: item.titre,
      url: item.url,
      note: item.note ?? '',
      imageUrl: item.imageUrl ?? '',
      organisation: 'verticale',
    }
  }
  if (item.type === 'apollon') return { ...EMPTY_DRAFT, kind: 'apollon' }
  return {
    ...EMPTY_DRAFT,
    kind: item.type,
    titre: item.titre,
    imageUrl: item.imageUrl ?? '',
    organisation: item.organisation,
  }
}

function itemFromDraft(draft: EditorDraft, original?: ExplorerItem): ExplorerItem {
  if (draft.kind === 'link') {
    return {
      type: 'link',
      titre: draft.titre.trim(),
      url: draft.url.trim(),
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      ...(draft.imageUrl.trim() ? { imageUrl: draft.imageUrl.trim() } : {}),
    }
  }
  if (draft.kind === 'apollon') {
    return original?.type === 'apollon' ? cloneItem(original) : { type: 'apollon', content: '' }
  }
  const previousElements = original && isGroup(original) ? original.elements : []
  return {
    type: draft.kind,
    titre: draft.titre.trim(),
    organisation: draft.organisation,
    elements: previousElements,
    ...(draft.imageUrl.trim() ? { imageUrl: draft.imageUrl.trim() } : {}),
  }
}

function itemLabel(item: ExplorerItem): string {
  return item.type === 'apollon' ? 'Diagramme UML' : item.titre
}

export default function ExplorerApp() {
  const [directory, setDirectory] = useState<GroupTree | null>(null)
  const directoryRef = useRef<GroupTree | null>(null)
  const [loadError, setLoadError] = useState('')
  const [, setSaveState] = useState<SaveState>('idle')
  const [history, setHistory] = useState<GroupTree[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [currentPagePath, setCurrentPagePath] = useState<ItemPath | null>(null)
  const [clipboard, setClipboard] = useState<Clipboard | null>(null)
  const [modal, setModal] = useState<EditorModalState | null>(null)
  const [diagramSession, setDiagramSession] = useState<{ item: ApollonItem; path: ItemPath } | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve())
  const saveRevisionRef = useRef(0)

  useEffect(() => {
    void (async () => {
      try {
        const loaded = await fetchDirectory()
        directoryRef.current = loaded
        setDirectory(loaded)
        setSaveState('saved')
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Impossible de charger le référentiel.')
      }
    })()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    function closeMenu() {
      setActiveMenu(null)
    }
    window.addEventListener('pointerdown', closeMenu)
    return () => window.removeEventListener('pointerdown', closeMenu)
  }, [])

  useEffect(() => {
    if (!directory || !currentPagePath) return
    const page = getItemAtPath(directory, currentPagePath)
    if (!page || page.type !== 'groupPage') setCurrentPagePath(null)
  }, [directory, currentPagePath])

  const currentPage = useMemo(() => {
    if (!directory || !currentPagePath) return null
    const item = getItemAtPath(directory, currentPagePath)
    return item?.type === 'groupPage' ? item : null
  }, [directory, currentPagePath])

  function notify(message: string, tone: Toast['tone'] = 'info') {
    setToast({ message, tone })
  }

  function persist(next: GroupTree, recordHistory = true) {
    const previous = directoryRef.current
    if (recordHistory && previous) {
      setHistory((items) => [...items.slice(-29), cloneDirectory(previous)])
    }
    directoryRef.current = next
    setDirectory(next)
    setSaveState('saving')
    const revision = ++saveRevisionRef.current
    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(() => writeDirectory(next))
      .then(() => {
        if (saveRevisionRef.current === revision) setSaveState('saved')
      })
      .catch((error: unknown) => {
        if (saveRevisionRef.current === revision) setSaveState('error')
        notify(error instanceof Error ? error.message : 'La sauvegarde a échoué.', 'error')
      })
  }

  function undo() {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((items) => items.slice(0, -1))
    setCurrentPagePath(null)
    persist(cloneDirectory(previous), false)
    notify('Dernière modification annulée.', 'success')
  }

  function toggleGroup(path: ItemPath) {
    const key = pathKey(path)
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function expandAncestors(path: ItemPath) {
    setExpanded((current) => {
      const next = new Set(current)
      for (let depth = 1; depth <= path.length; depth += 1) next.add(pathKey(path.slice(0, depth)))
      return next
    })
  }

  function openPage(path: ItemPath) {
    setCurrentPagePath(path)
    expandAncestors(path)
  }

  function navigateTo(path: ItemPath | null) {
    if (!path || path.length === 0) {
      setCurrentPagePath(null)
      return
    }
    if (!directory) return
    const item = getItemAtPath(directory, path)
    if (item?.type === 'groupPage') openPage(path)
  }

  async function openLink(url: string) {
    try {
      await requestOpenLink(url)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Impossible d’ouvrir le lien.', 'error')
    }
  }

  function toggleNote(path: ItemPath) {
    const key = pathKey(path)
    setExpandedNotes((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function startCreation(parentPath: ItemPath, index: number | null = null, kind: CreatableKind = 'link') {
    setModal({
      mode: 'create',
      parentPath,
      index,
      draft: { ...EMPTY_DRAFT, kind },
    })
  }

  function addRelative(targetPath: ItemPath, position: 'before' | 'after') {
    const index = Number.parseInt(targetPath.at(-1) ?? '0', 10) + (position === 'after' ? 1 : 0)
    startCreation(targetPath.slice(0, -1), index)
  }

  function startEdition(item: ExplorerItem | GroupTree, path: ItemPath) {
    if (item.type === 'apollon') {
      setDiagramSession({ item, path })
      return
    }
    setModal({
      mode: 'edit',
      parentPath: path.slice(0, -1),
      index: path.length ? Number.parseInt(path.at(-1) ?? '0', 10) : null,
      path,
      original: item,
      draft: draftFromItem(item),
    })
  }

  function submitEdition() {
    if (!directory || !modal) return
    const item = itemFromDraft(modal.draft, modal.original)
    if (item.type !== 'apollon' && !item.titre) {
      notify('Le titre est obligatoire.', 'error')
      return
    }

    if (modal.mode === 'create') {
      const result = insertItem(directory, modal.parentPath, item, modal.index)
      setModal(null)
      persist(result.directory)
      if (item.type === 'apollon') setDiagramSession({ item, path: result.insertedPath })
      else notify('Élément ajouté.', 'success')
      return
    }

    const path = modal.path ?? []
    let next: GroupTree
    if (path.length === 0 && isGroup(item)) {
      next = { ...directory, titre: item.titre, imageUrl: item.imageUrl, organisation: item.organisation }
    } else {
      next = replaceItem(directory, path, item)
    }
    setModal(null)
    persist(next)
    notify('Modifications enregistrées.', 'success')
  }

  function removeItem(path: ItemPath) {
    if (!directory) return
    const item = getItemAtPath(directory, path)
    if (!item || !window.confirm(`Supprimer « ${itemLabel(item)} » et tout son contenu ?`)) return
    const result = removeItemAtPath(directory, path)
    if (!result.removed) return
    if (currentPagePath && (isSamePath(currentPagePath, path) || isDescendantPath(currentPagePath, path))) {
      setCurrentPagePath(null)
    }
    if (clipboard?.mode === 'cut' && isSamePath(clipboard.originPath, path)) setClipboard(null)
    persist(result.directory)
    notify('Élément supprimé.', 'success')
  }

  function copyOrCutItem(item: ExplorerItem, path: ItemPath, mode: Clipboard['mode']) {
    setClipboard({ item: cloneItem(item), mode, originPath: [...path] })
    notify(mode === 'copy' ? 'Élément copié.' : 'Élément prêt à être déplacé.')
  }

  function canPasteInto(path: ItemPath): boolean {
    if (!clipboard || !directory || !getGroupAtPath(directory, path)) return false
    if (clipboard.mode === 'cut') {
      if (isSamePath(path, clipboard.originPath) || isDescendantPath(path, clipboard.originPath)) return false
    }
    return true
  }

  function pasteInto(path: ItemPath, index: number | null = null) {
    if (!directory || !clipboard || !canPasteInto(path)) return
    let base = directory
    let destinationPath = path
    if (clipboard.mode === 'cut') {
      const removal = removeItemAtPath(base, clipboard.originPath)
      if (!removal.removed) {
        notify('L’élément à déplacer n’existe plus.', 'error')
        setClipboard(null)
        return
      }
      base = removal.directory
      destinationPath = adjustDestinationAfterRemoval(clipboard.originPath, path)
    }
    const insertion = insertItem(base, destinationPath, clipboard.item, index)
    persist(insertion.directory)
    if (clipboard.mode === 'cut') setClipboard(null)
    notify(clipboard.mode === 'copy' ? 'Copie collée.' : 'Élément déplacé.', 'success')
  }

  function exportItem(item: ExplorerItem | GroupTree) {
    const blob = new Blob([`${JSON.stringify(item, null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const title = item.type === 'apollon' ? 'diagramme-uml' : item.titre
    anchor.href = url
    anchor.download = `${title.toLowerCase().replace(/[^a-z0-9à-ÿ]+/gi, '-').replace(/^-|-$/g, '') || 'element'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function saveDiagram(item: ApollonItem) {
    if (!directory || !diagramSession) return
    const next = replaceItem(directory, diagramSession.path, item)
    persist(next)
    setDiagramSession(null)
    notify('Diagramme enregistré.', 'success')
  }

  function withMenuClosed(action: () => void) {
    setActiveMenu(null)
    action()
  }

  function ItemActions({ item, path, placement = 'card' }: { item: ExplorerItem; path: ItemPath; placement?: 'tree' | 'card' }) {
    const key = pathKey(path)
    const menuKey = `menu:${key}`
    const group = isGroup(item)
    return (
      <div className={`item-actions item-actions--${placement}`} onPointerDown={(event) => event.stopPropagation()}>
        <button
          className="icon-button icon-button--small"
          type="button"
          aria-label={`Actions pour ${itemLabel(item)}`}
          aria-expanded={activeMenu === menuKey}
          onClick={(event) => {
            event.stopPropagation()
            setActiveMenu((current) => (current === menuKey ? null : menuKey))
          }}
        >
          <Ellipsis size={17} />
        </button>
        {activeMenu === menuKey && (
          <div className="action-menu" role="menu" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => withMenuClosed(() => startEdition(item, path))}>
              <Pencil size={15} /> {item.type === 'apollon' ? 'Ouvrir l’éditeur' : 'Modifier'}
            </button>
            <div className="action-menu__separator" />
            <button type="button" onClick={() => withMenuClosed(() => addRelative(path, 'before'))}>
              <Plus size={15} /> Ajouter avant
            </button>
            <button type="button" onClick={() => withMenuClosed(() => addRelative(path, 'after'))}>
              <Plus size={15} /> Ajouter après
            </button>
            {group && (
              <button type="button" onClick={() => withMenuClosed(() => startCreation(path))}>
                <FolderOpen size={15} /> Ajouter à l’intérieur
              </button>
            )}
            {group && clipboard && (
              <button type="button" disabled={!canPasteInto(path)} onClick={() => withMenuClosed(() => pasteInto(path))}>
                <ClipboardPaste size={15} /> Coller à l’intérieur
              </button>
            )}
            <div className="action-menu__separator" />
            <button type="button" onClick={() => withMenuClosed(() => copyOrCutItem(item, path, 'copy'))}>
              <Copy size={15} /> Copier
            </button>
            <button type="button" onClick={() => withMenuClosed(() => copyOrCutItem(item, path, 'cut'))}>
              <Scissors size={15} /> Couper
            </button>
            <button type="button" onClick={() => withMenuClosed(() => exportItem(item))}>
              <Download size={15} /> Exporter en JSON
            </button>
            {history.length > 0 && (
              <button type="button" onClick={() => withMenuClosed(undo)}>
                <Undo2 size={15} /> Annuler la dernière modification
              </button>
            )}
            <div className="action-menu__separator" />
            <button className="danger-action" type="button" onClick={() => withMenuClosed(() => removeItem(path))}>
              <Trash2 size={15} /> Supprimer
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderLink(item: LinkItem, path: ItemPath) {
    const noteOpen = expandedNotes.has(pathKey(path))
    return (
      <article className="link-card content-card">
        {item.imageUrl && <img className="link-card__image" src={item.imageUrl} alt="" onError={(event) => (event.currentTarget.style.display = 'none')} />}
        <div className="link-card__body">
          <div className="content-card__topline">
            <span className="type-label"><Link2 size={13} /> Lien</span>
            <ItemActions item={item} path={path} />
          </div>
          <h3>{item.titre}</h3>
          <p className="link-card__url">{item.url.replace(/^https?:\/\//, '')}</p>
          {item.note && (
            <div className="link-note">
              <button type="button" onClick={() => toggleNote(path)}>
                {noteOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Note
              </button>
              {noteOpen && <p>{item.note}</p>}
            </div>
          )}
          <button className="open-link-button" type="button" onClick={() => void openLink(item.url)}>
            Ouvrir dans Chrome <ExternalLink size={15} />
          </button>
        </div>
      </article>
    )
  }

  function renderBlockGroup(group: ExplorerGroup & { type: 'groupBlock' }, path: ItemPath) {
    return (
      <section className="block-group content-card">
        {group.imageUrl && <img className="group-cover" src={group.imageUrl} alt="" onError={(event) => (event.currentTarget.style.display = 'none')} />}
        <div className="block-group__header">
          <div>
            <span className="type-label"><Box size={13} /> Groupe bloc</span>
            <h3>{group.titre}</h3>
          </div>
          <ItemActions item={group} path={path} />
        </div>
        <div className={`items-layout items-layout--${group.organisation}`}>
          {group.elements.map((item, index) => renderContentItem(item, [...path, String(index)]))}
          {group.elements.length === 0 && <InlineEmpty onAdd={() => startCreation(path)} />}
        </div>
      </section>
    )
  }

  function renderTreeGroup(group: ExplorerGroup & { type: 'groupTree' }, path: ItemPath) {
    const open = expanded.has(pathKey(path))
    return (
      <section className="tree-group content-card">
        {group.imageUrl && <img className="group-cover" src={group.imageUrl} alt="" onError={(event) => (event.currentTarget.style.display = 'none')} />}
        <div className="tree-group__header">
          <button className="tree-group__toggle" type="button" onClick={() => toggleGroup(path)}>
            <span className="group-icon group-icon--tree"><FolderTree size={19} /></span>
            <span>
              <span className="type-label">Groupe arborescent</span>
              <strong>{group.titre}</strong>
            </span>
            {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          <ItemActions item={group} path={path} />
        </div>
        {open && (
          <div className={`items-layout items-layout--${group.organisation} tree-group__content`}>
            {group.elements.map((item, index) => renderContentItem(item, [...path, String(index)]))}
            {group.elements.length === 0 && <InlineEmpty onAdd={() => startCreation(path)} />}
          </div>
        )}
      </section>
    )
  }

  function renderPageCard(group: GroupPage, path: ItemPath) {
    return (
      <article className="page-card content-card" onClick={() => openPage(path)}>
        <div className="page-card__visual">
          {group.imageUrl ? (
            <img className="page-card__image" src={group.imageUrl} alt="" onError={(event) => (event.currentTarget.style.display = 'none')} />
          ) : (
            <FileText size={18} />
          )}
        </div>
        <div className="page-card__body">
          <span className="type-label">Page</span>
          <h3>{group.titre}</h3>
        </div>
        <span className="page-card__count">{group.elements.length}</span>
        <ItemActions item={group} path={path} />
        <ChevronRight className="page-card__chevron" size={17} />
      </article>
    )
  }

  function renderContentItem(item: ExplorerItem, path: ItemPath): ReactNode {
    if (item.type === 'link') return <div key={pathKey(path)}>{renderLink(item, path)}</div>
    if (item.type === 'groupBlock') return <div key={pathKey(path)}>{renderBlockGroup(item, path)}</div>
    if (item.type === 'groupTree') return <div key={pathKey(path)}>{renderTreeGroup(item, path)}</div>
    if (item.type === 'groupPage') return <div key={pathKey(path)}>{renderPageCard(item, path)}</div>
    return (
      <div key={pathKey(path)} className="diagram-wrapper content-card">
        <ItemActions item={item} path={path} />
        <DiagramPreview item={item} onEdit={() => setDiagramSession({ item, path })} />
      </div>
    )
  }

  function InlineEmpty({ onAdd }: { onAdd: () => void }) {
    return (
      <button className="inline-empty" type="button" onClick={onAdd}>
        <Plus size={17} /> Ajouter un premier élément
      </button>
    )
  }

  function renderHome() {
    if (!directory) return null
    if (directory.elements.length) {
      return (
        <div className={`root-layout items-layout--${directory.organisation}`}>
          {directory.elements.map((item, index) => renderContentItem(item, [String(index)]))}
        </div>
      )
    }
    return (
      <section className="empty-state">
        <div className="empty-state__icon"><FolderOpen size={28} /></div>
        <h2>Le référentiel est vide</h2>
        <button className="primary-button" type="button" onClick={() => startCreation([])}>
          <Plus size={17} /> Ajouter un élément
        </button>
      </section>
    )
  }

  function renderPage(group: GroupPage, path: ItemPath) {
    if (!directory) return null
    const crumbs = listAncestors(directory, path).filter(({ item }, index) => index === 0 || item.type === 'groupPage')
    return (
      <>
        <nav className="breadcrumbs" aria-label="Fil d’Ariane">
          {crumbs.map(({ item, path: crumbPath }, index) => (
            <span key={pathKey(crumbPath) || 'root'}>
              {index > 0 && <ChevronRight size={14} />}
              <button type="button" onClick={() => navigateTo(crumbPath)}>
                {index === 0 && <Home size={14} />} {item.titre}
              </button>
            </span>
          ))}
        </nav>
        {group.elements.length ? (
          <div className={`page-content items-layout--${group.organisation}`}>
            {group.elements.map((item, index) => renderContentItem(item, [...path, String(index)]))}
          </div>
        ) : (
          <section className="empty-state empty-state--compact">
            <FileText size={28} />
            <h2>Cette page est vide</h2>
            <button className="primary-button" type="button" onClick={() => startCreation(path)}><Plus size={16} /> Ajouter un élément</button>
          </section>
        )}
      </>
    )
  }

  if (loadError) {
    return (
      <main className="fatal-state">
        <AlertCircle size={36} />
        <h1>Le référentiel ne répond pas</h1>
        <p>{loadError}</p>
        <button className="primary-button" type="button" onClick={() => window.location.reload()}>Réessayer</button>
      </main>
    )
  }

  if (!directory) {
    return (
      <main className="loading-state">
        <div className="brand__mark">M</div>
        <LoaderCircle className="spin" size={22} />
        <span>Ouverture de votre espace…</span>
      </main>
    )
  }

  return (
    <div className="app-shell app-shell--full">
      <section className="workspace">
        <main className="workspace__content">{currentPage && currentPagePath ? renderPage(currentPage, currentPagePath) : renderHome()}</main>
      </section>

      {modal && (
        <ItemEditorModal
          state={modal}
          onChange={(draft) => setModal((current) => (current ? { ...current, draft } : null))}
          onClose={() => setModal(null)}
          onSubmit={submitEdition}
        />
      )}
      {diagramSession && <DiagramEditor item={diagramSession.item} onCancel={() => setDiagramSession(null)} onSave={saveDiagram} />}
      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status">
          {toast.tone === 'error' ? <AlertCircle size={17} /> : toast.tone === 'success' ? <CheckCircle2 size={17} /> : <FileText size={17} />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
