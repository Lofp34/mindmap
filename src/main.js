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
          <button id="save-template-button" type="button" hidden>Enregistrer le modèle</button>
        </div>
        <details class="saved-panel template-section" aria-label="Modèles de cartes">
          <summary class="saved-header">
            <strong>Modèles</strong>
            <span id="template-count">0</span>
          </summary>
          <div id="template-maps-list" class="saved-list template-list"></div>
        </details>
        <details class="saved-panel saved-section" aria-label="Cartes enregistrées">
          <summary class="saved-header">
            <strong>Cartes enregistrées</strong>
            <span id="saved-count">0</span>
          </summary>
          <div id="saved-maps-list" class="saved-list"></div>
        </details>
        <details class="source-details">
          <summary>Modifier le texte brut</summary>
          <textarea id="markdown-input" spellcheck="false"></textarea>
          <button id="render-button" type="button">Mettre à jour la carte</button>
        </details>
        <details class="saved-panel archive-section" aria-label="Archive des cartes">
          <summary class="saved-header">
            <strong>Archive</strong>
            <span id="archived-count">0</span>
          </summary>
          <div id="archived-maps-list" class="saved-list archived-list"></div>
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
        <div id="map-viewport" class="canvas-wrap">
          <svg id="mindmap" role="img" aria-labelledby="map-title" viewBox="0 0 1200 800"></svg>
          <button id="map-fullscreen-button" class="map-fullscreen-button" type="button" aria-label="Afficher la carte en plein écran" title="Plein écran">⛶</button>
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
    <div id="node-action-menu" class="node-action-menu" hidden>
      <button type="button" data-node-action="child">+ enfant</button>
      <button type="button" data-node-action="sibling">+ frère</button>
      <button type="button" data-node-action="rename">Renommer</button>
      <button type="button" data-node-action="delete" class="danger">Supprimer</button>
    </div>
    <div id="map-action-menu" class="node-action-menu map-action-menu" hidden>
      <button type="button" data-map-action="edit">Modifier</button>
      <button type="button" data-map-action="template">Transformer en modèle</button>
      <button type="button" data-map-action="archive">Archiver</button>
      <button type="button" data-map-action="delete" class="danger">Supprimer</button>
    </div>
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
const saveTemplateButton = document.querySelector('#save-template-button');
const activeMapName = document.querySelector('#active-map-name');
const templateCount = document.querySelector('#template-count');
const templateMapsList = document.querySelector('#template-maps-list');
const savedCount = document.querySelector('#saved-count');
const savedMapsList = document.querySelector('#saved-maps-list');
const archivedCount = document.querySelector('#archived-count');
const archivedMapsList = document.querySelector('#archived-maps-list');
const renderButton = document.querySelector('#render-button');
const mapViewport = document.querySelector('#map-viewport');
const mapFullscreenButton = document.querySelector('#map-fullscreen-button');
const nodeActionMenu = document.querySelector('#node-action-menu');
const mapActionMenu = document.querySelector('#map-action-menu');
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
let nodeLongPressTimeout = null;
let nodeLongPressStart = null;
let nodeActionMenuNodeId = null;
let mapLongPressTimeout = null;
let mapLongPressStart = null;
let mapActionMenuContext = null;
let suppressNextMapClick = false;
const activePointers = new Map();
let pinchStart = null;

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 4;
const FIT_PADDING = 56;
const SAVED_MAPS_KEY = 'mindmap.savedMaps.v1';
const INITIAL_DEPTH_LIMIT = 1;
const BUILT_IN_TEMPLATES = [
  {
    id: 'builtin-aida',
    name: 'AIDA',
    description: 'Attention, intérêt, désir, action',
    markdown: `# AIDA

## Attention
### Accroche principale
### Problème visible
### Promesse claire

## Intérêt
### Contexte client
### Bénéfices concrets
### Preuves ou exemples

## Désir
### Transformation attendue
### Différenciation
### Objections à lever

## Action
### Prochaine étape
### Message d'appel à l'action
### Suivi`,
  },
  {
    id: 'builtin-omar',
    name: 'OMAR',
    description: 'Objectif, moyens, actions, rendez-vous, résultats',
    markdown: `# OMAR - Développer mon business

## Objectif
### Développer mon business
### Clarifier mon ambition commerciale
### Prioriser les opportunités les plus rentables

## Moyens
### Compte LinkedIn
### Portefeuille client
### Partenaires
### Nouvelle offre

## Actions
### Appeler mes anciens clients pour proposer ma nouvelle offre
### Peaufiner ma nouvelle offre
### Publier régulièrement sur LinkedIn
### Solliciter mes partenaires

## Rendez-vous
### Dates de prospection
### Dates de relance
### Dates de livraison
### Dates de mesure des résultats

## Résultats
### Nombre de contrats signés
### Chiffre d'affaires généré
### Taux de transformation
### Prochaines décisions`,
  },
];

