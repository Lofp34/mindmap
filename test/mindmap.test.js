import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addChildNode,
  estimateNodeSize,
  flattenTree,
  layoutClockwise,
  layoutRightBiased,
  parseMarkdownToTree,
  treeToMarkdown,
  visibleTree,
} from '../src/mindmap.js';

test('parseMarkdownToTree converts headings and bullets into a hierarchy', () => {
  const tree = parseMarkdownToTree(`# Centre

## Branche A
- Note 1
- Note 2

## Branche B
### Sous-branche`);

  assert.equal(tree.title, 'Centre');
  assert.equal(tree.children.length, 2);
  assert.equal(tree.children[0].title, 'Branche A');
  assert.deepEqual(tree.children[0].children.map((child) => child.title), ['Note 1', 'Note 2']);
  assert.equal(tree.children[1].children[0].title, 'Sous-branche');
});

test('layoutClockwise distributes first-level branches around the central node', () => {
  const tree = parseMarkdownToTree(`# Centre

## Nord
## Est
## Sud
## Ouest`);
  layoutClockwise(tree, { width: 1000, height: 1000 });

  const quadrants = tree.children.map((child) => ({ x: Math.sign(child.x - tree.x), y: Math.sign(child.y - tree.y) }));

  assert(quadrants.some((point) => point.y < 0), 'at least one branch is above the center');
  assert(quadrants.some((point) => point.x > 0), 'at least one branch is right of the center');
  assert(quadrants.some((point) => point.y > 0), 'at least one branch is below the center');
  assert(quadrants.some((point) => point.x < 0), 'at least one branch is left of the center');
});

test('layoutRightBiased keeps first-level branches to the right for comparison', () => {
  const tree = parseMarkdownToTree(`# Centre

## A
## B
## C`);
  layoutRightBiased(tree, { width: 1000, height: 700 });

  assert(tree.children.every((child) => child.x > tree.x));
  assert.equal(flattenTree(tree).nodes.length, 4);
});

test('visibleTree limits the initial depth and expands one selected branch', () => {
  const tree = parseMarkdownToTree(`# Centre

## A
### A1
#### A1a
## B
### B1`);

  const firstLevelOnly = visibleTree(tree, { depthLimit: 1, expandedIds: new Set() });
  assert.deepEqual(flattenTree(firstLevelOnly).nodes.map((node) => node.title), ['Centre', 'A', 'B']);

  const expanded = visibleTree(tree, { depthLimit: 1, expandedIds: new Set([tree.children[0].id]) });
  assert.deepEqual(flattenTree(expanded).nodes.map((node) => node.title), ['Centre', 'A', 'A1', 'B']);
});

test('visibleTree depth limit follows tree levels instead of Markdown hash counts', () => {
  const tree = parseMarkdownToTree(`# Centre

## A
### A1
#### A1a`);

  const twoLevels = visibleTree(tree, { depthLimit: 2, expandedIds: new Set() });
  assert.deepEqual(flattenTree(twoLevels).nodes.map((node) => node.title), ['Centre', 'A', 'A1']);
});

test('tree edits are serialized back to Markdown headings', () => {
  const tree = parseMarkdownToTree(`# Centre

## A`);

  addChildNode(tree, tree.children[0].id, 'A1');

  assert.equal(treeToMarkdown(tree), `# Centre

## A

### A1`);
});

test('layoutClockwise spaces visible node boxes without overlap', () => {
  const tree = parseMarkdownToTree(`# Centre

## A
### A1
### A2
### A3
### A4
## B
### B1
### B2
### B3
### B4
## C
### C1
### C2
### C3
### C4`);

  const visible = visibleTree(tree, { depthLimit: Infinity, expandedIds: new Set() });
  layoutClockwise(visible, { width: 1000, height: 700 });
  assertNoBoxOverlap(flattenTree(visible).nodes);
});

function assertNoBoxOverlap(nodes) {
  const boxes = nodes.map((node) => {
    const { width, height } = estimateNodeSize(node);
    return {
      title: node.title,
      left: node.x - width / 2,
      right: node.x + width / 2,
      top: node.y - height / 2,
      bottom: node.y + height / 2,
    };
  });

  for (let a = 0; a < boxes.length; a += 1) {
    for (let b = a + 1; b < boxes.length; b += 1) {
      const first = boxes[a];
      const second = boxes[b];
      const overlaps = first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top;
      assert.equal(overlaps, false, `${first.title} overlaps ${second.title}`);
    }
  }
}
