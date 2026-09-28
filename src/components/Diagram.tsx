import { useMemo, useRef, useState } from 'react'
import {
  Apollon,
  UMLDiagramType,
  type ApollonEditor,
  type UMLDiagramType as UMLDiagramKind,
  type UMLModel,
} from '@tumaet/apollon'
import '@tumaet/apollon/style.css'
import { Maximize2, Save, X } from 'lucide-react'
import type { ApollonItem, ApollonViewport } from '../types'

type InternalViewportEditor = {
  reactFlowInstance?: {
    setViewport: (viewport: ApollonViewport, options?: { duration?: number }) => void
  }
}

const DIAGRAM_TYPES: Array<{ value: UMLDiagramKind; label: string }> = [
  { value: UMLDiagramType.ClassDiagram, label: 'Diagramme de classes' },
  { value: UMLDiagramType.ObjectDiagram, label: 'Diagramme d’objets' },
  { value: UMLDiagramType.ActivityDiagram, label: 'Diagramme d’activités' },
  { value: UMLDiagramType.UseCaseDiagram, label: 'Diagramme de cas d’utilisation' },
  { value: UMLDiagramType.CommunicationDiagram, label: 'Diagramme de communication' },
  { value: UMLDiagramType.ComponentDiagram, label: 'Diagramme de composants' },
  { value: UMLDiagramType.DeploymentDiagram, label: 'Diagramme de déploiement' },
  { value: UMLDiagramType.PetriNet, label: 'Réseau de Petri' },
  { value: UMLDiagramType.ReachabilityGraph, label: 'Graphe d’accessibilité' },
  { value: UMLDiagramType.SyntaxTree, label: 'Arbre syntaxique' },
  { value: UMLDiagramType.Flowchart, label: 'Organigramme' },
  { value: UMLDiagramType.BPMN, label: 'Diagramme BPMN' },
  { value: UMLDiagramType.Sfc, label: 'Diagramme SFC' },
]

function parseModel(content: string): UMLModel | undefined {
  if (!content.trim()) return undefined
  try {
    return JSON.parse(content) as UMLModel
  } catch {
    return undefined
  }
}

function restoreViewport(editor: ApollonEditor, viewport?: ApollonViewport): () => void {
  const timeout = window.setTimeout(() => {
    if (viewport) {
      // Apollon exposes viewport reading but not yet a public setter. Its mounted
      // ReactFlow instance provides the matching setter used internally by Apollon.
      const internalEditor = editor as unknown as InternalViewportEditor
      internalEditor.reactFlowInstance?.setViewport(viewport, { duration: 0 })
    } else {
      editor.fitView({ duration: 0 })
    }
  }, 180)
  return () => window.clearTimeout(timeout)
}

export function DiagramPreview({ item, onEdit }: { item: ApollonItem; onEdit: () => void }) {
  const model = useMemo(() => parseModel(item.content), [item.content])

  if (!model) {
    return (
      <div className="diagram-preview diagram-preview--empty">
        <div>
          <span className="eyebrow">Diagramme UML</span>
          <strong>Nouveau diagramme</strong>
          <p>Ouvrez l’éditeur pour commencer à modéliser.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onEdit}>
          <Maximize2 size={16} /> Ouvrir l’éditeur
        </button>
      </div>
    )
  }

  return (
    <div className="diagram-preview">
      <div className="diagram-preview__bar">
        <div>
          <span className="eyebrow">Diagramme UML</span>
          <strong>{model.title || 'Sans titre'}</strong>
        </div>
        <button className="icon-text-button" type="button" onClick={onEdit}>
          <Maximize2 size={16} /> Modifier
        </button>
      </div>
      <div className="diagram-preview__canvas">
        <Apollon
          key={item.content}
          style={{ height: 260 }}
          defaultModel={model}
          readonly
          keyboardShortcuts={false}
          onMount={(editor) => restoreViewport(editor, item.params?.viewport)}
        />
      </div>
    </div>
  )
}

type DiagramEditorProps = {
  item: ApollonItem
  onCancel: () => void
  onSave: (item: ApollonItem) => void
}

export function DiagramEditor({ item, onCancel, onSave }: DiagramEditorProps) {
  const model = useMemo(() => parseModel(item.content), [item.content])
  const editorRef = useRef<ApollonEditor | null>(null)
  const latestModel = useRef<UMLModel | undefined>(model)
  const [diagramType, setDiagramType] = useState<UMLDiagramKind>(model?.type ?? UMLDiagramType.ClassDiagram)

  function changeDiagramType(nextType: UMLDiagramKind) {
    if (nextType === diagramType) return
    const editor = editorRef.current
    if (
      editor &&
      editor.getNodes().length > 0 &&
      !window.confirm('Changer de type effacera les éléments du diagramme actuel. Continuer ?')
    ) {
      return
    }
    setDiagramType(nextType)
    if (editor) {
      editor.diagramType = nextType
      latestModel.current = editor.model
    }
  }

  function handleSave() {
    const editor = editorRef.current
    const currentModel = editor?.model ?? latestModel.current
    if (!currentModel) return
    const viewport = editor?.getViewport() ?? item.params?.viewport
    onSave({
      ...item,
      content: JSON.stringify(currentModel),
      params: {
        ...item.params,
        ...(viewport ? { viewport } : {}),
      },
    })
  }

  return (
    <div className="diagram-editor" role="dialog" aria-modal="true" aria-label="Éditeur de diagramme UML">
      <header className="diagram-editor__header">
        <div className="brand brand--compact">
          <span className="brand__mark">M</span>
          <div>
            <span>Mind Explorer</span>
            <small>Éditeur UML</small>
          </div>
        </div>
        <label className="diagram-type-select">
          <span>Type de diagramme</span>
          <select value={diagramType} onChange={(event) => changeDiagramType(event.target.value as UMLDiagramKind)}>
            {DIAGRAM_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </label>
        <div className="diagram-editor__actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            <X size={17} /> Fermer
          </button>
          <button className="primary-button" type="button" onClick={handleSave}>
            <Save size={17} /> Enregistrer le diagramme
          </button>
        </div>
      </header>
      <main className="diagram-editor__canvas">
        <Apollon
          style={{ height: '100%' }}
          defaultModel={model}
          defaultType={diagramType}
          onMount={(editor) => {
            editorRef.current = editor
            latestModel.current = editor.model
            const subscription = editor.subscribeToModelChange((nextModel) => {
              latestModel.current = nextModel
            })
            const cancelRestore = restoreViewport(editor, item.params?.viewport)
            return () => {
              cancelRestore()
              editor.unsubscribe(subscription)
              editorRef.current = null
            }
          }}
        />
      </main>
    </div>
  )
}