let savedMaps = [];
let remoteStorageAvailable = false;
let activeMapId = null;
let activeMapLabel = 'Exemple intégré';
let activeTemplateEdit = null;
let searchMatches = [];
let activeSearchIndex = -1;

renderButton.addEventListener('click', () => {
  loadMarkdown(markdownInput.value, activeMapLabel, { id: activeMapId, templateEdit: activeTemplateEdit });
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
saveTemplateButton.addEventListener('click', saveCurrentTemplate);
templateMapsList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-template-id]');
  if (!button || !templateMapsList.contains(button)) return;
  if (suppressNextMapClick) {
    suppressNextMapClick = false;
    return;
  }

  const template = findTemplate(button.dataset.templateId);
  if (!template) return;

  loadMarkdown(template.markdown, template.name);
});
savedMapsList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-map-id]');
  if (!button || !savedMapsList.contains(button)) return;
  if (suppressNextMapClick) {
    suppressNextMapClick = false;
    return;
  }

  const saved = savedMaps.find((map) => map.id === button.dataset.mapId);
  if (!saved) return;

  loadMarkdown(saved.markdown, saved.name, { id: saved.id });
});
archivedMapsList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-map-id]');
  if (!button || !archivedMapsList.contains(button)) return;
  if (suppressNextMapClick) {
    suppressNextMapClick = false;
    return;
  }

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
markdownInput.addEventListener('input', debounce(() => {
  sourceTree = parseMarkdownToTree(markdownInput.value);
  resetInteractionState();
  render(currentLayout);
}, 450));

function addChildToSelectedNode() {
  const parent = findNode(sourceTree, selectedNodeId);
  if (!parent) return;
  const title = requestNodeTitle();
  if (!title) return;

  const child = addChildNode(sourceTree, parent.id, title);
  selectedNodeId = child.id;
  expandedIds.add(parent.id);
  syncMarkdownFromTree();
  render(currentLayout);
}

function addSiblingToSelectedNode() {
  const selected = findNode(sourceTree, selectedNodeId);
  if (!selected || selected.depth === 0) return;
  const title = requestNodeTitle();
  if (!title) return;

  const sibling = addSiblingNode(sourceTree, selected.id, title);
  selectedNodeId = sibling.id;
  const parent = findParent(sourceTree, sibling.id);
  if (parent) expandedIds.add(parent.id);
  syncMarkdownFromTree();
  render(currentLayout);
}

function deleteSelectedNode() {
  const selected = findNode(sourceTree, selectedNodeId);
  if (!selected || selected.depth === 0) return;
  const result = removeNode(sourceTree, selected.id);
  if (!result) return;

  expandedIds.delete(selected.id);
  selectedNodeId = result.parent.id;
  syncMarkdownFromTree();
  render(currentLayout);
}

function requestNodeTitle() {
  const title = globalThis.prompt('Nom du nœud', '');
  if (title === null) return null;
  return cleanTitle(title);
}

