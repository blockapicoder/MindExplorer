import { useEffect, useRef } from 'react'
import { Box, FileText, FolderTree, Link2, Network, X } from 'lucide-react'
import type { CreatableKind, EditorDraft, ExplorerItem, ItemPath } from '../types'

export type EditorModalState = {
  mode: 'create' | 'edit'
  parentPath: ItemPath
  index: number | null
  path?: ItemPath
  original?: ExplorerItem
  draft: EditorDraft
}

const typeOptions: Array<{ value: CreatableKind; label: string; icon: typeof Link2 }> = [
  { value: 'link', label: 'Lien', icon: Link2 },
  { value: 'groupTree', label: 'Groupe arborescent', icon: FolderTree },
  { value: 'groupBlock', label: 'Groupe bloc', icon: Box },
  { value: 'groupPage', label: 'Groupe page', icon: FileText },
  { value: 'apollon', label: 'Diagramme UML', icon: Network },
]

function availableTypes(state: EditorModalState) {
  if (state.mode === 'create') return typeOptions
  if (state.path?.length === 0) return typeOptions.filter((option) => option.value === 'groupTree')
  if (state.original?.type === 'link') return typeOptions.filter((option) => option.value === 'link')
  if (state.original?.type === 'apollon') return typeOptions.filter((option) => option.value === 'apollon')
  return typeOptions.filter((option) => option.value.startsWith('group'))
}

type Props = {
  state: EditorModalState
  onChange: (draft: EditorDraft) => void
  onClose: () => void
  onSubmit: () => void
}

export function ItemEditorModal({ state, onChange, onClose, onSubmit }: Props) {
  const titleRef = useRef<HTMLInputElement>(null)
  const onCloseRef = useRef(onClose)
  const isLink = state.draft.kind === 'link'
  const isGroup = state.draft.kind.startsWith('group')
  const isDiagram = state.draft.kind === 'apollon'
  const options = availableTypes(state)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    titleRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function update<Key extends keyof EditorDraft>(key: Key, value: EditorDraft[Key]) {
    onChange({ ...state.draft, [key]: value })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="editor-modal__header">
          <div>
            <span className="eyebrow">{state.mode === 'create' ? 'Nouvel élément' : 'Modification'}</span>
            <h2 id="editor-title">
              {state.mode === 'create' ? 'Ajouter à votre univers' : 'Mettre à jour l’élément'}
            </h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <label className="field">
            <span>Type d’élément</span>
            <select value={state.draft.kind} onChange={(event) => update('kind', event.target.value as CreatableKind)}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {!isDiagram && (
            <label className="field">
              <span>Titre</span>
              <input
                ref={titleRef}
                value={state.draft.titre}
                onChange={(event) => update('titre', event.target.value)}
                placeholder={isLink ? 'Ex. Documentation React' : 'Ex. Ressources de design'}
                required
              />
            </label>
          )}

          {isLink && (
            <>
              <label className="field">
                <span>Adresse du lien</span>
                <input
                  type="url"
                  value={state.draft.url}
                  onChange={(event) => update('url', event.target.value)}
                  placeholder="https://example.com"
                  required
                />
              </label>
              <label className="field">
                <span>Note <em>facultative</em></span>
                <textarea
                  value={state.draft.note}
                  onChange={(event) => update('note', event.target.value)}
                  placeholder="Pourquoi ce lien est utile…"
                  rows={4}
                />
              </label>
            </>
          )}

          {!isDiagram && (
            <label className="field">
              <span>Image <em>facultative</em></span>
              <input
                type="url"
                value={state.draft.imageUrl}
                onChange={(event) => update('imageUrl', event.target.value)}
                placeholder="https://…/image.jpg"
              />
            </label>
          )}

          {isGroup && (
            <fieldset className="field fieldset">
              <legend>Organisation des éléments</legend>
              <div className="segmented-control">
                <label>
                  <input
                    type="radio"
                    name="organisation"
                    checked={state.draft.organisation === 'verticale'}
                    onChange={() => update('organisation', 'verticale')}
                  />
                  <span>Verticale</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="organisation"
                    checked={state.draft.organisation === 'horizontal'}
                    onChange={() => update('organisation', 'horizontal')}
                  />
                  <span>Horizontale</span>
                </label>
              </div>
            </fieldset>
          )}

          {isDiagram && (
            <div className="diagram-callout">
              <Network size={24} />
              <div>
                <strong>Éditeur Apollon plein écran</strong>
                <p>Le diagramme sera ajouté, puis l’éditeur s’ouvrira pour vous laisser choisir et construire votre modèle.</p>
              </div>
            </div>
          )}

          <div className="editor-modal__footer">
            <button className="secondary-button" type="button" onClick={onClose}>Annuler</button>
            <button className="primary-button" type="submit">
              {isDiagram ? 'Créer et ouvrir' : state.mode === 'create' ? 'Ajouter' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
