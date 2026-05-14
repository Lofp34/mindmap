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

export function estimateNodeSize(node) {
  const isRoot = node.depth === 0;
  const lines = wrapNodeTitle(node.title, isRoot ? 30 : 28);
  return {
    width: isRoot ? 240 : Math.min(320, Math.max(160, Math.max(...lines.map((line) => line.length)) * 7.6 + 44)),
    height: Math.max(isRoot ? 70 : 52, lines.length * 19 + (isRoot ? 36 : 30)),
    lines,
  };
}

export function wrapNodeTitle(title, maxChars = 28) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ['Sans titre'];

  const lines = [];
  let line = '';

  words.forEach((word) => {
    const chunks = splitLongWord(word, maxChars);
    chunks.forEach((chunk) => {
      const next = line ? `${line} ${chunk}` : chunk;
      if (next.length > maxChars && line) {
        lines.push(line);
        line = chunk;
      } else {
        line = next;
      }
    });
  });

  if (line) lines.push(line);
  return lines;
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

  normalizeDepths(root);
  return root;
}

export function treeToMarkdown(root) {
  const lines = [`# ${root.title}`];

  function walk(node) {
    node.children.forEach((child) => {
      const level = Math.min(child.depth + 1, 6);
      lines.push('', `${'#'.repeat(level)} ${child.title}`);
      walk(child);
    });
  }

  walk(root);
  return lines.join('\n');
}

export function visibleTree(root, options = {}) {
  const expandedIds = options.expandedIds ?? new Set();
  const depthLimit = Number.isFinite(options.depthLimit) ? options.depthLimit : Infinity;

  function cloneVisible(node) {
    const showChildren = node.depth < depthLimit || expandedIds.has(node.id);
    const clone = {
      ...node,
      hasChildren: node.children.length > 0,
      hiddenChildren: showChildren ? 0 : node.children.length,
      children: showChildren ? node.children.map(cloneVisible) : [],
    };

    if (showChildren) {
      clone.hiddenChildren = node.children.reduce((count, child, index) => (
        count + (clone.children[index]?.hiddenChildren ?? child.children.length)
      ), 0);
    }

    return clone;
  }

  return cloneVisible(root);
}

export function findNode(root, id) {
  if (root.id === id) return root;
  for (const child of root.children) {
    const match = findNode(child, id);
    if (match) return match;
  }
  return null;
}

export function findParent(root, id, parent = null) {
  if (root.id === id) return parent;
  for (const child of root.children) {
    const match = findParent(child, id, root);
    if (match) return match;
  }
  return null;
}

export function addChildNode(root, parentId, title) {
  const parent = findNode(root, parentId);
  if (!parent) return null;
  const child = createNode(title, parent.depth + 1);
  parent.children.push(child);
  normalizeDepths(root);
  return child;
}

export function addSiblingNode(root, siblingId, title) {
  const parent = findParent(root, siblingId);
  if (!parent) return null;
  const siblingIndex = parent.children.findIndex((child) => child.id === siblingId);
  if (siblingIndex < 0) return null;
  const sibling = createNode(title, parent.depth + 1);
  parent.children.splice(siblingIndex + 1, 0, sibling);
  normalizeDepths(root);
  return sibling;
}

export function removeNode(root, id) {
  const parent = findParent(root, id);
  if (!parent) return null;
  const index = parent.children.findIndex((child) => child.id === id);
  if (index < 0) return null;
  const [removed] = parent.children.splice(index, 1);
  normalizeDepths(root);
  return { removed, parent };
}

export function layoutClockwise(root, options = {}) {
  const width = options.width ?? 1200;
  const height = options.height ?? 800;
  const padding = options.padding ?? 120;
  const radiusByDepth = computeRadialRadii(root);
  const leafCount = countLeaves(root);
  let cursor = 0;

  root.x = 0;
  root.y = 0;
  root.angle = 0;

  root.children.forEach((branch) => {
    const leaves = countLeaves(branch);
    const start = cursor;
    const end = cursor + leaves;
    cursor = end;
    placeRadial(branch, start, end, leafCount, radiusByDepth);
  });

  normalizeLayout(root, padding, width, height);
  return root;
}

