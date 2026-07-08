import { describe, expect, it } from 'vitest';
import { FlowStore, splinePath, type XY } from '@realflow/core';

describe('shapes + freehand — store', () => {
  it('createShape adds a sized shape node and selects it', () => {
    const store = new FlowStore();
    const id = store.createShape('ellipse', { x: 10, y: 20, width: 100, height: 60 });
    const n = store.getNode(id)!;
    expect(n.type).toBe('shape');
    expect((n.data as { shape?: string }).shape).toBe('ellipse');
    expect(n.position).toEqual({ x: 10, y: 20 });
    expect(n.width).toBe(100);
    expect(n.height).toBe(60);
    expect([...store.selectedNodes]).toEqual([id]);
  });

  it('createShape clamps tiny rects to a minimum size', () => {
    const store = new FlowStore();
    const n = store.getNode(store.createShape('rectangle', { x: 0, y: 0, width: 2, height: 1 }))!;
    expect(n.width).toBeGreaterThanOrEqual(8);
    expect(n.height).toBeGreaterThanOrEqual(8);
  });

  it('createFreehand sizes to the stroke bbox and stores relative points', () => {
    const store = new FlowStore();
    const pts: XY[] = [
      { x: 100, y: 100 },
      { x: 150, y: 120 },
      { x: 200, y: 100 },
    ];
    const n = store.getNode(store.createFreehand(pts))!;
    expect(n.type).toBe('freehand');
    // bbox (100,100)-(200,120), pad 4 → origin (96,96), size 108×28
    expect(n.position).toEqual({ x: 96, y: 96 });
    expect(n.width).toBe(108);
    expect(n.height).toBe(28);
    const rel = (n.data as { points?: XY[] }).points!;
    expect(rel[0]).toEqual({ x: 4, y: 4 });
    expect(rel[2]).toEqual({ x: 104, y: 4 });
  });

  it('createShape and createFreehand are each a single undo', () => {
    const store = new FlowStore();
    const s = store.createShape('diamond', { x: 0, y: 0, width: 50, height: 50 });
    store.undo();
    expect(store.getNode(s)).toBeUndefined();
    const f = store.createFreehand([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
    store.undo();
    expect(store.getNode(f)).toBeUndefined();
  });

  it('setTool switches the active tool and emits once', () => {
    const store = new FlowStore();
    let fired = 0;
    store.subscribe('tool', () => fired++);
    expect(store.tool).toBe('select');
    store.setTool('freehand');
    expect(store.tool).toBe('freehand');
    store.setTool('freehand'); // no-op, no extra emit
    expect(fired).toBe(1);
  });

  it('splinePath renders a smooth stroke through the freehand points', () => {
    const d = splinePath([{ x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 0 }]).d;
    expect(d.startsWith('M 0,0')).toBe(true);
    expect(d).toContain('5,10');
  });
});
