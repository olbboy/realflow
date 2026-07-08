import type { Edge, Node } from '@realflow/react';

/**
 * The "Quy trình xuất đầu tư/ Mua sắm" process from the mockup, laid out
 * left-to-right. Node ids carry the `#n` codes shown on the cards.
 */
export const processNodes: Node[] = [
  { id: 'create', type: 'step', position: { x: 40, y: 40 }, data: { label: 'Tạo công việc quy trình', code: '#1', icon: '🗒️' } },
  { id: 'start', type: 'start', position: { x: 60, y: 190 }, data: { label: 'Bắt đầu', hint: 'Chọn điều kiện bắt đầu' } },

  { id: 'proposal', type: 'step', position: { x: 320, y: 195 }, data: { label: 'Đề xuất đầu tư, mua sắm', code: '#4', icon: '📋' } },

  {
    id: 'approve2',
    type: 'approval',
    position: { x: 600, y: 120 },
    data: { label: '2. Trưởng bộ phận xét duyệt Đề xuất ĐT/ MS', code: '#5', status: 'Chưa thực hiện', duration: '1 day', avatars: 3, attachments: 0, comments: 0 },
  },

  { id: 'auto6', type: 'automation', position: { x: 360, y: 470 }, data: { label: 'Đánh giá và cho ý kiến', code: '#6' } },

  {
    id: 'cond7',
    type: 'condition',
    position: { x: 640, y: 470 },
    data: {
      label: 'Điều kiện',
      code: '#7',
      branches: [
        { id: 'in-plan', label: 'Duyệt - Trong kế hoạch' },
        { id: 'arise', label: 'Duyệt - Phát sinh' },
        { id: 'reject', label: 'Không duyệt' },
      ],
    },
  },

  {
    id: 'approve8',
    type: 'approval',
    position: { x: 1040, y: 60 },
    data: { label: '3.1. P. Tài chính - kế toán xét duyệt Đề xuất ĐT/ MS', code: '#8', status: 'Chưa thực hiện', duration: '2d 8h', avatars: 9, attachments: 0, comments: 0 },
  },
  {
    id: 'approve12',
    type: 'approval',
    position: { x: 1040, y: 440 },
    data: { label: '3.2. P. GĐ & Phòng kế hoạch - cung ứng xét duyệt', code: '#12', status: 'Chưa thực hiện', duration: '3d 2h', avatars: 9, attachments: 0, comments: 0 },
  },

  { id: 'auto9', type: 'automation', position: { x: 1460, y: 90 }, data: { label: 'P. Tài chính và kế toán cho ý kiến', code: '#9' } },
  { id: 'auto13', type: 'automation', position: { x: 1460, y: 470 }, data: { label: 'P. Kế hoạch và cung ứng cho ý kiến', code: '#13' } },

  { id: 'ceo10', type: 'step', position: { x: 1820, y: 300 }, data: { label: 'CEO Phê duyệt đề xuất ĐT/ MS', code: '#10', icon: '⏱️' } },

  { id: 'pause14', type: 'pause', position: { x: 1040, y: 700 }, data: { label: 'Tạm dừng quy trình', code: '#14' } },
];

const arrow = { type: 'arrowclosed' as const };

export const processEdges: Edge[] = [
  { id: 'e-create-start', source: 'create', target: 'start', type: 'smoothstep', markerEnd: arrow },
  { id: 'e-start-proposal', source: 'start', target: 'proposal', type: 'smoothstep', markerEnd: arrow },
  { id: 'e-proposal-approve2', source: 'proposal', target: 'approve2', type: 'smoothstep', markerEnd: arrow },
  { id: 'e-approve2-auto6', source: 'approve2', sourceHandle: 'down', target: 'auto6', type: 'smoothstep', markerEnd: arrow },
  { id: 'e-auto6-cond7', source: 'auto6', target: 'cond7', type: 'smoothstep', markerEnd: arrow },

  { id: 'e-cond-inplan', source: 'cond7', sourceHandle: 'in-plan', target: 'approve8', type: 'smoothstep', label: 'Thành công', markerEnd: arrow },
  { id: 'e-cond-arise', source: 'cond7', sourceHandle: 'arise', target: 'approve12', type: 'smoothstep', label: 'Thành công', markerEnd: arrow },
  { id: 'e-cond-reject', source: 'cond7', sourceHandle: 'reject', target: 'pause14', type: 'smoothstep', label: 'Thành công', markerEnd: arrow },

  { id: 'e-approve8-auto9', source: 'approve8', target: 'auto9', type: 'smoothstep', markerEnd: arrow },
  { id: 'e-approve12-auto13', source: 'approve12', target: 'auto13', type: 'smoothstep', markerEnd: arrow },
  { id: 'e-auto9-ceo', source: 'auto9', target: 'ceo10', type: 'smoothstep', markerEnd: arrow },
  { id: 'e-auto13-ceo', source: 'auto13', target: 'ceo10', type: 'smoothstep', markerEnd: arrow },
];
