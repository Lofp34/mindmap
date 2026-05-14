# Mind Map Radiale

Prototype d’application de mind map orientée Markdown. L’objectif est de transformer rapidement des fichiers Markdown générés par IA en carte mentale utilisable sur Mac ou iPhone, avec une réorganisation automatique des branches autour du sujet central.

## Fonctionnalités

- Import d’un fichier Markdown.
- Sauvegarde et navigation entre cartes enregistrées.
- Persistance Neon Postgres sur Vercel, avec repli localStorage en local si `DATABASE_URL` n’est pas configurée.
- Conversion des titres `#`, `##`, `###` et des listes en nœuds hiérarchiques.
- Bascule **Horloge / Vue à droite** dans la barre de carte.
- Interface responsive pensée pour le tactile et les petits écrans.

## Commandes

```bash
npm install
npm run dev
npm test
npm run build
```

Pour tester aussi l’API Vercel locale :

```bash
cp .env.example .env.local
# Remplir DATABASE_URL avec la chaîne Neon
vercel dev
```

## Base Neon

L’API `/api/maps` utilise `DATABASE_URL` et crée automatiquement la table au premier appel :

```sql
CREATE TABLE IF NOT EXISTS mind_maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  markdown TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Sur Vercel, ajoutez `DATABASE_URL` dans les variables d’environnement du projet. Avec l’intégration Neon, utilisez la chaîne de connexion Postgres fournie par Neon.

## Déploiement Vercel

Le projet est configuré pour Vercel avec `vercel.json` :

- Framework : Vite
- Install command : `npm ci`
- Build command : `npm run build`
- Output directory : `dist`
- Node.js : `24.x`
- API : `/api/maps` en Vercel Function Node.js
- Base : Neon Postgres via `DATABASE_URL`

Déploiement en preview depuis ce dossier :

```bash
npm ci
npm test
npm run build
vercel link --project mindmap-radial
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel deploy . -y
```

Si vous importez le dépôt depuis l’interface Vercel, gardez les réglages détectés par le projet : framework Vite, build `npm run build`, sortie `dist`.

## Architecture

- `src/mindmap.js` contient le parseur Markdown, les fonctions de layout et les utilitaires de parcours d’arbre.
- `src/main.js` gère l’interface, les boutons et le rendu SVG.
- `src/styles.css` contient le design responsive.
- `api/maps.js` gère la lecture et l’écriture des cartes dans Neon.
- `test/mindmap.test.js` couvre le parseur et les deux modes de réorganisation.
