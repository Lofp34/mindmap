import './styles.css';
import {
  SAMPLE_MARKDOWN,
  addChildNode,
  addSiblingNode,
  cloneTree,
  estimateNodeSize,
  findNode,
  findParent,
  flattenTree,
  layoutClockwise,
  layoutRightBiased,
  parseMarkdownToTree,
  removeNode,
  treeToMarkdown,
  visibleTree,
} from './mindmap.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="shell">
    <section class="workspace">
      <aside class="panel" aria-label="Cartes Markdown">
        <div class="panel-heading">
          <label>Cartes</label>
          <span id="active-map-name">Exemple intégré</span>
        </div>
        <div class="file-actions">
          <input id="file-input" class="visually-hidden" type="file" accept=".md,.markdown,text/markdown,text/plain" />
          <label for="file-input" class="file-button">Importer</label>
          <button id="create-map-button" type="button">Créer</button>
          <button id="save-map-button" type="button">Enregistrer la carte</button>
        </div>
        <div class="saved-panel" aria-label="Cartes enregistrées">
          <div class="saved-header">
            <strong>Cartes enregistrées</strong>
            <span id="saved-count">0</span>
          </div>
          <div id="saved-maps-list" class="saved-list"></div>
        </div>
        <details class="source-details">
          <summary>Voir / modifier la source Markdown</summary>
          <textarea id="markdown-input" spellcheck="false"></textarea>
          <button id="render-button" type="button">Mettre à jour la carte</button>
        </details>
      </aside>

      <section class="canvas-card" aria-label="Carte mentale générée">
        <div class="toolbar">
          <div>
            <strong id="map-title">Mind Map</strong>
            <span id="node-count">0 nœud</span>
          </div>
          <div class="toolbar-actions" aria-label="Navigation de la carte">
            <div class="search-control" role="search">
              <input id="node-search" type="search" placeholder="Rechercher un nœud" aria-label="Rechercher un nœud" />
              <button id="search-prev-button" type="button" aria-label="Résultat précédent" title="Résultat précédent">&lt;</button>
              <span id="search-count" class="search-count">0/0</span>
              <button id="search-next-button" type="button" aria-label="Résultat suivant" title="Résultat suivant">&gt;</button>
            </div>
            <button id="zoom-out-button" type="button" aria-label="Dézoomer" title="Dézoomer">−</button>
            <span id="zoom-level" class="zoom-level">100%</span>
            <button id="zoom-in-button" type="button" aria-label="Zoomer" title="Zoomer">+</button>
            <button id="fit-button" type="button" aria-label="Ajuster la carte à l’écran" title="Ajuster la carte à l’écran">Ajuster</button>
            <button id="layout-toggle-button" type="button" class="pill">Horloge</button>
            <button id="center-button" type="button" aria-label="Recentrer sur le nœud central" title="Recentrer sur le nœud central">Recentrer</button>
          </div>
        </div>
        <div class="edit-bar" aria-label="Édition du nœud sélectionné">
          <div>
            <span>Nœud sélectionné</span>
            <button id="selected-node-label" class="selected-node-label" type="button" aria-label="Renommer le nœud sélectionné" title="Renommer le nœud sélectionné">Sujet central</button>
            <input id="selected-node-title-input" class="selected-node-title-input" type="text" aria-label="Nouveau nom du nœud sélectionné" hidden />
          </div>
          <div class="edit-actions">
            <input id="new-node-title" type="text" placeholder="Titre du nouveau nœud" />
            <button id="add-child-button" type="button">+ enfant</button>
            <button id="add-sibling-button" type="button">+ frère</button>
            <button id="delete-node-button" type="button" class="danger">Supprimer</button>
          </div>
        </div>
        <div id="map-viewport" class="canvas-wrap">
          <svg id="mindmap" role="img" aria-labelledby="map-title" viewBox="0 0 1200 800"></svg>
        </div>
      </section>
    </section>
    <dialog id="create-map-dialog" class="modal">
      <form method="dialog" class="modal-panel">
        <label for="create-map-title">Titre de la carte</label>
        <input id="create-map-title" type="text" placeholder="Nœud central" />
        <div class="modal-actions">
          <button id="cancel-create-map" type="button" class="ghost">Annuler</button>
          <button id="confirm-create-map" type="submit" class="primary">Créer</button>
        </div>
      </form>
    </dialog>
  </main>
