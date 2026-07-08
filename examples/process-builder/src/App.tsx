import { useRef, useState } from 'react';
import {
  Background,
  Panel,
  RealFlow,
  uid,
  type FlowSnapshot,
  type RealFlowApi,
} from '@realflow/react';
import { paletteItems, processNodeTypes } from './nodes';
import { processEdges, processNodes } from './data';

const DRAG_MIME = 'application/realflow-node';

/** Left-rail tool categories (decorative grouping, as in the mockup). */
const categories = [
  { id: 'auto', label: 'Tự động', icon: '⚡' },
  { id: 'approve', label: 'Duyệt', icon: '✔️' },
  { id: 'warn', label: 'Cảnh báo', icon: '⚠️' },
  { id: 'custom', label: 'Tùy chỉnh', icon: '✦' },
];

export default function App() {
  const apiRef = useRef<RealFlowApi | null>(null);
  const initialSnapshot = useRef<FlowSnapshot | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [activeCat, setActiveCat] = useState('auto');
  const [saved, setSaved] = useState<string | null>(null);

  const onInit = (api: RealFlowApi): void => {
    apiRef.current = api;
    initialSnapshot.current = api.toSnapshot();
    const syncHistory = (): void => {
      setCanUndo(api.store.canUndo);
      setCanRedo(api.store.canRedo);
    };
    const syncZoom = (): void => setZoom(api.store.viewport.zoom);
    syncHistory();
    syncZoom();
    api.store.subscribe('history', syncHistory);
    api.store.subscribe('viewport', syncZoom);
  };

  /** Add a node at the current viewport center (the "Thêm node" button). */
  const addCenterNode = (): void => {
    const api = apiRef.current;
    if (!api) return;
    const c = api.screenToFlow({ x: api.store.screen.width / 2, y: api.store.screen.height / 2 });
    api.addNode({
      id: uid('node'),
      type: 'approval',
      position: { x: c.x - 130, y: c.y - 50 },
      data: { label: 'Bước duyệt mới', status: 'Chưa thực hiện', duration: '1 day', avatars: 1 },
    });
  };

  /* palette drag-and-drop → drop onto canvas creates a node there */
  const onPaletteDragStart = (e: React.DragEvent, item: (typeof paletteItems)[number]): void => {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ type: item.type, data: item.data }));
    e.dataTransfer.effectAllowed = 'copy';
  };
  const onCanvasDragOver = (e: React.DragEvent): void => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onCanvasDrop = (e: React.DragEvent): void => {
    const api = apiRef.current;
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!api || !raw) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const p = api.screenToFlow({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const { type, data } = JSON.parse(raw) as { type: string; data: Record<string, unknown> };
    api.addNode({ id: uid('node'), type, position: { x: p.x - 110, y: p.y - 40 }, data });
  };

  const undo = (): void => apiRef.current?.undo();
  const redo = (): void => apiRef.current?.redo();

  const apply = (label: string): void => {
    const api = apiRef.current;
    if (!api) return;
    const snap = api.toSnapshot();
    localStorage.setItem('realflow-process', JSON.stringify(snap));
    setSaved(`${label} · ${snap.nodes.length} node`);
    console.log('[process-builder] snapshot', snap);
    window.setTimeout(() => setSaved(null), 2200);
  };
  const discard = (): void => {
    const api = apiRef.current;
    if (api && initialSnapshot.current) api.loadSnapshot(initialSnapshot.current);
  };

  return (
    <div className="pb-app">
      {/* ── top bar ─────────────────────────────────────────────── */}
      <header className="pb-topbar">
        <div className="pb-topbar-left">
          <span className="pb-app-logo">＋</span>
          <span className="pb-app-title">Quy trình xuất đầu tư/ Mua sắm</span>
        </div>
        <div className="pb-topbar-tools">
          <button className="pb-add-node" onClick={addCenterNode}>＋ Thêm node</button>
          <button className="pb-icon-btn" onClick={undo} disabled={!canUndo} title="Hoàn tác">↶</button>
          <button className="pb-icon-btn" onClick={redo} disabled={!canRedo} title="Làm lại">↷</button>
        </div>
        <div className="pb-topbar-right">
          {saved ? <span className="pb-saved">✓ {saved}</span> : null}
          <button className="pb-btn pb-btn-ghost" onClick={discard}>Hủy bỏ</button>
          <button className="pb-btn pb-btn-ghost" onClick={() => apply('Đã lưu nháp')}>Lưu nháp</button>
          <button className="pb-btn pb-btn-primary" onClick={() => apply('Đã áp dụng')}>Áp dụng</button>
        </div>
      </header>

      <div className="pb-body">
        {/* ── left rail ─────────────────────────────────────────── */}
        <aside className="pb-rail">
          <div className="pb-rail-cats">
            {categories.map((c) => (
              <button
                key={c.id}
                className={`pb-cat${activeCat === c.id ? ' active' : ''}`}
                onClick={() => setActiveCat(c.id)}
              >
                <span className="pb-cat-icon">{c.icon}</span>
                <span className="pb-cat-label">{c.label}</span>
              </button>
            ))}
          </div>
          <div className="pb-palette">
            <div className="pb-palette-title">Kéo vào canvas</div>
            {paletteItems.map((item) => (
              <div
                key={item.type}
                className="pb-palette-item"
                draggable
                onDragStart={(e) => onPaletteDragStart(e, item)}
                title={`Kéo "${item.label}" vào canvas`}
              >
                <span className="pb-palette-icon">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
          <div className="pb-rail-foot">✦ 1AI Assistant</div>
        </aside>

        {/* ── canvas ────────────────────────────────────────────── */}
        <main className="pb-canvas" onDragOver={onCanvasDragOver} onDrop={onCanvasDrop}>
          <RealFlow
            defaultNodes={processNodes}
            defaultEdges={processEdges}
            nodeTypes={processNodeTypes}
            colorMode="light"
            defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: 'arrowclosed' } }}
            fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
            onInit={onInit}
          >
            <Background variant="dots" />

            <Panel position="bottom-center" className="pb-viewbar">
              <button className="pb-view-btn" title="Chọn" onClick={() => apiRef.current?.fitView({ duration: 300 })}>▭</button>
              <button className="pb-view-btn" title="Sắp xếp tự động" onClick={() => apiRef.current?.layout('layered', { direction: 'LR', duration: 350 })}>⤴</button>
              <span className="pb-view-sep" />
              <button className="pb-view-btn" title="Thu nhỏ" onClick={() => apiRef.current?.zoomOut()}>－</button>
              <span className="pb-zoom">{Math.round(zoom * 100)}%</span>
              <button className="pb-view-btn" title="Phóng to" onClick={() => apiRef.current?.zoomIn()}>＋</button>
            </Panel>

            <Panel position="bottom-left" className="pb-hint">
              Kéo từ handle để nối · kéo node từ thanh trái vào canvas · ⌘Z hoàn tác · cuộn để zoom
            </Panel>
          </RealFlow>
        </main>
      </div>
    </div>
  );
}
