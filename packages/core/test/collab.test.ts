import { describe, expect, it } from 'vitest';
import { Collab, Presence, FlowStore, type GraphPatch, type Node } from '@realflow/core';

const n = (id: string, x = 0, y = 0): Node => ({ id, position: { x, y }, data: { label: id } });

describe('Collab — two stores converge', () => {
  it('propagates add / update / remove between peers', () => {
    const sA = new FlowStore();
    const sB = new FlowStore();
    // Mutual references, so hold the peers in one object rather than two `let`s.
    const peers: { a?: Collab; b?: Collab } = {};
    peers.a = new Collab(sA, { peerId: 'A', broadcast: (p) => peers.b!.receive(p) });
    peers.b = new Collab(sB, { peerId: 'B', broadcast: (p) => peers.a!.receive(p) });

    // A adds a node → appears in B.
    sA.addNode(n('x', 10, 20));
    expect(sB.getNode('x')).toBeDefined();
    expect(sB.getNode('x')!.position).toEqual({ x: 10, y: 20 });

    // B moves it → A sees the move.
    sB.setNodePosition('x', { x: 99, y: 99 });
    expect(sA.getNode('x')!.position).toEqual({ x: 99, y: 99 });

    // A connects two nodes → B gets the edge.
    sA.addNode(n('y', 200));
    sA.connect({ source: 'x', target: 'y' });
    expect(sB.getEdges()).toHaveLength(1);

    // B removes a node → A drops it and the edge.
    sB.removeNodes(['y']);
    expect(sA.getNode('y')).toBeUndefined();
    expect(sA.getEdges()).toHaveLength(0);
  });

  it('does not echo remote changes back (no infinite loop) and skips local undo', () => {
    const sA = new FlowStore();
    const sB = new FlowStore();
    let broadcasts = 0;
    const peers: { a?: Collab; b?: Collab } = {};
    peers.a = new Collab(sA, {
      peerId: 'A',
      broadcast: (p) => {
        broadcasts++;
        peers.b!.receive(p);
      },
    });
    peers.b = new Collab(sB, {
      peerId: 'B',
      broadcast: (p) => {
        broadcasts++;
        peers.a!.receive(p);
      },
    });

    sA.addNode(n('x'));
    // Exactly one broadcast (A→B); B applying must not re-broadcast.
    expect(broadcasts).toBe(1);
    // Remote change is not in B's undo stack.
    expect(sB.canUndo).toBe(false);
  });

  it('onboards a late joiner with fullState()', () => {
    const sA = new FlowStore({ nodes: [n('a'), n('b', 100)] });
    const cA = new Collab(sA, { peerId: 'A', broadcast: () => {} });
    const sB = new FlowStore();
    const cB = new Collab(sB, { peerId: 'B', broadcast: () => {} });
    cB.receive(cA.fullState());
    expect(sB.getNodes()).toHaveLength(2);
    cA.destroy();
    cB.destroy();
  });

  it('converges under concurrent edits regardless of delivery order (Lamport LWW)', () => {
    const run = (deliverAFirst: boolean) => {
      const sA = new FlowStore({ nodes: [n('x')] });
      const sB = new FlowStore({ nodes: [n('x')] });
      const toB: GraphPatch[] = [];
      const toA: GraphPatch[] = [];
      const cA = new Collab(sA, { peerId: 'A', broadcast: (p) => toB.push(p) });
      const cB = new Collab(sB, { peerId: 'B', broadcast: (p) => toA.push(p) });

      // Concurrent moves of the SAME node (no messages exchanged yet).
      sA.setNodePosition('x', { x: 10, y: 0 });
      sB.setNodePosition('x', { x: 20, y: 0 });

      // Deliver the queued patches in the chosen order.
      if (deliverAFirst) {
        toB.forEach((p) => cB.receive(p));
        toA.forEach((p) => cA.receive(p));
      } else {
        toA.forEach((p) => cA.receive(p));
        toB.forEach((p) => cB.receive(p));
      }
      return [sA.getNode('x')!.position, sB.getNode('x')!.position] as const;
    };

    const [a1, b1] = run(true);
    const [a2, b2] = run(false);
    // Both peers agree, and the outcome is identical regardless of order.
    expect(a1).toEqual(b1);
    expect(a2).toEqual(b2);
    expect(a1).toEqual(a2);
    // Deterministic tie-break: higher peerId ('B') wins the equal-clock tie.
    expect(a1).toEqual({ x: 20, y: 0 });
  });
});

describe('Presence', () => {
  it('tracks remote cursors/selection and prunes stale peers', () => {
    const changes: number[] = [];
    const p = new Presence({
      peerId: 'me',
      broadcast: () => {},
      onChange: (peers) => changes.push(peers.length),
      timeout: 1000,
    });
    p.receive({ id: 'other', name: 'Ada', cursor: { x: 5, y: 5 }, selection: ['n1'] }, 0);
    expect(p.remotePeers()).toHaveLength(1);
    expect(p.remotePeers()[0].name).toBe('Ada');
    // Own updates are ignored in the remote list.
    p.receive({ id: 'me', cursor: { x: 1, y: 1 } }, 0);
    expect(p.remotePeers()).toHaveLength(1);
    // Stale peer pruned after the timeout.
    p.prune(2000);
    expect(p.remotePeers()).toHaveLength(0);
  });

  it('broadcasts local updates', () => {
    const sent: unknown[] = [];
    const p = new Presence({ peerId: 'me', broadcast: (s) => sent.push(s) });
    p.update({ cursor: { x: 3, y: 4 }, name: 'Me' }, 100);
    expect(sent).toHaveLength(1);
    expect((sent[0] as { cursor: { x: number } }).cursor.x).toBe(3);
  });
});