`;

const markdownInput = document.querySelector('#markdown-input');
const fileInput = document.querySelector('#file-input');
const createMapButton = document.querySelector('#create-map-button');
const createMapDialog = document.querySelector('#create-map-dialog');
const createMapTitle = document.querySelector('#create-map-title');
const cancelCreateMap = document.querySelector('#cancel-create-map');
const confirmCreateMap = document.querySelector('#confirm-create-map');
const saveMapButton = document.querySelector('#save-map-button');
const activeMapName = document.querySelector('#active-map-name');
const savedCount = document.querySelector('#saved-count');
const savedMapsList = document.querySelector('#saved-maps-list');
const renderButton = document.querySelector('#render-button');
const mapViewport = document.querySelector('#map-viewport');
const svg = document.querySelector('#mindmap');
const nodeCount = document.querySelector('#node-count');
const mapTitle = document.querySelector('#map-title');
const layoutToggleButton = document.querySelector('#layout-toggle-button');
const nodeSearch = document.querySelector('#node-search');
const searchPrevButton = document.querySelector('#search-prev-button');
const searchNextButton = document.querySelector('#search-next-button');
const searchCount = document.querySelector('#search-count');
const zoomOutButton = document.querySelector('#zoom-out-button');
const zoomInButton = document.querySelector('#zoom-in-button');
const fitButton = document.querySelector('#fit-button');
const centerButton = document.querySelector('#center-button');
const zoomLevel = document.querySelector('#zoom-level');
const selectedNodeLabel = document.querySelector('#selected-node-label');
const selectedNodeTitleInput = document.querySelector('#selected-node-title-input');
const newNodeTitle = document.querySelector('#new-node-title');
const addChildButton = document.querySelector('#add-child-button');
const addSiblingButton = document.querySelector('#add-sibling-button');
const deleteNodeButton = document.querySelector('#delete-node-button');

markdownInput.value = SAMPLE_MARKDOWN;
let sourceTree = parseMarkdownToTree(markdownInput.value);
let currentLayout = 'radial';
let expandedIds = new Set();
let selectedNodeId = sourceTree.id;
let sceneGroup = null;
let lastLayoutSize = { width: 1200, height: 800 };
let visibleRootPoint = { x: 600, y: 400 };
let visibleNodePoints = new Map();
let pendingFocusNodeId = null;
let viewportSize = { width: 1200, height: 800 };
let camera = { scale: 1, x: 0, y: 0 };
let autoFit = true;
let isPanning = false;
let panStart = null;
let suppressNextNodeClick = false;
const activePointers = new Map();
let pinchStart = null;

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 4;
const FIT_PADDING = 56;
const SAVED_MAPS_KEY = 'mindmap.savedMaps.v1';
const INITIAL_DEPTH_LIMIT = 1;

let savedMaps = [];
let remoteStorageAvailable = false;
let activeMapId = null;
let activeMapLabel = 'Exemple intégré';
let searchMatches = [];
let activeSearchIndex = -1;

renderButton.addEventListener('click', () => {
  loadMarkdown(markdownInput.value, activeMapLabel, { id: activeMapId });
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const markdown = await file.text();
  loadMarkdown(markdown, cleanFileName(file.name));
  fileInput.value = '';
});

createMapButton.addEventListener('click', () => {
  createMapTitle.value = '';
  createMapDialog.showModal();
  createMapTitle.focus();
});
cancelCreateMap.addEventListener('click', () => {
  createMapDialog.close();
});
confirmCreateMap.addEventListener('click', (event) => {
  event.preventDefault();
  const title = cleanTitle(createMapTitle.value) || 'Nouvelle carte';
  loadMarkdown(`# ${title}`, title);
  createMapDialog.close();
});
saveMapButton.addEventListener('click', saveCurrentMap);
savedMapsList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-map-id]');
  if (!button) return;

  const saved = savedMaps.find((map) => map.id === button.dataset.mapId);
  if (!saved) return;

  loadMarkdown(saved.markdown, saved.name, { id: saved.id });
});

