import { spawn } from 'node:child_process'
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

type Organisation = 'horizontal' | 'verticale'

type LinkItem = {
  type: 'link'
  titre: string
  url: string
  note?: string
  imageUrl?: string
}

type Group = {
  type: 'groupTree' | 'groupBlock' | 'groupPage'
  titre: string
  imageUrl?: string
  organisation: Organisation
  elements: ExplorerItem[]
}

type ApollonItem = {
  type: 'apollon'
  content: string
  params?: Record<string, unknown>
}

type ExplorerItem = LinkItem | Group | ApollonItem
type GroupTree = Group & { type: 'groupTree' }

const INITIAL_DIRECTORY: GroupTree = {
  type: 'groupTree',
  titre: 'Mes liens',
  organisation: 'verticale',
  elements: [],
}

const DATA_DIRECTORY = path.join(homedir(), 'link-explorer')
const DATA_FILE = path.join(DATA_DIRECTORY, 'referentiel.json')
const TEMP_FILE = path.join(DATA_DIRECTORY, 'referentiel.tmp.json')
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isValidOrganisation(value: unknown): value is Organisation {
  return value === 'horizontal' || value === 'verticale'
}

function isValidItem(value: unknown): value is ExplorerItem {
  if (!isRecord(value) || typeof value.type !== 'string') return false

  if (value.type === 'link') {
    return (
      typeof value.titre === 'string' &&
      typeof value.url === 'string' &&
      isOptionalString(value.note) &&
      isOptionalString(value.imageUrl)
    )
  }

  if (value.type === 'apollon') {
    if (typeof value.content !== 'string') return false
    if (value.params !== undefined && !isRecord(value.params)) return false
    const viewport = isRecord(value.params) ? value.params.viewport : undefined
    return (
      viewport === undefined ||
      (isRecord(viewport) &&
        typeof viewport.x === 'number' &&
        Number.isFinite(viewport.x) &&
        typeof viewport.y === 'number' &&
        Number.isFinite(viewport.y) &&
        typeof viewport.zoom === 'number' &&
        Number.isFinite(viewport.zoom))
    )
  }

  if (value.type === 'groupTree' || value.type === 'groupBlock' || value.type === 'groupPage') {
    return (
      typeof value.titre === 'string' &&
      isOptionalString(value.imageUrl) &&
      isValidOrganisation(value.organisation) &&
      Array.isArray(value.elements) &&
      value.elements.every(isValidItem)
    )
  }

  return false
}

function isValidDirectory(value: unknown): value is GroupTree {
  return isValidItem(value) && value.type === 'groupTree'
}

async function persistDirectory(directory: GroupTree): Promise<void> {
  await mkdir(DATA_DIRECTORY, { recursive: true })
  await writeFile(TEMP_FILE, `${JSON.stringify(directory, null, 2)}\n`, 'utf8')
  await rename(TEMP_FILE, DATA_FILE)
}

async function readDirectory(): Promise<GroupTree> {
  try {
    const content = await readFile(DATA_FILE, 'utf8')
    const parsed: unknown = JSON.parse(content)
    if (!isValidDirectory(parsed)) throw new Error('Le fichier de référentiel est invalide.')
    return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await persistDirectory(INITIAL_DIRECTORY)
    return INITIAL_DIRECTORY
  }
}

const app = express()
app.use(express.json({ limit: '15mb' }))

app.get('/api/lireReferentiel', async (_request, response) => {
  try {
    response.json(await readDirectory())
  } catch (error) {
    console.error('Lecture du référentiel impossible :', error)
    response.status(500).json({ erreur: 'Impossible de lire le référentiel.' })
  }
})

app.put('/api/ecrireReferentiel', async (request, response) => {
  if (!isValidDirectory(request.body)) {
    response.status(400).json({ erreur: 'Le référentiel doit être un groupe valide.' })
    return
  }

  try {
    await persistDirectory(request.body)
    response.status(204).end()
  } catch (error) {
    console.error('Écriture du référentiel impossible :', error)
    response.status(500).json({ erreur: 'Impossible d’écrire le référentiel.' })
  }
})

app.post('/api/ouvrirLien', async (request, response) => {
  try {
    const rawUrl = isRecord(request.body) ? request.body.url : undefined
    if (typeof rawUrl !== 'string') throw new Error('URL absente')
    const url = new URL(rawUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Protocole invalide')
    await access(CHROME_PATH, constants.X_OK)
    const child = spawn(CHROME_PATH, [url.toString()], { detached: true, stdio: 'ignore' })
    child.unref()
    response.status(204).end()
  } catch (error) {
    console.error('Ouverture du lien impossible :', error)
    response.status(400).json({ erreur: 'L’URL est invalide ou Google Chrome est introuvable.' })
  }
})

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientDirectory = path.join(currentDirectory, '..', 'dist')
app.use(express.static(clientDirectory))
app.get(/^(?!\/api).*/, (_request, response) => {
  response.sendFile(path.join(clientDirectory, 'index.html'))
})

const port = Number.parseInt(process.env.PORT ?? '3001', 10)
app.listen(port, () => {
  console.log(`Mind Explorer est disponible sur http://localhost:${port}`)
})
