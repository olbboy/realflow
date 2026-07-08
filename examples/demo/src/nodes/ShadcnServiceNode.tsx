import { useState } from 'react';
import { Handle, useReflow, type NodeProps } from '@realflow/react';
import { MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

type ServiceData = { label?: string; env?: string; replicas?: number };

// Keep pointer/mouse-down from reaching ReFlow's canvas so interacting with a
// control neither drags the node nor pans the viewport. `rf-nodrag` is
// ReFlow's opt-out class; stopPropagation covers the canvas pan listener.
const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

/**
 * A ReFlow custom node built entirely from real shadcn/ui components
 * (Card + Select + Popover), which are themselves the real
 * @radix-ui/react-select and @radix-ui/react-popover primitives. Proves that
 * Radix portals, positioning and pointer handling coexist with ReFlow's
 * drag/pan/zoom without z-index or pointer-events conflicts.
 */
export function ShadcnServiceNode({ id, data }: NodeProps) {
  const flow = useReflow();
  const d = data as ServiceData;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Card className="w-60 shadow-md">
      <Handle kind="target" side="left" />
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>{d.label}</CardTitle>
          <CardDescription>shadcn/ui · Radix</CardDescription>
        </div>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rf-nodrag -mr-1 -mt-1"
              aria-label="Service actions"
              onPointerDown={stop}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="rf-nodrag" align="end" onPointerDown={stop}>
            <div className="space-y-1">
              <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">Actions</p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  flow.updateNodeData(id, { replicas: (d.replicas ?? 1) + 1 });
                  setMenuOpen(false);
                }}
              >
                Scale up
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  flow.store.setSelection([id]);
                  setMenuOpen(false);
                }}
              >
                Select node
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-start"
                onClick={() => flow.removeNodes([id])}
              >
                Delete
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent>
        <div className="rf-nodrag space-y-1" onPointerDown={stop}>
          <label className="text-xs font-medium text-muted-foreground">Environment</label>
          <Select value={d.env} onValueChange={(env) => flow.updateNodeData(id, { env })}>
            <SelectTrigger aria-label="Environment">
              <SelectValue placeholder="Select environment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="production">production</SelectItem>
              <SelectItem value="staging">staging</SelectItem>
              <SelectItem value="dev">dev</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>replicas</span>
          <span className="font-mono text-foreground">{d.replicas ?? 1}</span>
        </div>
      </CardContent>
      <Handle kind="source" side="right" />
    </Card>
  );
}
