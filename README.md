# Mind Map Radiale

Prototype d’application de mind map orientée Markdown. L’objectif est de transformer rapidement des fichiers Markdown générés par IA en carte mentale utilisable sur Mac ou iPhone, avec une réorganisation automatique des branches autour du sujet central.

## Fonctionnalités

- Import par collage d’un document Markdown.
- Conversion des titres `#`, `##`, `###` et des listes en nœuds hiérarchiques.
- Bouton **Réorganiser en horloge** pour répartir les sujets principaux de façon uniforme autour du nœud central.
- Bouton **Vue à droite** pour comparer avec une disposition classique où les branches partent du côté droit.
- Interface responsive pensée pour le tactile et les petits écrans.

## Commandes

```bash
npm install
npm run dev
npm test
npm run build
```

## Déploiement Vercel

Le projet est configuré pour Vercel avec `vercel.json` :

- Framework : Vite
- Install command : `npm ci`
- Build command : `npm run build`
- Output directory : `dist`
- Node.js : `24.x`

Déploiement en preview depuis ce dossier :

```bash
npm ci
npm test
npm run build
vercel link --project mindmap-radial
vercel deploy . -y
```

Si vous importez le dépôt depuis l’interface Vercel, gardez les réglages détectés par le projet : framework Vite, build `npm run build`, sortie `dist`.

## Architecture

- `src/mindmap.js` contient le parseur Markdown, les fonctions de layout et les utilitaires de parcours d’arbre.
- `src/main.js` gère l’interface, les boutons et le rendu SVG.
- `src/styles.css` contient le design responsive.
- `test/mindmap.test.js` couvre le parseur et les deux modes de réorganisation.