function renameSelectedNode() {
  const selected = findNode(sourceTree, selectedNodeId);
  if (!selected) return;
  const title = globalThis.prompt('Nouveau nom du nœud', selected.title);
  if (title === null) return;
  const clean = cleanTitle(title);
  if (!clean || clean === selected.title) return;

  selected.title = clean;
  if (selected.depth === 0) {
    activeMapLabel = clean;
    activeMapName.textContent = clean;
  }
  syncMarkdownFromTree();
  render(currentLayout);
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape' && mapViewport.classList.contains('is-map-expanded')) {
    event.preventDefault();
    exitMapFullscreen();
    return;
  }

  if (event.key !== 'Enter' || !event.metaKey || event.isComposing) return;
  if (isEditingText(event.target)) return;

  event.preventDefault();
  if (event.shiftKey) {
    addSiblingToSelectedNode();
  } else {
    addChildToSelectedNode();
  }
}

async function toggleMapFullscreen() {
  if (isMapFullscreen()) {
    await exitMapFullscreen();
  } else {
    await enterMapFullscreen();
  }
}

async function enterMapFullscreen() {
  autoFit = false;
  if (shouldUseCssFullscreen()) {
    mapViewport.classList.add('is-map-expanded');
    document.body.classList.add('map-expanded');
    updateMapFullscreenState();
    window.setTimeout(() => centerOnNode(selectedNodeId), 80);
    return;
  }

  try {
    if (mapViewport.requestFullscreen) {
      await mapViewport.requestFullscreen();
    } else {
      mapViewport.classList.add('is-map-expanded');
      document.body.classList.add('map-expanded');
    }
  } catch {
    mapViewport.classList.add('is-map-expanded');
    document.body.classList.add('map-expanded');
  }
  updateMapFullscreenState();
  window.setTimeout(() => centerOnNode(selectedNodeId), 80);
}

async function exitMapFullscreen() {
  if (document.fullscreenElement === mapViewport) {
    await document.exitFullscreen();
  }
  mapViewport.classList.remove('is-map-expanded');
  document.body.classList.remove('map-expanded');
  updateMapFullscreenState();
  window.setTimeout(() => centerOnNode(selectedNodeId), 80);
}

function updateMapFullscreenState() {
  const expanded = isMapFullscreen();
  mapFullscreenButton.textContent = expanded ? 'Quitter' : '⛶';
  mapFullscreenButton.classList.toggle('is-exit', expanded);
  mapFullscreenButton.setAttribute(
    'aria-label',
    expanded ? 'Quitter le plein écran' : 'Afficher la carte en plein écran',
  );
  mapFullscreenButton.title = expanded ? 'Quitter' : 'Plein écran';
  updateViewportSize();
  applyCamera();
}

function isMapFullscreen() {
  return document.fullscreenElement === mapViewport || mapViewport.classList.contains('is-map-expanded');
}

function shouldUseCssFullscreen() {
  return globalThis.matchMedia?.('(max-width: 900px), (pointer: coarse)')?.matches ?? false;
}

function handleNodeActionMenuClick(event) {
  const button = event.target.closest('button[data-node-action]');
  if (!button) return;
  const selected = findNode(sourceTree, nodeActionMenuNodeId);
  if (!selected) return;

  selectedNodeId = selected.id;
  hideNodeActionMenu();

  if (button.dataset.nodeAction === 'child') {
    addChildToSelectedNode();
  }
  if (button.dataset.nodeAction === 'sibling') {
    addSiblingToSelectedNode();
  }
  if (button.dataset.nodeAction === 'rename') {
    renameSelectedNode();
  }
  if (button.dataset.nodeAction === 'delete') {
    deleteSelectedNode();
  }
}

function showNodeActionMenu(node, clientX, clientY) {
  hideMapActionMenu();
  selectedNodeId = node.id;
  renderSelectionState();
  nodeActionMenuNodeId = node.id;
  nodeActionMenu.querySelector('[data-node-action="sibling"]').disabled = node.depth === 0;
  nodeActionMenu.querySelector('[data-node-action="delete"]').disabled = node.depth === 0;
  nodeActionMenu.hidden = false;
  positionFloatingMenu(nodeActionMenu, clientX, clientY);
}