layoutToggleButton.addEventListener('click', () => {
  render(currentLayout === 'radial' ? 'right' : 'radial');
});
nodeSearch.addEventListener('input', () => {
  updateSearchMatches();
  focusSearchMatch(0);
});
searchPrevButton.addEventListener('click', () => moveSearch(-1));
searchNextButton.addEventListener('click', () => moveSearch(1));
nodeSearch.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  moveSearch(event.shiftKey ? -1 : 1);
});
selectedNodeLabel.addEventListener('click', startRenamingSelectedNode);
selectedNodeTitleInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitSelectedNodeRename();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelSelectedNodeRename();
  }
});
selectedNodeTitleInput.addEventListener('blur', commitSelectedNodeRename);
markdownInput.addEventListener('input', debounce(() => {
  sourceTree = parseMarkdownToTree(markdownInput.value);
  resetInteractionState();
  render(currentLayout);
}, 450));
addChildButton.addEventListener('click', () => {
  addChildToSelectedNode();
});
addSiblingButton.addEventListener('click', () => {
  addSiblingToSelectedNode();
});
deleteNodeButton.addEventListener('click', () => {
  const selected = findNode(sourceTree, selectedNodeId);
  if (!selected || selected.depth === 0) return;
  const result = removeNode(sourceTree, selected.id);
  if (!result) return;

  expandedIds.delete(selected.id);
  selectedNodeId = result.parent.id;
  syncMarkdownFromTree();
  render(currentLayout);
});

function addChildToSelectedNode() {
  const parent = findNode(sourceTree, selectedNodeId);
  if (!parent) return;
  const title = cleanTitle(newNodeTitle.value) || 'Nouveau nœud';

  const child = addChildNode(sourceTree, parent.id, title);
  selectedNodeId = child.id;
  expandedIds.add(parent.id);
  newNodeTitle.value = '';
  syncMarkdownFromTree();
  render(currentLayout);
}

function addSiblingToSelectedNode() {
  const selected = findNode(sourceTree, selectedNodeId);
  if (!selected || selected.depth === 0) return;
  const title = cleanTitle(newNodeTitle.value) || 'Nouveau nœud';

  const sibling = addSiblingNode(sourceTree, selected.id, title);
  selectedNodeId = sibling.id;
  const parent = findParent(sourceTree, sibling.id);
  if (parent) expandedIds.add(parent.id);
  newNodeTitle.value = '';
  syncMarkdownFromTree();
  render(currentLayout);
}

function startRenamingSelectedNode() {
  const selected = findNode(sourceTree, selectedNodeId);
  if (!selected) return;

  selectedNodeTitleInput.value = selected.title;
  selectedNodeLabel.hidden = true;
  selectedNodeTitleInput.hidden = false;
  selectedNodeTitleInput.focus();
  selectedNodeTitleInput.select();
}

function commitSelectedNodeRename() {
  if (selectedNodeTitleInput.hidden) return;

  const selected = findNode(sourceTree, selectedNodeId);
  const title = cleanTitle(selectedNodeTitleInput.value);
  selectedNodeTitleInput.hidden = true;
  selectedNodeLabel.hidden = false;

  if (!selected || !title || title === selected.title) {
    renderSelectionState();
    return;
  }

  selected.title = title;
  if (selected.depth === 0) {
    activeMapLabel = title;
    activeMapName.textContent = title;
  }
  syncMarkdownFromTree();
  render(currentLayout);
}

function cancelSelectedNodeRename() {
  selectedNodeTitleInput.hidden = true;
  selectedNodeLabel.hidden = false;
  renderSelectionState();
  selectedNodeLabel.focus();
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Enter' || !event.metaKey || event.isComposing) return;
  if (isEditingText(event.target) && event.target !== newNodeTitle) return;

  event.preventDefault();
  if (event.shiftKey) {
    addSiblingToSelectedNode();
  } else {
    addChildToSelectedNode();
  }
}

zoomOutButton.addEventListener('click', () => {
  autoFit = false;
  zoomAtViewportPoint(viewportSize.width / 2, viewportSize.height / 2, 1 / 1.22);
});
zoomInButton.addEventListener('click', () => {
  autoFit = false;
  zoomAtViewportPoint(viewportSize.width / 2, viewportSize.height / 2, 1.22);
});
fitButton.addEventListener('click', () => {
  autoFit = true;
  fitToViewport();
});
centerButton.addEventListener('click', () => {
  autoFit = false;
  centerOnRoot();
});

