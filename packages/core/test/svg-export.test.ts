import { describe, expect, it } from 'vitest';
import { FlowStore, applyOperations, toSvg, type FlowOperation } from '@realflow/core';

/**
 * toSvg is the zero-dependency "download image of the flow" — a pure, headless
 * vector export. These tests pin its correctness and its safety (untrusted
 * labels must not break out into markup).
 */
describe('toSvg — vector export of the graph', () => {
  const build = () => {
    const store = new FlowStore();
    applyOperations(
      store,
      [
        { op: 'add_node', id: 'a', label: 'Alpha', position: { x: 0, y: 0 } },
        { op: 'add_node', id: 'b', label: 'Beta', position: { x: 300, y: 120 } },
        { op: 'connect', source: 'a', target: 'b', label: 'flows' },
      ] as FlowOperation[],
      { autoLayout: false }
    );
    return store;
  };

  it('produces a well-formed standalone SVG with node + edge geometry', () => {
    const svg = toSvg(build());
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    // at least two node rects (plus a background rect)
    expect((svg.match(/<rect /g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('Alpha');
    expect(svg).toContain('Beta');
    expect(svg).toContain('flows'); // edge label
    expect(svg).toMatch(/<path d="M /); // an edge path
  });

  it('has a finite viewBox that encloses every node', () => {
    const svg = toSvg(build());
    const m = svg.match(/viewBox="([^"]+)"/);
    expect(m).toBeTruthy();
    const [x, y, w, h] = m![1].split(' ').map(Number);
    for (const v of [x, y, w, h]) expect(Number.isFinite(v)).toBe(true);
    expect(w).toBeGreaterThan(300); // spans both nodes horizontally
    expect(h).toBeGreaterThan(120);
  });

  it('XML-escapes hostile labels — no markup injection', () => {
    const store = new FlowStore();
    applyOperations(
      store,
      [{ op: 'add_node', id: 'x', label: '<script>alert(1)</script> & "z"', position: { x: 0, y: 0 } }] as FlowOperation[],
      { autoLayout: false }
    );
    const svg = toSvg(store);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&quot;');
  });

  it('returns valid SVG for an empty graph (no NaN / Infinity)', () => {
    const svg = toSvg(new FlowStore());
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it('resolves child positions to absolute coordinates via parentId', () => {
    const store = new FlowStore();
    applyOperations(
      store,
      [
        { op: 'add_node', id: 'g', label: 'Group', position: { x: 1000, y: 1000 } },
        { op: 'add_node', id: 'c', label: 'Child', position: { x: 10, y: 10 }, parentId: 'g' },
      ] as FlowOperation[],
      { autoLayout: false }
    );
    const svg = toSvg(store);
    // child absolute x = 1000 + 10 = 1010, not the relative 10
    expect(svg).toContain('x="1010"');
  });

  it('honors a transparent background option', () => {
    const svg = toSvg(build(), { background: 'transparent' });
    // no full-bleed background rect at the viewBox origin
    expect(svg).not.toMatch(/<rect x="-24" y="-24"/);
  });
});
