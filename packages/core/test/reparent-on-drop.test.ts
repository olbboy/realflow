import { describe, expect, it } from 'vitest';
import { FlowStore, type Node } from '@realflow/core';

/**
 * reparentOnDrop (dynamic grouping): on drag-drop, a node attaches to the
 * smallest `group` it lands inside, or detaches when dropped outside. The
 * cycle guard is parentId-based so a group can never become its own descendant.
 * Alignment guides are disabled so drop coordinates are deterministic.
 */
const grp = (id: string, x: number, y: number, w: number, h: number): Node => ({
  id, type: 'group', position: { x, y }, width: w, height: h, data: { label: id },
});
const nd = (id: string, x: number, y: number): Node => ({
  id, position: { x, y }, width: 100, height: 40, data: { label: id },
});
const drop = (s: FlowStore, id: string, dx: number, dy: number) => {
  s.startDrag([id]);
  s.dragBy({ x: dx, y: dy }); // cumulative delta from drag start
  s.endDrag();
};

describe('reparentOnDrop (dynamic grouping)', () => {
  it('attaches a node to the group it is dropped inside, rebasing position', () => {
    const store = new FlowStore({ reparentOnDrop: true, alignmentGuides: false });
    store.addNodes([grp('g', 0, 0, 400, 400), nd('x', 600, 100)]);
    drop(store, 'x', -500, 30); // 600→100, 100→130 → center (150,150) inside g
    expect(store.getNode('x')!.parentId).toBe('g');
    expect(store.absolutePosition('x')).toEqual({ x: 100, y: 130 }); // absolute preserved
  });

  it('detaches a child dropped outside every group', () => {
    const store = new FlowStore({ reparentOnDrop: true, alignmentGuides: false });
    store.addNodes([grp('g', 0, 0, 400, 400), { ...nd('x', 50, 50), parentId: 'g' }]);
    expect(store.getNode('x')!.parentId).toBe('g');
    drop(store, 'x', 800, 0); // far outside g
    expect(store.getNode('x')!.parentId).toBeUndefined();
  });

  it('coalesces move + reparent into one undo', () => {
    const store = new FlowStore({ reparentOnDrop: true, alignmentGuides: false });
    store.addNodes([grp('g', 0, 0, 400, 400), nd('x', 600, 100)]);
    drop(store, 'x', -500, 30);
    expect(store.getNode('x')!.parentId).toBe('g');
    store.undo();
    const x = store.getNode('x')!;
    expect(x.parentId).toBeUndefined();
    expect(x.position).toEqual({ x: 600, y: 100 });
  });

  it('does nothing when the option is off (default)', () => {
    const store = new FlowStore({ alignmentGuides: false });
    store.addNodes([grp('g', 0, 0, 400, 400), nd('x', 600, 100)]);
    drop(store, 'x', -500, 30);
    expect(store.getNode('x')!.parentId).toBeUndefined();
  });

  it('never parents a node into its own descendant group (no cycle)', () => {
    const store = new FlowStore({ reparentOnDrop: true, alignmentGuides: false });
    store.addNodes([grp('x', 0, 0, 500, 500), { ...grp('inner', 50, 50, 200, 200), parentId: 'x' }]);
    drop(store, 'x', 60, 60); // x's center drifts over its own child group
    expect(store.getNode('x')!.parentId).toBeUndefined();
  });

  it('picks the innermost (smallest) containing group', () => {
    const store = new FlowStore({ reparentOnDrop: true, alignmentGuides: false });
    store.addNodes([grp('outer', 0, 0, 600, 600), grp('innerG', 100, 100, 200, 200), nd('x', 900, 150)]);
    drop(store, 'x', -800, 0); // 900→100 → center (150,170) inside both → innerG
    expect(store.getNode('x')!.parentId).toBe('innerG');
  });
});