mapViewport.addEventListener('wheel', handleWheel, { passive: false });
mapViewport.addEventListener('pointerdown', handlePointerDown);
mapViewport.addEventListener('pointermove', handlePointerMove);
mapViewport.addEventListener('pointerup', handlePointerUp);
mapViewport.addEventListener('pointercancel', handlePointerUp);
mapViewport.addEventListener('pointerleave', handlePointerUp);
mapViewport.addEventListener('dblclick', (event) => {
  autoFit = false;
  zoomAtEvent(event, event.shiftKey ? 1 / 1.8 : 1.8);
});
mapViewport.addEventListener('click', () => {
  suppressNextNodeClick = false;
});
window.addEventListener('keydown', handleGlobalKeydown);

new ResizeObserver(() => {
  updateViewportSize();
  if (autoFit) {
    fitToViewport();
  } else {
    applyCamera();
  }
}).observe(mapViewport);

initializeApp();

async function initializeApp() {
  savedMaps = await loadSavedMaps();
  renderSavedMaps();
  render('radial');
}

function loadMarkdown(markdown, name, options = {}) {
  markdownInput.value = markdown;
  sourceTree = parseMarkdownToTree(markdownInput.value);
  activeMapId = options.id ?? null;
  activeMapLabel = name || sourceTree.title;
  activeMapName.textContent = activeMapLabel;
  resetInteractionState();
  resetSearch();
  autoFit = true;
  render(currentLayout);
  renderSavedMaps();
}

async function saveCurrentMap() {
  const now = new Date().toISOString();
  const title = sourceTree.title || activeMapLabel || 'Carte sans titre';
  const existingIndex = activeMapId ? savedMaps.findIndex((map) => map.id === activeMapId) : -1;
  const savedMap = {
    id: activeMapId ?? createSavedMapId(),
    name: title,
    markdown: markdownInput.value,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    savedMaps[existingIndex] = savedMap;
  } else {
    savedMaps.unshift(savedMap);
  }

  activeMapId = savedMap.id;
  activeMapLabel = savedMap.name;
  activeMapName.textContent = activeMapLabel;
  await persistSavedMaps(savedMap);
  renderSavedMaps();
}

function renderSavedMaps() {
  savedCount.textContent = `${savedMaps.length}`;
  savedMapsList.innerHTML = '';

  if (!savedMaps.length) {
    const empty = document.createElement('p');
    empty.className = 'saved-empty';
    empty.textContent = 'Aucune carte enregistrée.';
    savedMapsList.append(empty);
    return;
  }

  savedMaps.forEach((map) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `saved-map ${map.id === activeMapId ? 'active' : ''}`;
    button.dataset.mapId = map.id;
    button.innerHTML = `
      <span>${escapeHtml(map.name)}</span>
      <small>${formatSavedDate(map.updatedAt)}</small>
    `;
    savedMapsList.append(button);
  });
}

function render(layout) {
  currentLayout = layout;
  const depthLimit = selectedDepthLimit();
  const tree = visibleTree(cloneTree(sourceTree), { depthLimit, expandedIds });
  const laidOutTree = layout === 'radial'
    ? layoutClockwise(tree, { width: 1200, height: 800 })
    : layoutRightBiased(tree, { width: 1200, height: 800 });
  const { nodes, links } = flattenTree(laidOutTree);
  const totalNodes = flattenTree(sourceTree).nodes.length;
  const layoutSize = laidOutTree.layout ?? { width: 1200, height: 800 };
  lastLayoutSize = layoutSize;
  visibleRootPoint = { x: laidOutTree.x, y: laidOutTree.y };
  visibleNodePoints = new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));

  mapTitle.textContent = laidOutTree.title;
  nodeCount.textContent = `${nodes.length}/${totalNodes} nœud${totalNodes > 1 ? 's' : ''} visibles`;
  layoutToggleButton.textContent = layout === 'radial' ? 'Horloge' : 'Vue à droite';
  layoutToggleButton.classList.toggle('muted', layout !== 'radial');

  svg.innerHTML = '';
  sceneGroup = svgElement('g', { class: 'map-scene' });
  renderDefinitions();
  renderLinks(links, sceneGroup);
  renderNodes(nodes, sceneGroup);
  svg.append(sceneGroup);
  renderSelectionState();
  updateViewportSize();
  if (pendingFocusNodeId) {
    centerOnNode(pendingFocusNodeId);
    pendingFocusNodeId = null;
  } else if (autoFit) {
    fitToViewport();
  } else {
    applyCamera();
  }
}

