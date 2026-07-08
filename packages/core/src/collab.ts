import type { Edge, Node, XY } from './types';
import type { FlowStore } from './store';

/**
 * Transport-agnostic real-time collaboration.
 *
 * RealFlow's core stays zero-dependency: `Collab` captures local graph changes
 * as element-level patches and applies remote ones, converging via
 * last-write-wins per element. Wire it to ANY transport — a WebSocket,
 * BroadcastChannel, WebRTC, or a Yjs `Y.Map` (see docs/collaboration.md).
 * Remote edits bypass the local undo stack and never echo back.
 */

export interface GraphPatch {
  /** Peer that produced this patch; used to drop echoes and break ties. */
  origin: string;
  nodes?: { upsert?: Node[]; remove?: string[] };
  edges?: { upsert?: Edge[]; remove?: string[] };
  /**
   * Lamport version per element id (node or edge). Enables deterministic
   * last-write-wins convergence regardless of delivery order — higher wins,
   * ties broken by `origin`.
   */
  versions?: Record<string, number>;
}

interface Ver {
  c: number; // Lamport clock
  p: string; // origin peer (tie-break)
}

const newer = (incoming: Ver, stored: Ver | undefined): boolean => {
  if (!stored) return true;
  if (incoming.c !== stored.c) return incoming.c > stored.c;
  return incoming.p > stored.p;
};

export interface CollabOptions {
  /** Unique id for this peer/tab. */
  peerId: string;
  /** Send a patch to every other peer. */
  broadcast: (patch: GraphPatch) => void;
}

const snapshotMap = <T extends { id: string }>(items: T[]): Map<string, T> =>
  new Map(items.map((i) => [i.id, i]));

/**
 * Bridges a FlowStore to a broadcast transport. Local commits are diffed into
 * a patch and broadcast; incoming patches are applied without echo.
 */
export class Collab {
  private store: FlowStore;
  private peerId: string;
  private broadcast: (patch: GraphPatch) => void;
  private prevNodes: Map<string, Node>;
  private prevEdges: Map<string, Edge>;
  private unsub: () => void;
  private clock = 0;
  /** Winning version per element id (nodes and edges share the id space). */
  private ver = new Map<string, Ver>();

  constructor(store: FlowStore, options: CollabOptions) {
    this.store = store;
    this.peerId = options.peerId;
    this.broadcast = options.broadcast;
    this.prevNodes = snapshotMap(store.getNodes());
    this.prevEdges = snapshotMap(store.getEdges());
    this.unsub = store.subscribe('commit', () => this.onLocalCommit());
  }

  private onLocalCommit(): void {
    const nodes = this.store.getNodes();
    const edges = this.store.getEdges();
    const patch: GraphPatch = { origin: this.peerId };
    const versions: Record<string, number> = {};

    const stamp = (id: string): void => {
      this.clock++;
      this.ver.set(id, { c: this.clock, p: this.peerId });
      versions[id] = this.clock;
    };

    const upNodes: Node[] = [];
    const rmNodes: string[] = [];
    const nextNodeIds = new Set<string>();
    for (const n of nodes) {
      nextNodeIds.add(n.id);
      if (this.prevNodes.get(n.id) !== n) {
        upNodes.push(n);
        stamp(n.id);
      }
    }
    for (const id of this.prevNodes.keys())
      if (!nextNodeIds.has(id)) {
        rmNodes.push(id);
        stamp(id);
      }

    const upEdges: Edge[] = [];
    const rmEdges: string[] = [];
    const nextEdgeIds = new Set<string>();
    for (const e of edges) {
      nextEdgeIds.add(e.id);
      if (this.prevEdges.get(e.id) !== e) {
        upEdges.push(e);
        stamp(e.id);
      }
    }
    for (const id of this.prevEdges.keys())
      if (!nextEdgeIds.has(id)) {
        rmEdges.push(id);
        stamp(id);
      }

    this.prevNodes = snapshotMap(nodes);
    this.prevEdges = snapshotMap(edges);

    if (upNodes.length || rmNodes.length) patch.nodes = { upsert: upNodes, remove: rmNodes };
    if (upEdges.length || rmEdges.length) patch.edges = { upsert: upEdges, remove: rmEdges };
    if (patch.nodes || patch.edges) {
      patch.versions = versions;
      this.broadcast(patch);
    }
  }

