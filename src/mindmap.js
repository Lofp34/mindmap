export const SAMPLE_MARKDOWN = `# Projet IA personnel

## Idées
### Importer des fichiers Markdown
### Nettoyer les titres générés par IA
### Garder les notes importantes

## Plan d'action
### Prototype web
### Test sur iPhone
### Export image

## Contraintes
### Utilisation hors ligne
### Gestes tactiles simples
### Réorganisation automatique

## Opportunités
### Partage rapide
### Plusieurs cartes
### Modèles visuels`;

const MARKDOWN_HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function createNode(title, depth = 0) {
  return {
    id: cryptoSafeId(title),
    title: title.trim() || 'Sans titre',
    depth,
    children: [],
    x: 0,
    y: 0,
    angle: 0,
  };
}

export function parseMarkdownToTree(markdown) {
  const root = createNode('Mind Map', 0);
  const stack = [root];
  const lines = markdown.split(/\r?\n/);
  let centralTitleApplied = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(MARKDOWN_HEADING);
    if (heading) {
      const level = heading[1].length;
      const title = normalizeMarkdownText(heading[2]);

      if (level === 1 && !centralTitleApplied) {
        root.title = title;
        centralTitleApplied = true;
        continue;
      }

      while (stack.length > level) stack.pop();
      const parent = stack[Math.max(0, stack.length - 1)] || root;
      const node = createNode(title, level);
      parent.children.push(node);
      stack[level] = node;
      stack.length = level + 1;
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (bullet) {
      const parent = stack[stack.length - 1] || root;
      parent.children.push(createNode(normalizeMarkdownText(bullet[1]), parent.depth + 1));
    }
  }

  if (!root.children.length) {
    root.children.push(createNode('Collez un fichier Markdown avec des titres ou des listes', 1));
  }

  return root;
}

export function layoutClockwise(root, options = {}) {
  const width = options.width ?? 1200;
  const height = options.height ?? 800;
  const centerX = width / 2;
  const centerY = height / 2;
  const firstRing = Math.min(width, height) * 0.27;
  const depthGap = Math.max(130, Math.min(width, height) * 0.16);

  root.x = centerX;
  root.y = centerY;
  root.angle = 0;

  const branches = root.children;
  const count = Math.max(branches.length, 1);

  branches.forEach((branch, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    placeNode(branch, centerX, centerY, angle, firstRing, depthGap, 1);
  });

  return root;
}

export function layoutRightBiased(root, options = {}) {
  const width = options.width ?? 1200;
  const height = options.height ?? 800;
  const centerX = width * 0.28;
  const centerY = height / 2;
  const verticalStep = 110;

  root.x = centerX;
  root.y = centerY;
  root.angle = 0;

  const startY = centerY - ((root.children.length - 1) * verticalStep) / 2;
  root.children.forEach((branch, index) => {
    placeRight(branch, centerX + 260, startY + index * verticalStep, 0);
  });

  return root;
}

export function flattenTree(root) {
  const nodes = [];
  const links = [];

  function walk(node, parent = null) {
    nodes.push(node);
    if (parent) links.push({ source: parent, target: node });
    node.children.forEach((child) => walk(child, node));
  }

  walk(root);
  return { nodes, links };
}

export function cloneTree(node) {
  return {
    ...node,
    children: node.children.map(cloneTree),
  };
}

function placeNode(node, centerX, centerY, angle, radius, depthGap, depth) {
  node.angle = angle;
  node.x = centerX + Math.cos(angle) * radius;
  node.y = centerY + Math.sin(angle) * radius;

  const childCount = node.children.length;
  if (!childCount) return;

  const spread = Math.min(Math.PI * 0.78, Math.max(Math.PI / 5, childCount * 0.28));
  const start = angle - spread / 2;

  node.children.forEach((child, index) => {
    const childAngle = childCount === 1 ? angle : start + (index * spread) / (childCount - 1);
    placeNode(child, centerX, centerY, childAngle, radius + depthGap * (1 + depth * 0.08), depthGap, depth + 1);
  });
}

function placeRight(node, x, y, depth) {
  node.x = x + depth * 210;
  node.y = y;
  node.angle = 0;
  const startY = y - ((node.children.length - 1) * 78) / 2;
  node.children.forEach((child, index) => placeRight(child, x + 210, startY + index * 78, depth + 1));
}

function normalizeMarkdownText(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}

function cryptoSafeId(title) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${slugify(title)}-${random}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'node';
}
