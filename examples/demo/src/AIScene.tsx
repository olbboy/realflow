import { useEffect, useRef, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Panel,
  ReFlow,
  applyOperations,
  type FlowOperation,
  type NodeProps,
  type ReflowApi,
} from '@reflow/react';

/** Node type used by the copilot: label + live execution status. */
function AgentNode({ data }: NodeProps) {
  const d = data as { label?: string; detail?: string; status?: string; statusMessage?: string };
  const status = d.status ?? 'idle';
  return (
    <div className={`agent-node agent-${status}`}>
      <Handle kind="target" side="left" />
      <div className="agent-node-row">
        <span className={`agent-dot agent-dot-${status}`} />
        <span className="agent-node-label">{d.label}</span>
      </div>
      {d.statusMessage ? <div className="agent-node-msg">{d.statusMessage}</div> : null}
      <Handle kind="source" side="right" />
    </div>
  );
}

const agentNodeTypes = { agent: AgentNode };

interface Step {
  say: string;
  ops: FlowOperation[];
  pause?: number;
}

const an = (id: string, label: string): FlowOperation => ({
  op: 'add_node',
  id,
  label,
  type: 'agent',
});
const c = (source: string, target: string, label?: string): FlowOperation => ({
  op: 'connect',
  source,
  target,
  label,
});
const st = (id: string, status: string, message?: string): FlowOperation => ({
  op: 'set_status',
  id,
  status: status as 'running',
  message,
});

const SCRIPT: Step[] = [
  {
    say: 'Scaffolding a RAG ingestion pipeline…',
    ops: [
      an('docs', 'Document source'),
      an('chunk', 'Chunker'),
      an('embed', 'Embedder'),
      an('vdb', 'Vector store'),
      c('docs', 'chunk'),
      c('chunk', 'embed'),
      c('embed', 'vdb', 'vectors'),
    ],
  },
  {
    say: 'Adding the query path with a reranker…',
    ops: [
      an('query', 'User query'),
      an('retrieve', 'Retriever'),
      an('rerank', 'Reranker'),
      an('llm', 'LLM'),
      an('answer', 'Answer'),
      c('query', 'retrieve'),
      c('vdb', 'retrieve', 'top-k'),
      c('retrieve', 'rerank'),
      c('rerank', 'llm', 'context'),
      c('query', 'llm'),
      c('llm', 'answer'),
      { op: 'layout', type: 'layered', direction: 'LR' },
    ],
  },
  {
    say: 'Running ingestion…',
    ops: [st('docs', 'running', 'reading 128 files')],
    pause: 900,
  },
  { say: '', ops: [st('docs', 'ok'), st('chunk', 'running', '512-token windows')], pause: 900 },
  {
    say: 'One PDF failed to parse — flagging it.',
    ops: [st('chunk', 'error', '1 file unreadable'), { op: 'focus_node', id: 'chunk' }],
    pause: 1300,
  },
  {
    say: 'Skipping the bad file and continuing…',
    ops: [st('chunk', 'ok'), st('embed', 'running', 'batch 4/12')],
    pause: 1000,
  },
  { say: '', ops: [st('embed', 'ok'), st('vdb', 'running', 'upserting…')], pause: 800 },
  {
    say: 'Pipeline healthy. Answering a test query…',
    ops: [st('vdb', 'ok'), { op: 'fit_view' }, st('query', 'running')],
    pause: 700,
  },
  { say: '', ops: [st('query', 'ok'), st('retrieve', 'running', 'k=20')], pause: 700 },
  { say: '', ops: [st('retrieve', 'ok'), st('rerank', 'running', '20 → 5')], pause: 700 },
  { say: '', ops: [st('rerank', 'ok'), st('llm', 'running', 'streaming tokens…')], pause: 1100 },
  {
    say: 'Done — every step above was a JSON operation, undoable with ⌘Z.',
    ops: [st('llm', 'ok'), st('answer', 'ok', 'grounded answer ✓'), { op: 'fit_view' }],
  },
];

export function AIScene({ dark }: { dark: boolean }) {
  const apiRef = useRef<ReflowApi | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = (): void => {
    const api = apiRef.current;
    if (!api) return;
    if (timer.current) clearTimeout(timer.current);
    applyOperations(api.store, [{ op: 'clear' }]);
    api.store.clearHistory();
    setMessages([]);
    setRunning(true);
    let i = 0;
    const step = (): void => {
      if (i >= SCRIPT.length) {
        setRunning(false);
        return;
      }
      const s = SCRIPT[i++];
      if (s.say) setMessages((m) => [...m, s.say]);
      applyOperations(api.store, s.ops, { duration: 350 });
      timer.current = setTimeout(step, s.pause ?? 1100);
    };
    step();
  };

  useEffect(() => {
    const t = setTimeout(play, 400);
    return () => {
      clearTimeout(t);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ReFlow
      nodeTypes={agentNodeTypes}
      colorMode={dark ? 'dark' : 'light'}
      defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: 'arrowclosed' } }}
      fitViewOnInit={false}
      onInit={(api) => {
        apiRef.current = api;
      }}
    >
      <Background variant="dots" />
      <Controls />
      <MiniMap />
      <Panel position="top-left" className="agent-chat">
        <div className="agent-chat-head">
          <span className="agent-chat-title">🤖 Copilot</span>
          <button className="agent-chat-replay" onClick={play} disabled={running}>
            {running ? 'streaming…' : '↻ replay'}
          </button>
        </div>
        {messages.map((m, i) => (
          <div key={i} className="agent-chat-msg">
            {m}
          </div>
        ))}
      </Panel>
      <Panel position="bottom-center" className="demo-hint">
        an agent is driving this canvas with JSON operations — applyOperations(store, ops)
      </Panel>
    </ReFlow>
  );
}
