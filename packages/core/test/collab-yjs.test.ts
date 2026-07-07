import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { Collab, FlowStore, type GraphPatch, type Node } from '@reflow/core';

const n = (id: string, x = 0, y = 0): Node => ({ id, position: { x, y }, data: { label: id } });

/**
 * Proves the transport-agnostic Collab layer bridges to a REAL CRDT (Yjs).
 * Each peer mirrors its Collab patches into a shared Y.Doc; Yjs propagates
 * updates between docs; the receiving side feeds the merged patch back into
 * its Collab. This is the exact pattern documented in docs/collaboration.md.
 */
function bindToYjs(store: FlowStore, doc: Y.Doc, peerId: string): Collab {
  const yNodes = doc.getMap<Node>('nodes');
  const yEdges = doc.getMap<Node>('edges');
  let applyingRemote = false;

  const collab = new Collab(store, {
    peerId,
    broadcast: (patch) => {
      applyingRemote = true;
      doc.transact(() => {
        for (const nd of patch.nodes?.upsert ?? []) yNodes.set(nd.id, nd);
        for (const id of patch.nodes?.remove ?? []) yNodes.delete(id);
        for (const e of patch.edges?.upsert ?? []) yEdges.set(e.id, e as never);
        for (const id of patch.edges?.remove ?? []) yEdges.delete(id);
      }, peerId);
      applyingRemote = false;
    },
  });

  const applyFromYjs = (events: Y.YMapEvent<unknown>, isNode: boolean) => {
    if (applyingRemote) return;
    const upsert: unknown[] = [];
    const remove: string[] = [];
    const map = isNode ? yNodes : yEdges;
    events.changes.keys.forEach((change, key) => {
      if (change.action === 'delete') remove.push(key);
      else upsert.push(map.get(key));
    });
    const patch: GraphPatch = { origin: `yjs:${peerId}` };
    if (isNode) patch.nodes = { upsert: upsert as Node[], remove };
    else patch.edges = { upsert: upsert as never[], remove };
    collab.receive(patch);
  };
  yNodes.observe((e) => applyFromYjs(e, true));
  yEdges.observe((e) => applyFromYjs(e, false));
  return collab;
}

describe('Collab ↔ Yjs interop (real CRDT)', () => {
  it('syncs two stores through independent Y.Docs', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    // Relay Yjs updates between the two docs (stand-in for the network).
    docA.on('update', (u: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') Y.applyUpdate(docB, u, 'remote');
    });
    docB.on('update', (u: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') Y.applyUpdate(docA, u, 'remote');
    });

    const sA = new FlowStore();
    const sB = new FlowStore();
    bindToYjs(sA, docA, 'A');
    bindToYjs(sB, docB, 'B');

    sA.addNode(n('x', 5, 5));
    expect(sB.getNode('x')).toBeDefined();
    expect(sB.getNode('x')!.position).toEqual({ x: 5, y: 5 });

    sB.addNode(n('y', 100));
    sB.connect({ source: 'x', target: 'y' });
    expect(sA.getNode('y')).toBeDefined();
    expect(sA.getEdges()).toHaveLength(1);

    sA.removeNodes(['x']);
    expect(sB.getNode('x')).toBeUndefined();
  });

  it('a third peer joins mid-session and catches up via CRDT state', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const sA = new FlowStore();
    bindToYjs(sA, docA, 'A');
    sA.addNode(n('a'));
    sA.addNode(n('b', 100));

    // B joins later: sync the whole CRDT state, then bind.
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    const sB = new FlowStore();
    // Seed B's store from the CRDT map before binding.
    const yNodes = docB.getMap<Node>('nodes');
    sB.applyRemotePatch({ nodes: { upsert: [...yNodes.values()] } });
    expect(sB.getNodes()).toHaveLength(2);
  });
});