function hideNodeActionMenu() {
  clearNodeLongPress();
  nodeActionMenu.hidden = true;
  nodeActionMenuNodeId = null;
}

function scheduleNodeLongPress(event, node) {
  clearNodeLongPress();
  if (event.pointerType === 'mouse') return;
  const { clientX, clientY } = event;
  nodeLongPressStart = { x: clientX, y: clientY };
  nodeLongPressTimeout = window.setTimeout(() => {
    nodeLongPressTimeout = null;
    nodeLongPressStart = null;
    suppressNextNodeClick = true;
    showNodeActionMenu(node, clientX, clientY);
  }, 560);
}

function handleNodeLongPressMove(event) {
  if (!nodeLongPressStart) return;
  const distanceFromStart = Math.hypot(event.clientX - nodeLongPressStart.x, event.clientY - nodeLongPressStart.y);
  if (distanceFromStart > 10) clearNodeLongPress();
}

function clearNodeLongPress() {
  if (nodeLongPressTimeout) window.clearTimeout(nodeLongPressTimeout);
  nodeLongPressTimeout = null;
  nodeLongPressStart = null;
}

function visibleViewportBounds() {
  const viewport = window.visualViewport;
  return {
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
}

function positionFloatingMenu(menu, clientX, clientY) {
  const menuRect = menu.getBoundingClientRect();
  const viewport = visibleViewportBounds();
  const maxX = Math.max(viewport.left + 8, viewport.left + viewport.width - menuRect.width - 8);
  const maxY = Math.max(viewport.top + 8, viewport.top + viewport.height - menuRect.height - 8);
  const x = clamp(clientX, viewport.left + 8, maxX);
  const y = clamp(clientY, viewport.top + 8, maxY);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
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
mapFullscreenButton.addEventListener('click', toggleMapFullscreen);
nodeActionMenu.addEventListener('click', handleNodeActionMenuClick);
mapActionMenu.addEventListener('click', handleMapActionMenuClick);

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
  hideNodeActionMenu();
  hideMapActionMenu();
});
window.addEventListener('keydown', handleGlobalKeydown);
window.addEventListener('pointerdown', (event) => {
  if (!nodeActionMenu.hidden && !nodeActionMenu.contains(event.target)) hideNodeActionMenu();
  if (!mapActionMenu.hidden && !mapActionMenu.contains(event.target)) hideMapActionMenu();
});
document.addEventListener('fullscreenchange', updateMapFullscreenState);

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
  setTemplateEditMode(options.templateEdit ?? null);
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
    archivedAt: null,
    templateAt: existingIndex >= 0 ? (savedMaps[existingIndex].templateAt ?? null) : null,
    updatedAt: now,
  };

  moveSavedMapToTop(savedMap);

  activeMapId = savedMap.id;
  activeMapLabel = savedMap.name;
  activeMapName.textContent = activeMapLabel;
  await persistSavedMaps(savedMap);
  renderSavedMaps();
}

async function saveCurrentTemplate() {
  const now = new Date().toISOString();
  const title = sourceTree.title || activeMapLabel || 'Modèle sans titre';
  const isExistingCustomTemplate = activeTemplateEdit?.source === 'custom' && activeMapId;
  const existingIndex = isExistingCustomTemplate
    ? savedMaps.findIndex((map) => map.id === activeMapId)
    : -1;
  const savedTemplate = {
    id: existingIndex >= 0 ? savedMaps[existingIndex].id : createSavedMapId(),
    name: title,
    markdown: markdownInput.value,
    archivedAt: existingIndex >= 0 ? (savedMaps[existingIndex].archivedAt ?? null) : null,
    templateAt: existingIndex >= 0 ? (savedMaps[existingIndex].templateAt ?? now) : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    savedMaps[existingIndex] = savedTemplate;
  } else {
    savedMaps.unshift(savedTemplate);
  }

  activeMapId = savedTemplate.id;
  activeMapLabel = savedTemplate.name;
  activeMapName.textContent = activeMapLabel;
  setTemplateEditMode({ id: savedTemplate.id, source: 'custom' });
  await persistSavedMaps(savedTemplate);
  renderSavedMaps();
}

