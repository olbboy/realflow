import { describe, expect, it } from 'vitest';
import { FlowStore, DEFAULT_NODE_WIDTH } from '@realflow/core';

/**
 * groupSelection wraps the selected nodes in a container, re-parenting each to
 * the group with positions rebased to the group's local space, in one undo.
 * ungroup dissolves the container and returns children to the root.
 */
const nodeAt = (id: string, x: number, y: number) => ({
  id,
  position: { x, y },
  width: 100,
  height: 40,
  data: { label: id },
});

describe('groupSelection / ungroup', () => {
  it('wraps the selection in a group sized to its bounding box', () => {
    const store = new FlowStore();
    store.addNodes([nodeAt('a', 0, 0), nodeAt('b', 300, 200)]);
    store.setSelection(['a', 'b']);

    const gid = store.groupSelection({ padding: 20 });
    expect(gid).toBeTruthy();

    const group = store.getNode(gid!)!;
    expect(group.type).toBe('group');
    // bbox is (0,0)..(400,240); with pad 20 → origin (-20,-20), size 440×280
    expect(group.position).toEqual({ x: -20, y: -20 });
    expect(group.width).toBe(440);
    expect(group.height).toBe(280);
  });

  it('re-parents members and rebases their positions into group space', () => {
    const store = new FlowStore();
    store.addNodes([nodeAt('a', 0, 0), nodeAt('b', 300, 200)]);
    store.setSelection(['a', 'b']);
    const gid = store.groupSelection({ padding: 20 })!;

    const a = store.getNode('a')!;
    const b = store.getNode('b')!;
    expect(a.parentId).toBe(gid);
    expect(b.parentId).toBe(gid);
    // group origin is (-20,-20); a was (0,0) → local (20,20); b (300,200) → (320,220)
    expect(a.position).toEqual({ x: 20, y: 20 });
    expect(b.position).toEqual({ x: 320, y: 220 });
    // absolute positions are preserved by the rebase
    expect(store.absolutePosition('a')).toEqual({ x: 0, y: 0 });
    expect(store.absolutePosition('b')).toEqual({ x: 300, y: 200 });
  });

  it('is a single undo step and fully reversible', () => {
    const store = new FlowStore();
    store.addNodes([nodeAt('a', 0, 0), nodeAt('b', 300, 200)]);
    store.setSelection(['a', 'b']);
    const before = store.getNodes().length;

    const gid = store.groupSelection()!;
    expect(store.getNodes().length).toBe(before + 1);

    store.undo();
    expect(store.getNode(gid)).toBeUndefined();
    expect(store.getNode('a')!.parentId).toBeUndefined();
    expect(store.getNode('a')!.position).toEqual({ x: 0, y: 0 });
    expect(store.getNodes().length).toBe(before);
  });

  it('preserves existing nesting (skips a member whose parent is also selected)', () => {
    const store = new FlowStore();
    store.addNodes([nodeAt('g', 0, 0), { ...nodeAt('c', 10, 10), parentId: 'g' }, nodeAt('d', 500, 0)]);
    store.setSelection(['g', 'c', 'd']);
    const newGroup = store.groupSelection()!;

    // c stays inside g (its parent g was selected); g and d go into the new group
    expect(store.getNode('c')!.parentId).toBe('g');
    expect(store.getNode('g')!.parentId).toBe(newGroup);
    expect(store.getNode('d')!.parentId).toBe(newGroup);
  });

  it('returns undefined when nothing is selected', () => {
    const store = new FlowStore();
    store.addNodes([nodeAt('a', 0, 0)]);
    expect(store.groupSelection()).toBeUndefined();
  });

  it('ungroup dissolves the container and returns children to the root at absolute positions', () => {
    const store = new FlowStore();
    store.addNodes([nodeAt('a', 40, 0), nodeAt('b', 340, 0)]);
    store.setSelection(['a', 'b']);
    const gid = store.groupSelection({ padding: 0 })!;
    expect(store.getNode('a')!.parentId).toBe(gid);

    store.ungroup(gid);
    expect(store.getNode(gid)).toBeUndefined();
    const a = store.getNode('a')!;
    expect(a.parentId).toBeUndefined();
    // absolute position restored on detach
    expect(a.position).toEqual({ x: 40, y: 0 });
    // sanity: default width fallback still exported elsewhere
    expect(DEFAULT_NODE_WIDTH).toBeGreaterThan(0);
  });
});
