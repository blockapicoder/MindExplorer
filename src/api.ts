import type { GroupTree } from './types'

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { erreur?: string }
    return data.erreur ?? `Erreur HTTP ${response.status}`
  } catch {
    return `Erreur HTTP ${response.status}`
  }
}

export async function loadDirectory(): Promise<GroupTree> {
  const response = await fetch('/api/lireReferentiel')
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as GroupTree
}

export async function saveDirectory(directory: GroupTree): Promise<void> {
  const response = await fetch('/api/ecrireReferentiel', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(directory),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

export async function openLink(url: string): Promise<void> {
  const response = await fetch('/api/ouvrirLien', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) throw new Error(await parseError(response))
}