function setTemplateEditMode(templateEdit) {
  activeTemplateEdit = templateEdit;
  saveTemplateButton.hidden = !activeTemplateEdit;
}

function renderSavedMaps() {
  const activeMaps = savedMaps.filter((map) => !map.archivedAt);
  const archivedMaps = savedMaps.filter((map) => map.archivedAt);
  const archivedBuiltInTemplateIds = new Set(
    savedMaps
      .filter((map) => isBuiltInTemplateId(map.id) && map.archivedAt)
      .map((map) => map.id),
  );
  const templates = [
    ...BUILT_IN_TEMPLATES.filter((template) => !archivedBuiltInTemplateIds.has(template.id)),
    ...savedMaps.filter((map) => map.templateAt && !map.archivedAt),
  ];

  templateCount.textContent = `${templates.length}`;
  savedCount.textContent = `${activeMaps.length}`;
  archivedCount.textContent = `${archivedMaps.length}`;
  templateMapsList.innerHTML = '';
  savedMapsList.innerHTML = '';
  archivedMapsList.innerHTML = '';

  templates.forEach((template) => {
    templateMapsList.append(renderTemplateRow(template));
  });

  if (!activeMaps.length) {
    const empty = document.createElement('p');
    empty.className = 'saved-empty';
    empty.textContent = 'Aucune carte enregistrée.';
    savedMapsList.append(empty);
  } else {
    activeMaps.forEach((map) => {
      savedMapsList.append(renderMapRow(map, { action: 'saved' }));
    });
  }

  if (!archivedMaps.length) {
    const empty = document.createElement('p');
    empty.className = 'saved-empty';
    empty.textContent = 'Aucune carte archivée.';
    archivedMapsList.append(empty);
  } else {
    archivedMaps.forEach((map) => {
      archivedMapsList.append(renderMapRow(map, { action: 'delete' }));
    });
  }
}

function renderTemplateRow(template) {
  const row = document.createElement('div');
  row.className = 'saved-map-row';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `saved-map template-map ${template.id === activeMapId ? 'active' : ''}`;
  button.dataset.templateId = template.id;
  button.innerHTML = `
    <span>${escapeHtml(template.name)}</span>
    <small>${escapeHtml(template.description ?? 'Modèle personnalisé')}</small>
  `;
  bindMapContextMenu(button, {
    id: template.id,
    type: template.id.startsWith('builtin-') ? 'builtin-template' : 'custom-template',
  });
  row.append(button);

  return row;
}

function renderMapRow(map, options = {}) {
  const row = document.createElement('div');
  row.className = 'saved-map-row';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `saved-map ${map.id === activeMapId ? 'active' : ''}`;
  button.dataset.mapId = map.id;
  button.innerHTML = `
    <span>${escapeHtml(map.name)}</span>
    <small>${formatSavedDate(map.updatedAt)}</small>
  `;
  const contextType = options.action === 'delete'
    ? (isBuiltInTemplateId(map.id) ? 'archived-builtin-template' : 'archived-map')
    : 'saved-map';
  bindMapContextMenu(button, {
    id: map.id,
    type: contextType,
  });
  row.append(button);

  return row;
}

function findTemplate(templateId) {
  return BUILT_IN_TEMPLATES.find((template) => template.id === templateId)
    ?? savedMaps.find((map) => map.id === templateId && map.templateAt);
}

function bindMapContextMenu(element, context) {
  element.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    showMapActionMenu(context, event.clientX, event.clientY);
  });
  element.addEventListener('pointerdown', (event) => {
    scheduleMapLongPress(event, context);
  });
  element.addEventListener('pointermove', handleMapLongPressMove);
  element.addEventListener('pointerup', clearMapLongPress);
  element.addEventListener('pointercancel', clearMapLongPress);
}

