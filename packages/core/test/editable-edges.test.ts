import { describe, expect, it } from 'vitest';
import { FlowStore, splinePath, edgePath, type XY } from '@realflow/core';

describe('editable edges — spline geometry', () => {
  it('splinePath passes through every point and labels the middle', () => {
    const pts: XY[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 0 },
    ];
    const path = splinePath(pts);
    expect(path.d.startsWith('M 0,0')).toBe(true);
    expect(path.d).toContain('100,100'); // curve reaches the control point
    expect(path.d).toContain('200,0'); // ...and the endpoint
    expect(path.label).toEqual({ x: 100, y: 100 });
  });

  it('edgePath routes through control points as a spline, differing from the plain edge', () => {
    const spec = { source: { x: 0, y: 0 }, sourceSide: 'right', target: { x: 200, y: 0 }, targetSide: 'left' } as const;
    const plain = edgePath('bezier', spec);
    const bent = edgePath('bezier', { ...spec, waypoints: [{ x: 100, y: 100 }] });
    expect(bent.d).not.toEqual(plain.d);
    expect(bent.d).toContain('100,100');
  });

  it('a two-point spline is a straight segment', () => {
    expect(splinePath([{ x: 0, y: 0 }, { x: 50, y: 50 }]).d).toBe('M 0,0 L 50,50');
  });
});

describe('editable edges — store control points', () => {
  const setup = () => {
    const store = new FlowStore();
    store.addNodes([
      { id: 'a', position: { x: 0, y: 0 }, width: 100, height: 40, data: {} },
      { id: 'b', position: { x: 400, y: 0 }, width: 100, height: 40, data: {} },
    ]);
    store.addEdge({ id: 'e', source: 'a', target: 'b' });
    return store;
  };

  it('setEdgeControlPointsLive updates the edge without adding a history entry', () => {
    const store = setup();
    store.setEdgeControlPointsLive('e', [{ x: 200, y: 120 }]);
    expect(store.getEdge('e')!.controlPoints).toEqual([{ x: 200, y: 120 }]);
    // The next undo pops the edge-add — proving the live set recorded nothing.
    store.undo();
    expect(store.getEdge('e')).toBeUndefined();
  });

  it('updateEdge records control points as a single reversible change', () => {
    const store = setup();
    store.updateEdge('e', { controlPoints: [{ x: 200, y: 120 }] });
    expect(store.getEdge('e')!.controlPoints).toEqual([{ x: 200, y: 120 }]);
    store.undo();
    expect(store.getEdge('e')!.controlPoints).toBeUndefined();
    expect(store.getEdge('e')).toBeDefined(); // edge itself survives
  });
});
