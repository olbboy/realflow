import { describe, expect, it } from 'vitest';
import { FlowStore, type Edge, type Node } from '@reflow/core';

const n = (id: string, x = 0, y = 0, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x, y },
  data: { label: id },
  width: 100,
  height: 40,
  ...extra,
});
const e = (id: string, source: string, target: string): Edge => ({ id, source, target });

describe('clipboard: copy / paste / duplicate', () => {
  it('copies selected nodes and the edges between them', () => {
    const store = new FlowStore({
      nodes: [n('a'), n('b', 200), n('c', 400)],
      edges: [e('e1', 'a', 'b'), e('e2', 'b', 'c')],
    });
    const clip = store.copy(['a', 'b']);
    expect(clip.nodes.map((x) => x.id).sort()).toEqual(['a', 'b']);
    // Only the a→b edge is wholly inside the selection.
    expect(clip.edges.map((x) => x.id)).toEqual(['e1']);
  });

  it('paste inserts with fresh ids, offset, remapped edges, and selects', () => {
    const store = new FlowStore({
      nodes: [n('a'), n('b', 200)],
      edges: [e('e1', 'a', 'b')],
    });
    const clip = store.copy(['a', 'b']);
    const { nodeIds, edgeIds } = store.paste(clip, { x: 50, y: 50 });
    expect(store.getNodes()).toHaveLength(4);
    expect(store.getEdges()).toHaveLength(2);
    // New ids differ from originals.
    expect(nodeIds).not.toContain('a');
    // Pasted edge connects the two NEW nodes.
    const pasted = store.getEdge(edgeIds[0])!;
    expect(nodeIds).toContain(pasted.source);
    expect(nodeIds).toContain(pasted.target);
    // Offset applied.
    const newA = store.getNode(nodeIds[0])!;
    expect(newA.position).toEqual({ x: 50, y: 50 });
    // Pasted nodes are selected.
    expect(store.selectedNodes.has(nodeIds[0])).toBe(true);
    // One undo removes the whole paste.
    store.undo();
    expect(store.getNodes()).toHaveLength(2);
  });

  it('duplicateSelection clones the selection', () => {
    const store = new FlowStore({ nodes: [n('a'), n('b', 200)], edges: [e('e1', 'a', 'b')] });
    store.setSelection(['a', 'b']);
    const { nodeIds } = store.duplicateSelection();
    expect(store.getNodes()).toHaveLength(4);
    expect(nodeIds).toHaveLength(2);
  });

  it('copies groups together with their children', () => {
    const store = new FlowStore({
      nodes: [
        n('g', 0, 0, { width: 300, height: 200 }),
        n('child', 20, 30, { parentId: 'g' }),
      ],
    });
    const clip = store.copy(['g']);
    expect(clip.nodes.map((x) => x.id).sort()).toEqual(['child', 'g']);
    const { nodeIds } = store.paste(clip);
    // Child's parent is remapped to the new group id, not the original.
    const newChild = store.getNodes().find((x) => x.parentId && nodeIds.includes(x.id) && x.id !== nodeIds[0]);
    expect(newChild?.parentId).toBeDefined();
    expect(newChild?.parentId).not.toBe('g');
  });
});

describe('edge reconnection', () => {
  it('moves the target endpoint to a new node', () => {
    const store = new FlowStore({
      nodes: [n('a'), n('b', 300), n('c', 300, 200)],
      edges: [e('e1', 'a', 'b')],
    });
    // b's target handle default is left-mid; c's is left-mid at (300,220).
    store.startReconnect('e1', 'target');
    expect(store.isReconnecting).toBe(true);
    // Drag near c's target handle.
    store.moveConnection({ x: 300, y: 220 });
    expect(store.connection?.toHandle?.nodeId).toBe('c');
    const edge = store.endConnection();
    expect(edge?.target).toBe('c');
    expect(store.getEdge('e1')!.target).toBe('c');
    // Undoable.
    store.undo();
    expect(store.getEdge('e1')!.target).toBe('b');
  });

  it('deletes the edge when reconnected to empty space', () => {
    const store = new FlowStore({
      nodes: [n('a'), n('b', 300)],
      edges: [e('e1', 'a', 'b')],
    });
    store.startReconnect('e1', 'target');
    store.moveConnection({ x: 99999, y: 99999 }); // nowhere
    store.endConnection();
    expect(store.getEdge('e1')).toBeUndefined();
    store.undo();
    expect(store.getEdge('e1')).toBeDefined();
  });

  it('rejects a reconnection that would duplicate an existing edge', () => {
    const store = new FlowStore({
      nodes: [n('a'), n('b', 300), n('c', 600)],
      edges: [e('e1', 'a', 'b'), e('e2', 'a', 'c')],
    });
    // Try to reconnect e2's target from c to b => duplicate of e1.
    store.startReconnect('e2', 'target');
    store.moveConnection({ x: 300, y: 20 }); // near b
    store.endConnection();
    // e2 should still point to c (rejected), e1 unchanged.
    expect(store.getEdge('e2')!.target).toBe('c');
  });
});
