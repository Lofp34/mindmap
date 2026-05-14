import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenTree, layoutClockwise, layoutRightBiased, parseMarkdownToTree } from '../src/mindmap.js';

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