function renderDefinitions() {
  const defs = svgElement('defs', {});
  const gradient = svgElement('linearGradient', { id: 'rootGradient', x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
  gradient.append(svgElement('stop', { offset: '0%', 'stop-color': '#76ffd2' }));
  gradient.append(svgElement('stop', { offset: '100%', 'stop-color': '#5f8cff' }));
  defs.append(gradient);
  svg.append(defs);
}

function renderLinks(links, parent) {
  const group = svgElement('g', { class: 'links' });
  links.forEach(({ source, target }) => {
    const midX = (source.x + target.x) / 2;
    const path = `M ${source.x} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x} ${target.y}`;
    group.append(svgElement('path', { d: path, class: 'link' }));
  });
  parent.append(group);
}

function renderNodes(nodes, parent) {
  const group = svgElement('g', { class: 'nodes' });

  nodes.forEach((node) => {
    const isRoot = node.depth === 0;
    const { width, height, lines } = estimateNodeSize(node);
    const item = svgElement('g', {
      class: `node depth-${Math.min(node.depth, 4)} ${isRoot ? 'root' : ''} ${node.id === selectedNodeId ? 'selected' : ''} ${searchMatches[activeSearchIndex]?.id === node.id ? 'search-hit' : ''}`,
      transform: `translate(${node.x - width / 2} ${node.y - height / 2})`,
      role: 'button',
      tabindex: '0',
      'data-node-id': node.id,
    });
    item.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      if (suppressNextNodeClick) {
        suppressNextNodeClick = false;
        return;
      }
      selectAndExpand(node);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectAndExpand(node);
    });

    item.append(svgElement('rect', {
      width,
      height,
      rx: isRoot ? 24 : 18,
      class: 'node-box',
    }));

    const text = svgElement('text', {
      x: width / 2,
      y: height / 2 - ((lines.length - 1) * 9),
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      class: 'node-label',
    });
    lines.forEach((line, index) => {
      const tspan = svgElement('tspan', {
        x: width / 2,
        dy: index === 0 ? 0 : 19,
      });
      tspan.textContent = line;
      text.append(tspan);
    });
    item.append(text);

    if (node.hasChildren) {
      const marker = svgElement('g', { class: `node-marker ${node.children.length ? 'open' : ''}` });
      marker.append(svgElement('circle', { cx: width - 14, cy: 14, r: 10 }));
      const markerText = svgElement('text', {
        x: width - 14,
        y: 18,
        'text-anchor': 'middle',
      });
      markerText.textContent = node.children.length ? '−' : '+';
      marker.append(markerText);
      item.append(marker);
    }

    group.append(item);
  });

  parent.append(group);
}

function svgElement(tag, attrs) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function selectedDepthLimit() {
  return INITIAL_DEPTH_LIMIT;
}

function updateSearchMatches() {
  const term = nodeSearch.value.trim().toLowerCase();
  searchMatches = term ? collectMatchingNodes(sourceTree, term) : [];
  activeSearchIndex = searchMatches.length ? 0 : -1;
  renderSearchState();
}

function collectMatchingNodes(node, term) {
  const matches = node.title.toLowerCase().includes(term) ? [node] : [];
  node.children.forEach((child) => matches.push(...collectMatchingNodes(child, term)));
  return matches;
}

function moveSearch(direction) {
  if (!searchMatches.length) return;
  const nextIndex = (activeSearchIndex + direction + searchMatches.length) % searchMatches.length;
  focusSearchMatch(nextIndex);
}

