import { Handle, useRealFlow, type NodeProps } from '@realflow/react';

/* ── shared bits ───────────────────────────────────────────────────── */

/** Small `#n` id chip shown on most nodes (mirrors the mockup). */
function Code({ n }: { n?: string }) {
  return n ? <span className="pb-code">{n}</span> : null;
}

/** Overlapping avatar stack + "+N" more, as on the approval cards. */
function Avatars({ count }: { count?: number }) {
  if (!count) return null;
  const shown = Math.min(count, 3);
  return (
    <div className="pb-avatars">
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i} className={`pb-avatar pb-avatar-${i}`} aria-hidden />
      ))}
      {count > shown ? <span className="pb-avatar-more">+{count - shown}</span> : null}
    </div>
  );
}

/* ── node types ────────────────────────────────────────────────────── */

/** Round red "play" start node. */
export function StartNode({ data }: NodeProps) {
  const d = data as { label?: string; hint?: string };
  return (
    <div className="pb-start">
      <div className="pb-start-pill">
        <span className="pb-start-play">▶</span>
        <span>{d.label ?? 'Bắt đầu'}</span>
        <Handle kind="source" side="right" dataType="flow" />
      </div>
      {d.hint ? <div className="pb-start-hint">＋ {d.hint}</div> : null}
    </div>
  );
}

/** Compact step card (create task / proposal). */
export function ProcessStepNode({ data }: NodeProps) {
  const d = data as { label?: string; code?: string; icon?: string };
  return (
    <div className="pb-step">
      <Handle kind="target" side="left" dataType="flow" />
      <span className="pb-step-icon">{d.icon ?? '🗒️'}</span>
      <div className="pb-step-body">
        <div className="pb-step-title">{d.label}</div>
        <Code n={d.code} />
      </div>
      <Handle kind="source" side="right" dataType="flow" />
    </div>
  );
}

/** Big teal approval/task card. */
export function ApprovalNode({ data }: NodeProps) {
  const d = data as {
    label?: string;
    code?: string;
    status?: string;
    duration?: string;
    avatars?: number;
    attachments?: number;
    comments?: number;
  };
  return (
    <div className="pb-approval">
      <Handle kind="target" side="left" dataType="flow" />
      <div className="pb-approval-head">
        <span className="pb-approval-title">{d.label}</span>
        <Code n={d.code} />
      </div>
      <div className="pb-approval-meta">
        <Avatars count={d.avatars} />
        <span className="pb-status">
          <span className="pb-status-dot" /> {d.status ?? 'Chưa thực hiện'}
        </span>
      </div>
      <div className="pb-approval-foot">
        <span>📎 {d.attachments ?? 0}</span>
        <span>·</span>
        <span>💬 {d.comments ?? 0}</span>
        {d.duration ? <span className="pb-duration">⏱ {d.duration}</span> : null}
      </div>
      <Handle kind="source" side="right" dataType="flow" />
      <Handle kind="source" side="bottom" id="down" dataType="flow" />
    </div>
  );
}

/** Yellow automation node (lightning). */
export function AutomationNode({ data }: NodeProps) {
  const d = data as { label?: string; code?: string };
  return (
    <div className="pb-automation">
      <Handle kind="target" side="left" dataType="flow" />
      <span className="pb-automation-icon">⚡</span>
      <div className="pb-step-body">
        <div className="pb-step-title">{d.label}</div>
        <Code n={d.code} />
      </div>
      <Handle kind="source" side="right" dataType="flow" />
    </div>
  );
}

type Branch = { id: string; label: string };

/** Condition node with one source handle per branch row (+ add / remove). */
export function ConditionNode({ id, data }: NodeProps) {
  const api = useRealFlow();
  const d = data as { label?: string; code?: string; branches?: Branch[] };
  const branches = d.branches ?? [];

  const addBranch = (): void => {
    const next = [...branches, { id: `b${branches.length + 1}-${Math.round(performance.now())}`, label: 'Nhánh mới' }];
    api.updateNodeData(id, { branches: next });
  };
  const removeBranch = (bid: string): void => {
    api.updateNodeData(id, { branches: branches.filter((b) => b.id !== bid) });
    api.removeEdges(api.getEdges().filter((e) => e.source === id && e.sourceHandle === bid).map((e) => e.id));
  };

  return (
    <div className="pb-condition">
      <Handle kind="target" side="left" dataType="flow" />
      <div className="pb-condition-head">
        <span className="pb-condition-icon">⤪</span>
        <span className="pb-condition-title">{d.label ?? 'Điều kiện'}</span>
        <Code n={d.code} />
      </div>
      <div className="pb-branches">
        {branches.map((b) => (
          <div className="pb-branch-row" key={b.id}>
            <span className="pb-branch-label">{b.label}</span>
            <button
              className="pb-branch-x"
              title="Xoá nhánh"
              // Stop pointerdown from reaching the pane, which would otherwise
              // capture the pointer and swallow the button's click.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                removeBranch(b.id);
              }}
            >
              ×
            </button>
            <Handle kind="source" side="right" id={b.id} dataType="flow" className="pb-branch-handle" />
          </div>
        ))}
        <button
          className="pb-branch-add"
          title="Thêm nhánh"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); addBranch(); }}
        >
          ＋
        </button>
      </div>
    </div>
  );
}

/** Red-bordered "pause process" node. */
export function PauseNode({ data }: NodeProps) {
  const d = data as { label?: string; code?: string };
  return (
    <div className="pb-pause">
      <Handle kind="target" side="left" dataType="flow" />
      <span className="pb-pause-icon">⏸</span>
      <div className="pb-step-body">
        <div className="pb-step-title">{d.label}</div>
        <Code n={d.code} />
      </div>
    </div>
  );
}

export const processNodeTypes = {
  start: StartNode,
  step: ProcessStepNode,
  approval: ApprovalNode,
  automation: AutomationNode,
  condition: ConditionNode,
  pause: PauseNode,
};

/** Palette entries: the "Thêm node" categories shown in the left rail. */
export const paletteItems: { type: keyof typeof processNodeTypes; label: string; icon: string; data: Record<string, unknown> }[] = [
  { type: 'approval', label: 'Bước duyệt', icon: '✔️', data: { label: 'Bước duyệt mới', status: 'Chưa thực hiện', duration: '1 day', avatars: 1 } },
  { type: 'automation', label: 'Tự động', icon: '⚡', data: { label: 'Hành động tự động' } },
  { type: 'condition', label: 'Điều kiện', icon: '⤪', data: { label: 'Điều kiện', branches: [{ id: 'b1', label: 'Nhánh 1' }, { id: 'b2', label: 'Nhánh 2' }] } },
  { type: 'step', label: 'Công việc', icon: '🗒️', data: { label: 'Công việc mới' } },
  { type: 'pause', label: 'Tạm dừng', icon: '⏸', data: { label: 'Tạm dừng quy trình' } },
];