  /**
   * Apply a patch from another peer. Uses per-element Lamport versions for
   * deterministic last-write-wins: an element is applied only if the incoming
   * version beats what we've already accepted, so peers converge regardless
   * of message order. Falls back to accept-all when a patch carries no
   * versions (e.g. a fullState onboarding patch).
   */
  receive(patch: GraphPatch): void {
    if (patch.origin === this.peerId) return;
    const versions = patch.versions;
    // Advance our Lamport clock past everything we've seen.
    if (versions) for (const v of Object.values(versions)) this.clock = Math.max(this.clock, v);

    const accept = (id: string): boolean => {
      if (!versions) return true;
      const incoming: Ver = { c: versions[id] ?? 0, p: patch.origin };
      if (!newer(incoming, this.ver.get(id))) return false;
      this.ver.set(id, incoming);
      return true;
    };

    const nodesUpsert = (patch.nodes?.upsert ?? []).filter((n) => accept(n.id));
    const nodesRemove = (patch.nodes?.remove ?? []).filter((id) => accept(id));
    const edgesUpsert = (patch.edges?.upsert ?? []).filter((e) => accept(e.id));
    const edgesRemove = (patch.edges?.remove ?? []).filter((id) => accept(id));

    this.store.applyRemotePatch({
      nodes: { upsert: nodesUpsert, remove: nodesRemove },
      edges: { upsert: edgesUpsert, remove: edgesRemove },
    });
    // Keep the diff baseline in sync so remote changes aren't re-broadcast.
    this.prevNodes = snapshotMap(this.store.getNodes());
    this.prevEdges = snapshotMap(this.store.getEdges());
  }

  /** Full-state patch for onboarding a newly-joined peer. */
  fullState(): GraphPatch {
    return {
      origin: this.peerId,
      nodes: { upsert: this.store.getNodes() },
      edges: { upsert: this.store.getEdges() },
    };
  }

  destroy(): void {
    this.unsub();
  }
}

// ── presence (cursors, selection, identity) ──────────────────────────────

export interface PeerState {
  id: string;
  name?: string;
  color?: string;
  /** Cursor position in flow coordinates. */
  cursor?: XY | null;
  /** Selected node/edge ids. */
  selection?: string[];
  /** Last-seen timestamp (ms), for stale-peer eviction. */
  lastSeen?: number;
}

export interface PresenceOptions {
  peerId: string;
  broadcast: (state: PeerState) => void;
  /** Called whenever the set of remote peers changes. */
  onChange?: (peers: PeerState[]) => void;
  /** Drop peers not seen for this long (ms). Default 15000. */
  timeout?: number;
}

/**
 * Lightweight presence: broadcast your cursor/selection/identity and track
 * remote peers. Transport-agnostic, same as `Collab`.
 */
export class Presence {
  private peerId: string;
  private broadcast: (state: PeerState) => void;
  private onChange?: (peers: PeerState[]) => void;
  private timeout: number;
  private local: PeerState;
  private peers = new Map<string, PeerState>();

  constructor(options: PresenceOptions) {
    this.peerId = options.peerId;
    this.broadcast = options.broadcast;
    this.onChange = options.onChange;
    this.timeout = options.timeout ?? 15000;
    this.local = { id: options.peerId };
  }

  /** Update and broadcast our local presence (merged with previous). */
  update(state: Partial<Omit<PeerState, 'id'>>, now = Date.now()): void {
    this.local = { ...this.local, ...state, id: this.peerId, lastSeen: now };
    this.broadcast(this.local);
  }

  /** Apply a presence update received from another peer. */
  receive(state: PeerState, now = Date.now()): void {
    if (state.id === this.peerId) return;
    this.peers.set(state.id, { ...state, lastSeen: state.lastSeen ?? now });
    this.prune(now);
    this.onChange?.(this.remotePeers());
  }

  /** Drop peers not seen within the timeout window. */
  prune(now = Date.now()): void {
    let changed = false;
    for (const [id, p] of this.peers) {
      if (now - (p.lastSeen ?? 0) > this.timeout) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) this.onChange?.(this.remotePeers());
  }

  remotePeers(): PeerState[] {
    return [...this.peers.values()];
  }

  /** Remove a peer immediately (e.g. on disconnect). */
  remove(peerId: string): void {
    if (this.peers.delete(peerId)) this.onChange?.(this.remotePeers());
  }
}