function focusSearchMatch(index) {
  if (!searchMatches.length) {
    renderSearchState();
    return;
  }

  const match = searchMatches[index];
  activeSearchIndex = index;
  selectedNodeId = match.id;
  expandedIds = new Set(pathIdsToNode(sourceTree, match.id));
  autoFit = false;
  pendingFocusNodeId = match.id;
  render(currentLayout);
  renderSearchState();
}

function renderSearchState() {
  searchCount.textContent = searchMatches.length ? `${activeSearchIndex + 1}/${searchMatches.length}` : '0/0';
  searchPrevButton.disabled = searchMatches.length < 2;
  searchNextButton.disabled = searchMatches.length < 2;
}

function resetSearch() {
  nodeSearch.value = '';
  searchMatches = [];
  activeSearchIndex = -1;
  renderSearchState();
}

function selectAndExpand(node) {
  selectedNodeId = node.id;
  const sourceNode = findNode(sourceTree, node.id);
  if (sourceNode) {
    expandedIds = new Set(pathIdsToNode(sourceTree, node.id));
  }
  autoFit = false;
  pendingFocusNodeId = node.id;
  render(currentLayout);
}

function updateViewportSize() {
  const rect = mapViewport.getBoundingClientRect();
  viewportSize = {
    width: Math.max(320, Math.floor(rect.width)),
    height: Math.max(320, Math.floor(rect.height)),
  };
  svg.setAttribute('viewBox', `0 0 ${viewportSize.width} ${viewportSize.height}`);
}

function fitToViewport() {
  updateViewportSize();
  const usableWidth = Math.max(1, viewportSize.width - FIT_PADDING * 2);
  const usableHeight = Math.max(1, viewportSize.height - FIT_PADDING * 2);
  const scale = clamp(
    Math.min(usableWidth / lastLayoutSize.width, usableHeight / lastLayoutSize.height),
    MIN_ZOOM,
    MAX_ZOOM,
  );

  camera = {
    scale,
    x: (viewportSize.width - lastLayoutSize.width * scale) / 2,
    y: (viewportSize.height - lastLayoutSize.height * scale) / 2,
  };
  applyCamera();
}

function applyCamera() {
  if (!sceneGroup) return;
  camera.scale = clamp(camera.scale, MIN_ZOOM, MAX_ZOOM);
  sceneGroup.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
  zoomLevel.textContent = `${Math.round(camera.scale * 100)}%`;
}

function centerOnRoot() {
  centerOnPoint(visibleRootPoint);
}

function centerOnNode(nodeId) {
  centerOnPoint(visibleNodePoints.get(nodeId) ?? visibleRootPoint);
}

function centerOnPoint(point) {
  updateViewportSize();
  camera = {
    ...camera,
    x: viewportSize.width / 2 - point.x * camera.scale,
    y: viewportSize.height / 2 - point.y * camera.scale,
  };
  applyCamera();
}

function handleWheel(event) {
  if (event.target.closest('input, textarea, select, button')) return;
  event.preventDefault();
  autoFit = false;

  const zoomIntensity = event.ctrlKey || event.metaKey ? 0.006 : 0.0028;
  const factor = Math.exp(-event.deltaY * zoomIntensity);
  zoomAtEvent(event, factor);
}

function handlePointerDown(event) {
  if (event.target.closest('input, textarea, select, button')) return;
  if (event.target.closest('.node')) return;
  mapViewport.setPointerCapture?.(event.pointerId);
  activePointers.set(event.pointerId, pointerPoint(event));
  autoFit = false;
  suppressNextNodeClick = false;

  if (activePointers.size === 1) {
    isPanning = true;
    panStart = { point: pointerPoint(event), camera: { ...camera } };
    mapViewport.classList.add('is-panning');
  }

  if (activePointers.size === 2) {
    const [first, second] = [...activePointers.values()];
    pinchStart = {
      distance: distance(first, second),
      center: midpoint(first, second),
      camera: { ...camera },
    };
  }
}