function handleMapActionMenuClick(event) {
  const button = event.target.closest('button[data-map-action]');
  if (!button || !mapActionMenuContext) return;
  const { id, type } = mapActionMenuContext;
  hideMapActionMenu();

  if (button.dataset.mapAction === 'edit') {
    editMapContext(type, id);
  }
  if (button.dataset.mapAction === 'template') {
    markSavedMapAsTemplate(id);
  }
  if (button.dataset.mapAction === 'archive') {
    if (type === 'builtin-template') {
      archiveBuiltInTemplate(id);
    } else {
      archiveSavedMap(id);
    }
  }
  if (button.dataset.mapAction === 'delete') {
    removeMapContext(type, id);
  }
}

function editMapContext(type, id) {
  if (type === 'builtin-template') {
    const template = findTemplate(id);
    if (template) {
      loadMarkdown(template.markdown, template.name, {
        templateEdit: { id: template.id, source: 'builtin' },
      });
    }
    return;
  }

  const map = savedMaps.find((savedMap) => savedMap.id === id);
  if (map) {
    loadMarkdown(map.markdown, map.name, {
      id: map.id,
      templateEdit: type === 'custom-template' ? { id: map.id, source: 'custom' } : null,
    });
  }
}

function removeMapContext(type, id) {
  if (type === 'custom-template') {
    removeSavedMapTemplate(id);
  }
  if (type === 'archived-map') {
    deleteArchivedMap(id);
  }
}

function showMapActionMenu(context, clientX, clientY) {
  mapActionMenuContext = context;
  const map = savedMaps.find((savedMap) => savedMap.id === context.id);
  const isBuiltInTemplate = context.type === 'builtin-template';
  const isSavedMap = context.type === 'saved-map';
  const isCustomTemplate = context.type === 'custom-template';
  const isArchivedMap = context.type === 'archived-map';

  setMapActionVisibility('edit', true);
  setMapActionVisibility('template', isSavedMap && !map?.templateAt);
  setMapActionVisibility('archive', isSavedMap || isBuiltInTemplate);
  setMapActionVisibility('delete', isCustomTemplate || isArchivedMap);
  mapActionMenu.querySelector('[data-map-action="delete"]').textContent = isCustomTemplate ? 'Retirer' : 'Supprimer';

  mapActionMenu.hidden = false;
  positionFloatingMenu(mapActionMenu, clientX, clientY);
}

function setMapActionVisibility(action, visible) {
  mapActionMenu.querySelector(`[data-map-action="${action}"]`).hidden = !visible;
}

function hideMapActionMenu() {
  clearMapLongPress();
  mapActionMenu.hidden = true;
  mapActionMenuContext = null;
}

function scheduleMapLongPress(event, context) {
  clearMapLongPress();
  if (event.pointerType === 'mouse') return;
  const { clientX, clientY } = event;
  mapLongPressStart = { x: clientX, y: clientY };
  mapLongPressTimeout = window.setTimeout(() => {
    mapLongPressTimeout = null;
    mapLongPressStart = null;
    suppressNextMapClick = true;
    showMapActionMenu(context, clientX, clientY);
  }, 560);
}

function handleMapLongPressMove(event) {
  if (!mapLongPressStart) return;
  const distanceFromStart = Math.hypot(event.clientX - mapLongPressStart.x, event.clientY - mapLongPressStart.y);
  if (distanceFromStart > 10) clearMapLongPress();
}

function clearMapLongPress() {
  if (mapLongPressTimeout) window.clearTimeout(mapLongPressTimeout);
  mapLongPressTimeout = null;
  mapLongPressStart = null;
}

async function markSavedMapAsTemplate(mapId) {
  const index = savedMaps.findIndex((map) => map.id === mapId);
  if (index < 0) return;

  const templateMap = {
    ...savedMaps[index],
    templateAt: new Date().toISOString(),
  };
  savedMaps[index] = templateMap;
  await persistSavedMaps(templateMap);
  renderSavedMaps();
}

async function removeSavedMapTemplate(mapId) {
  const index = savedMaps.findIndex((map) => map.id === mapId);
  if (index < 0) return;

  const templateMap = {
    ...savedMaps[index],
    templateAt: null,
  };
  savedMaps[index] = templateMap;
  if (activeTemplateEdit?.id === mapId) setTemplateEditMode(null);
  await persistSavedMaps(templateMap);
  renderSavedMaps();
}

