import { describe, expect, it } from 'vitest';
import { FlowStore } from '@realflow/core';

/**
 * collapseNode hides a node's edge-descendants (and edges touching them);
 * expandNode reveals them. Nested collapses compose. One undo per toggle.
 *
 * Graph:  a → b → c
 *              ↘ d
 * (b has children c, d; c has none; d has none)
 */
const build = () => {
  const store = new FlowStore();
  store.addNodes(
    ['a', 'b', 'c', 'd'].map((id, i) => ({ id, position: { x: i * 150, y: 0 }, width: 100, height: 40, data: { label: id } }))
  );
  store.addEdges([
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'bc', source: 'b', target: 'c' },
    { id: 'bd', source: 'b', target: 'd' },
  ]);
  return store;
};

const hiddenNodes = (s: FlowStore) => s.getNodes().filter((n) => n.hidden).map((n) => n.id).sort();
const hiddenEdges = (s: FlowStore) => s.getEdges().filter((e) => e.hidden).map((e) => e.id).sort();

describe('collapseNode / expandNode', () => {
  it('collapsing a node hides its descendants and the edges into them', () => {
    const store = build();
    store.collapseNode('b');
    expect(store.getNode('b')!.collapsed).toBe(true);
    expect(store.getNode('b')!.hidden).toBeFalsy(); // the collapsed node stays visible
    expect(hiddenNodes(store)).toEqual(['c', 'd']);
    expect(hiddenEdges(store)).toEqual(['bc', 'bd']); // ab stays visible (a, b visible)
  });

  it('expanding restores visibility', () => {
    const store = build();
    store.collapseNode('b');
    store.expandNode('b');
    expect(store.getNode('b')!.collapsed).toBe(false);
    expect(hiddenNodes(store)).toEqual([]);
    expect(hiddenEdges(store)).toEqual([]);
  });

  it('collapsing the root hides everything downstream', () => {
    const store = build();
    store.collapseNode('a');
    expect(hiddenNodes(store)).toEqual(['b', 'c', 'd']);
    expect(hiddenEdges(store)).toEqual(['ab', 'bc', 'bd']);
  });

  it('nested collapse composes: expanding the outer keeps the inner collapsed', () => {
    const store = build();
    store.collapseNode('b'); // hides c, d
    store.collapseNode('a'); // hides b, c, d
    expect(hiddenNodes(store)).toEqual(['b', 'c', 'd']);

    store.expandNode('a'); // b visible again, but b is still collapsed → c, d stay hidden
    expect(store.getNode('b')!.hidden).toBeFalsy();
    expect(store.getNode('b')!.collapsed).toBe(true);
    expect(hiddenNodes(store)).toEqual(['c', 'd']);
  });

  it('toggleCollapse flips state; each toggle is one undo', () => {
    const store = build();
    store.toggleCollapse('b');
    expect(hiddenNodes(store)).toEqual(['c', 'd']);
    store.undo(); // reverts the collapse in one step
    expect(hiddenNodes(store)).toEqual([]);
    expect(store.getNode('b')!.collapsed).toBeFalsy();
  });

  it('is a no-op on unknown / already-in-state nodes', () => {
    const store = build();
    expect(() => store.collapseNode('nope')).not.toThrow();
    store.expandNode('b'); // not collapsed → no-op
    expect(hiddenNodes(store)).toEqual([]);
  });
});
