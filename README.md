# Mind Explorer

Mind Explorer est une application locale pour classer des liens, construire un référentiel hiérarchique et créer des diagrammes UML avec Apollon.

## Démarrage

Prérequis : Node.js 20 ou plus récent et Google Chrome installé dans son emplacement Windows standard.

```bash
npm install
npm run dev
```

Le client Vite est alors disponible sur `http://localhost:5173` et l’API sur `http://localhost:3001`.

## Production

```bash
npm run build
npm run start
```

L’application complète est servie sur `http://localhost:3001`.

## Données

Le référentiel est stocké dans `~/link-explorer/referentiel.json`. Chaque modification est enregistrée par l’API sous la forme d’un document JSON complet. L’interface permet également d’exporter le référentiel ou un élément individuel, puis d’importer un groupe.

## Vérifications

```bash
npm run lint
npm run build
```
