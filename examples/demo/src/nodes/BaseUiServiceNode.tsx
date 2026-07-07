import { useState } from 'react';
import { Handle, useReflow, type NodeProps } from '@reflow/react';
import { Select } from '@base-ui-components/react/select';
import { Popover } from '@base-ui-components/react/popover';
import { Check, ChevronDown, MoreHorizontal } from 'lucide-react';

type ServiceData = { label?: string; env?: string; replicas?: number };

const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

const envItems = [
  { label: 'production', value: 'production' },
  { label: 'staging', value: 'staging' },
  { label: 'dev', value: 'dev' },
];

/**
 * A ReFlow custom node built from real Base UI (@base-ui-components/react)
 * Select + Popover primitives. Base UI is unstyled/headless, so every visual
 * comes from the host's own classes — exactly the "no imposed styles" contract
 * ReFlow promises. Portals + positioning coexist with drag/pan/zoom.
 */
export function BaseUiServiceNode({ id, data }: NodeProps) {
  const flow = useReflow();
  const d = data as ServiceData;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="w-60 rounded-lg border border-border bg-card text-card-foreground shadow-md">
      <Handle kind="target" side="left" />
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold leading-none">{d.label}</div>
          <div className="text-xs text-muted-foreground">Base UI · headless</div>
        </div>
        <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Popover.Trigger
            className="rf-nodrag -mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
            aria-label="Service actions"
            onPointerDown={stop}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={6} className="z-50">
              <Popover.Popup
                className="rf-nodrag w-48 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md outline-none"
                onPointerDown={stop}
              >
                <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">Actions</p>
                <button
                  className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
                  onClick={() => {
                    flow.updateNodeData(id, { replicas: (d.replicas ?? 1) + 1 });
                    setMenuOpen(false);
                  }}
                >
                  Scale up
                </button>
                <button
                  className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
                  onClick={() => {
                    flow.store.setSelection([id]);
                    setMenuOpen(false);
                  }}
                >
                  Select node
                </button>
                <button
                  className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs text-destructive hover:bg-accent"
                  onClick={() => flow.removeNodes([id])}
                >
                  Delete
                </button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <div className="space-y-3 p-4 pt-0">
        <div className="rf-nodrag space-y-1" onPointerDown={stop}>
          <label className="text-xs font-medium text-muted-foreground">Environment</label>
          <Select.Root
            items={envItems}
            value={d.env ?? 'production'}
            onValueChange={(env: string) => flow.updateNodeData(id, { env })}
          >
            <Select.Trigger
              className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring"
              aria-label="Environment"
            >
              <Select.Value />
              <Select.Icon>
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner sideOffset={4} className="z-50">
                <Select.Popup className="max-h-64 min-w-[8rem] overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
                  {envItems.map((item) => (
                    <Select.Item
                      key={item.value}
                      value={item.value}
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                    >
                      <Select.ItemIndicator>
                        <Check className="h-3.5 w-3.5" />
                      </Select.ItemIndicator>
                      <Select.ItemText>{item.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>replicas</span>
          <span className="font-mono text-foreground">{d.replicas ?? 1}</span>
        </div>
      </div>
      <Handle kind="source" side="right" />
    </div>
  );
}
