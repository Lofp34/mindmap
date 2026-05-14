import './styles.css';
import {
  SAMPLE_MARKDOWN,
  cloneTree,
  flattenTree,
  layoutClockwise,
  layoutRightBiased,
  parseMarkdownToTree,
} from './mindmap.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="shell">
    <section class="hero" aria-labelledby="app-title">
      <div>
        <p class="eyebrow">Mind map Markdown • Mac • iPhone</p>
        <h1 id="app-title">Réorganisez vos cartes autour du nœud central.</h1>
        <p class="intro">Collez un fichier Markdown généré par vos IA, puis utilisez le bouton de réorganisation intelligente pour répartir les branches comme une horloge autour du sujet principal.</p>
      </div>
      <div class="hero-card">
        <span class="status-dot"></span>
        <strong>Mode horloge</strong>
        <small>Équilibre automatiquement les grands sujets sur 360°.</small>
      </div>
    </section>

    <section class="workspace">
      <aside class="panel" aria-label="Import Markdown">
        <label for="markdown-input">Markdown source</label>
        <textarea id="markdown-input" spellcheck="false"></textarea>
        <div class="actions">
          <button id="render-button" type="button">Créer la carte</button>
          <button id="radial-button" type="button" class="primary">Réorganiser en horloge</button>
          <button id="right-button" type="button" class="ghost">Vue à droite</button>
        </div>
        <p class="hint">Les titres <code>#</code>, <code>##</code>, <code>###</code> et les listes deviennent automatiquement des nœuds.</p>
      </aside>

      <section class="canvas-card" aria-label="Carte mentale générée">
        <div class="toolbar">
          <div>
            <strong id="map-title">Mind Map</strong>
            <span id="node-count">0 nœud</span>
          </div>
          <span id="layout-label" class="pill">Horloge</span>
        </div>
        <div class="canvas-wrap">
          <svg id="mindmap" role="img" aria-labelledby="map-title" viewBox="0 0 1200 800"></svg>
        </div>
      </section>
    </section>
  </main>
`;

const markdownInput = document.querySelector('#markdown-input');
const renderButton = document.querySelector('#render-button');
const radialButton = document.querySelector('#radial-button');
const rightButton = document.querySelector('#right-button');
const svg = document.querySelector('#mindmap');
const nodeCount = document.querySelector('#node-count');
const mapTitle = document.querySelector('#map-title');
const layoutLabel = document.querySelector('#layout-label');

markdownInput.value = SAMPLE_MARKDOWN;
let sourceTree = parseMarkdownToTree(markdownInput.value);
let currentLayout = 'radial';

renderButton.addEventListener('click', () => {
  sourceTree = parseMarkdownToTree(markdownInput.value);
  render(currentLayout);
});

radialButton.addEventListener('click', () => render('radial'));
rightButton.addEventListener('click', () => render('right'));
markdownInput.addEventListener('input', debounce(() => {
  sourceTree = parseMarkdownToTree(markdownInput.value);
  render(currentLayout);
}, 450));

render('radial');

function render(layout) {
  currentLayout = layout;
  const tree = cloneTree(sourceTree);
  const laidOutTree = layout === 'radial'
    ? layoutClockwise(tree, { width: 1200, height: 800 })
    : layoutRightBiased(tree, { width: 1200, height: 800 });
  const { nodes, links } = flattenTree(laidOutTree);

  mapTitle.textContent = laidOutTree.title;
  nodeCount.textContent = `${nodes.length} nœud${nodes.length > 1 ? 's' : ''}`;
  layoutLabel.textContent = layout === 'radial' ? 'Horloge' : 'Vue à droite';
  layoutLabel.classList.toggle('muted', layout !== 'radial');

  svg.innerHTML = '';
  renderDefinitions();
  renderLinks(links);
  renderNodes(nodes);
}

function renderDefinitions() {
  const defs = svgElement('defs', {});
  const gradient = svgElement('linearGradient', { id: 'rootGradient', x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
  gradient.append(svgElement('stop', { offset: '0%', 'stop-color': '#76ffd2' }));
  gradient.append(svgElement('stop', { offset: '100%', 'stop-color': '#5f8cff' }));
  defs.append(gradient);
  svg.append(defs);
}

function renderLinks(links) {
  const group = svgElement('g', { class: 'links' });
  links.forEach(({ source, target }) => {
    const midX = (source.x + target.x) / 2;
    const path = `M ${source.x} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x} ${target.y}`;
    group.append(svgElement('path', { d: path, class: 'link' }));
  });
  svg.append(group);
}

function renderNodes(nodes) {
  const group = svgElement('g', { class: 'nodes' });

  nodes.forEach((node) => {
    const isRoot = node.depth === 0;
    const width = isRoot ? 220 : Math.min(240, Math.max(130, node.title.length * 8 + 38));
    const height = isRoot ? 70 : 52;
    const item = svgElement('g', {
      class: `node depth-${Math.min(node.depth, 4)} ${isRoot ? 'root' : ''}`,
      transform: `translate(${node.x - width / 2} ${node.y - height / 2})`,
    });

    item.append(svgElement('rect', {
      width,
      height,
      rx: isRoot ? 24 : 18,
      class: 'node-box',
    }));

    const text = svgElement('text', {
      x: width / 2,
      y: height / 2 + 5,
      'text-anchor': 'middle',
      class: 'node-label',
    });
    text.textContent = truncate(node.title, isRoot ? 28 : 25);
    item.append(text);
    group.append(item);
  });

  svg.append(group);
}

function svgElement(tag, attrs) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function debounce(callback, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay);
  };
}