async function archiveSavedMap(mapId) {
  const index = savedMaps.findIndex((map) => map.id === mapId);
  if (index < 0) return;

  const archivedMap = {
    ...savedMaps[index],
    archivedAt: new Date().toISOString(),
    templateAt: savedMaps[index].templateAt ?? null,
  };
  savedMaps[index] = archivedMap;
  if (activeMapId === mapId) activeMapId = null;
  if (activeTemplateEdit?.id === mapId) setTemplateEditMode(null);
  await persistSavedMaps(archivedMap);
  renderSavedMaps();
}

async function archiveBuiltInTemplate(templateId) {
  const template = BUILT_IN_TEMPLATES.find((builtInTemplate) => builtInTemplate.id === templateId);
  if (!template) return;

  const now = new Date().toISOString();
  const archivedTemplate = {
    id: template.id,
    name: template.name,
    markdown: template.markdown,
    archivedAt: now,
    templateAt: null,
    updatedAt: now,
  };
  const index = savedMaps.findIndex((map) => map.id === template.id);
  if (index >= 0) {
    savedMaps[index] = archivedTemplate;
  } else {
    savedMaps.unshift(archivedTemplate);
  }
  if (activeTemplateEdit?.id === template.id) setTemplateEditMode(null);
  if (activeMapId === template.id) activeMapId = null;
  await persistSavedMaps(archivedTemplate);
  renderSavedMaps();
}

async function deleteArchivedMap(mapId) {
  const map = savedMaps.find((savedMap) => savedMap.id === mapId);
  if (!map?.archivedAt) return;

  savedMaps = savedMaps.filter((savedMap) => savedMap.id !== mapId);
  if (activeMapId === mapId) activeMapId = null;
  if (activeTemplateEdit?.id === mapId) setTemplateEditMode(null);
  await removePersistedMap(mapId);
  renderSavedMaps();
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
      scheduleNodeLongPress(event, node);
    });
    item.addEventListener('pointermove', handleNodeLongPressMove);
    item.addEventListener('pointerup', clearNodeLongPress);
    item.addEventListener('pointercancel', clearNodeLongPress);
    item.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showNodeActionMenu(node, event.clientX, event.clientY);
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
      return Array.isArray(data.maps) ? data.maps.map(normalizeSavedMap).filter(Boolean) : [];
    }
  } catch {
    remoteStorageAvailable = false;
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_MAPS_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.map(normalizeSavedMap).filter(Boolean)
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
          moveSavedMapToTop(data.map);
        }
        return;
      }
      remoteStorageAvailable = false;
    } catch {
      remoteStorageAvailable = false;
    }
  }

  localStorage.setItem(SAVED_MAPS_KEY, JSON.stringify(savedMaps));
}

function moveSavedMapToTop(savedMap) {
  savedMaps = [
    savedMap,
    ...savedMaps.filter((map) => map.id !== savedMap.id),
  ];
}

async function removePersistedMap(mapId) {
  if (remoteStorageAvailable) {
    try {
      const response = await fetch(`/api/maps?id=${encodeURIComponent(mapId)}`, {
        method: 'DELETE',
      });

      if (response.ok) return;
      remoteStorageAvailable = false;
    } catch {
      remoteStorageAvailable = false;
    }
  }

  localStorage.setItem(SAVED_MAPS_KEY, JSON.stringify(savedMaps));
}

function normalizeSavedMap(map) {
  if (!map?.id || !map?.name || typeof map.markdown !== 'string') return null;
  return {
    id: map.id,
    name: map.name,
    markdown: map.markdown,
    updatedAt: map.updatedAt,
    archivedAt: map.archivedAt ?? null,
    templateAt: map.templateAt ?? null,
  };
}

function createSavedMapId() {
  return globalThis.crypto?.randomUUID?.() ?? `map-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isBuiltInTemplateId(id) {
  return BUILT_IN_TEMPLATES.some((template) => template.id === id);
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