export function layoutRightBiased(root, options = {}) {
  const width = options.width ?? 1200;
  const height = options.height ?? 800;
  const padding = options.padding ?? 120;
  const depthGap = options.depthGap ?? 280;
  const rowGap = options.rowGap ?? 92;
  let row = 0;

  placeRight(root, 0, depthGap, rowGap, () => row++);
  normalizeLayout(root, padding, width, height);
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

function normalizeDepths(root, depth = 0) {
  root.depth = depth;
  root.children.forEach((child) => normalizeDepths(child, depth + 1));
}

function computeRadialRadii(root) {
  const depthCounts = new Map();
  const maxWidthByDepth = new Map();

  function collect(node) {
    const size = estimateNodeSize(node);
    depthCounts.set(node.depth, (depthCounts.get(node.depth) ?? 0) + 1);
    maxWidthByDepth.set(node.depth, Math.max(maxWidthByDepth.get(node.depth) ?? 0, size.width));
    node.children.forEach(collect);
  }

  collect(root);

  const radii = [0];
  const maxDepth = Math.max(...depthCounts.keys());
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const count = depthCounts.get(depth) ?? 1;
    const minArc = (maxWidthByDepth.get(depth) ?? 180) + 92;
    const circumferenceRadius = (count * minArc) / (Math.PI * 2);
    const previous = radii[depth - 1] ?? 0;
    radii[depth] = Math.max(previous + 270, 210 + depth * 78, circumferenceRadius);
  }

  return radii;
}

function placeRadial(node, start, end, totalLeaves, radiusByDepth) {
  const mid = (start + end) / 2;
  const angle = -Math.PI / 2 + (mid * Math.PI * 2) / Math.max(totalLeaves, 1);
  const radius = radiusByDepth[node.depth] ?? (node.depth * 220);

  node.angle = angle;
  node.x = Math.cos(angle) * radius;
  node.y = Math.sin(angle) * radius;

  let cursor = start;
  node.children.forEach((child) => {
    const leaves = countLeaves(child);
    placeRadial(child, cursor, cursor + leaves, totalLeaves, radiusByDepth);
    cursor += leaves;
  });
}

function placeRight(node, depth, depthGap, rowGap, nextRow) {
  node.x = depth * depthGap;
  node.angle = 0;

  if (!node.children.length) {
    node.y = nextRow() * rowGap;
    return;
  }

  node.children.forEach((child) => placeRight(child, depth + 1, depthGap, rowGap, nextRow));
  node.y = (node.children[0].y + node.children[node.children.length - 1].y) / 2;
}

function countLeaves(node) {
  if (!node.children.length) return 1;
  return node.children.reduce((count, child) => count + countLeaves(child), 0);
}

function normalizeLayout(root, padding, minWidth, minHeight) {
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

  function measure(node) {
    const { width, height } = estimateNodeSize(node);
    bounds.minX = Math.min(bounds.minX, node.x - width / 2);
    bounds.maxX = Math.max(bounds.maxX, node.x + width / 2);
    bounds.minY = Math.min(bounds.minY, node.y - height / 2);
    bounds.maxY = Math.max(bounds.maxY, node.y + height / 2);
    node.children.forEach(measure);
  }

  measure(root);

  const offsetX = padding - bounds.minX;
  const offsetY = padding - bounds.minY;
  const layoutWidth = Math.max(minWidth, bounds.maxX - bounds.minX + padding * 2);
  const layoutHeight = Math.max(minHeight, bounds.maxY - bounds.minY + padding * 2);

  function translate(node) {
    node.x += offsetX;
    node.y += offsetY;
    node.children.forEach(translate);
  }

  translate(root);
  root.layout = { width: Math.ceil(layoutWidth), height: Math.ceil(layoutHeight) };
}

function normalizeMarkdownText(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}

function splitLongWord(word, maxChars) {
  if (word.length <= maxChars) return [word];
  const chunks = [];
  for (let index = 0; index < word.length; index += maxChars) {
    chunks.push(word.slice(index, index + maxChars));
  }
  return chunks;
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