function handlePointerMove(event) {
  if (!activePointers.has(event.pointerId)) return;
  activePointers.set(event.pointerId, pointerPoint(event));

  if (activePointers.size === 2 && pinchStart) {
    event.preventDefault();
    const [first, second] = [...activePointers.values()];
    const center = midpoint(first, second);
    const factor = distance(first, second) / Math.max(1, pinchStart.distance);
    const world = viewportToWorld(pinchStart.center.x, pinchStart.center.y, pinchStart.camera);
    const nextScale = clamp(pinchStart.camera.scale * factor, MIN_ZOOM, MAX_ZOOM);
    camera = {
      scale: nextScale,
      x: center.x - world.x * nextScale,
      y: center.y - world.y * nextScale,
    };
    applyCamera();
    return;
  }

  if (isPanning && panStart) {
    event.preventDefault();
    const point = pointerPoint(event);
    if (Math.hypot(point.x - panStart.point.x, point.y - panStart.point.y) > 6) {
      suppressNextNodeClick = true;
    }
    camera = {
      ...camera,
      x: panStart.camera.x + point.x - panStart.point.x,
      y: panStart.camera.y + point.y - panStart.point.y,
    };
    applyCamera();
  }
}

function handlePointerUp(event) {
  activePointers.delete(event.pointerId);
  if (activePointers.size < 2) pinchStart = null;
  if (activePointers.size === 0) {
    isPanning = false;
    panStart = null;
    mapViewport.classList.remove('is-panning');
    window.setTimeout(() => {
      suppressNextNodeClick = false;
    }, 180);
  }
}

function zoomAtEvent(event, factor) {
  const rect = mapViewport.getBoundingClientRect();
  zoomAtViewportPoint(event.clientX - rect.left, event.clientY - rect.top, factor);
}

function zoomAtViewportPoint(x, y, factor) {
  const world = viewportToWorld(x, y, camera);
  const nextScale = clamp(camera.scale * factor, MIN_ZOOM, MAX_ZOOM);
  camera = {
    scale: nextScale,
    x: x - world.x * nextScale,
    y: y - world.y * nextScale,
  };
  applyCamera();
}

function viewportToWorld(x, y, sourceCamera = camera) {
  return {
    x: (x - sourceCamera.x) / sourceCamera.scale,
    y: (y - sourceCamera.y) / sourceCamera.scale,
  };
}

function pointerPoint(event) {
  const rect = mapViewport.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function midpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderSelectionState() {
  const selected = findNode(sourceTree, selectedNodeId) ?? sourceTree;
  selectedNodeId = selected.id;
  selectedNodeLabel.textContent = selected.title;
  addSiblingButton.disabled = selected.depth === 0;
  deleteNodeButton.disabled = selected.depth === 0;
}

function resetInteractionState() {
  expandedIds = new Set();
  selectedNodeId = sourceTree.id;
}

function syncMarkdownFromTree() {
  markdownInput.value = treeToMarkdown(sourceTree);
}

function cleanTitle(title) {
  return title?.trim();
}

function isEditingText(target) {
  return target?.closest?.('input, textarea, select, [contenteditable="true"]');
}

function cleanFileName(fileName) {
  return fileName
    .replace(/\.(md|markdown|txt)$/i, '')
    .trim() || 'Carte importée';
}

async function loadSavedMaps() {
  try {
    const response = await fetch('/api/maps');
    if (response.ok) {
      const data = await response.json();
      remoteStorageAvailable = true;
      return Array.isArray(data.maps) ? data.maps : [];
    }
  } catch {
    remoteStorageAvailable = false;
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_MAPS_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((map) => map?.id && map?.name && typeof map.markdown === 'string')
      : [];
  } catch {
    return [];
  }
}

async function persistSavedMaps(savedMap) {
  if (remoteStorageAvailable) {
    try {
      const response = await fetch('/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedMap),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.map) {
          const index = savedMaps.findIndex((map) => map.id === data.map.id);
          if (index >= 0) savedMaps[index] = data.map;
        }
        return;
      }
    } catch {
      remoteStorageAvailable = false;
    }
  }

  localStorage.setItem(SAVED_MAPS_KEY, JSON.stringify(savedMaps));
}

function createSavedMapId() {
  return globalThis.crypto?.randomUUID?.() ?? `map-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatSavedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function pathIdsToNode(root, id, path = []) {
  const nextPath = [...path, root.id];
  if (root.id === id) return nextPath;

  for (const child of root.children) {
    const childPath = pathIdsToNode(child, id, nextPath);
    if (childPath.length) return childPath;
  }

  return [];
}

function debounce(callback, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay);
  };
}
