import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GATE_INPUTS, type GateType, type Logic } from "@/lib/engine";
import { cn } from "@/lib/utils";

export interface GateData { type: GateType; label: string; sig: Logic; faulty?: boolean; onToggle?: () => void; [k: string]: unknown }

const sigClass = (v: Logic, faulty?: boolean) => (faulty ? "text-destructive" : v === 1 ? "text-sig-high" : v === 0 ? "text-sig-low" : "text-sig-x");

function Symbol({ t }: { t: GateType }) {
  const bubble = ["NOT", "NAND", "NOR", "XNOR"].includes(t);
  const base = t.replace(/^N(?=AND|OR)/, "").replace("XNOR", "XOR");
  let d = "M8 6 H30 A18 18 0 0 1 30 42 H8 Z"; // AND
  if (base === "OR" || base === "XOR") d = "M8 6 Q40 6 56 24 Q40 42 8 42 Q20 24 8 6 Z";
  if (t === "NOT" || t === "BUFFER") d = "M10 6 L50 24 L10 42 Z";
  return (
    <svg viewBox="0 0 70 48" className="h-10 w-16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={d} />
      {base === "XOR" && <path d="M2 6 Q14 24 2 42" />}
      {bubble && <circle cx={(t === "NOT" ? 50 : base === "AND" ? 48 : 56) + 4} cy="24" r="4" />}
    </svg>
  );
}

export function GateNode({ data, selected }: NodeProps) {
  const d = data as GateData;
  const n = GATE_INPUTS[d.type];
  const isGate = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER"].includes(d.type);
  const hasOut = d.type !== "OUTPUT";
  return (
    <div className={cn("relative rounded-md border bg-card px-2 py-1 text-center shadow-sm", selected ? "border-primary" : d.faulty ? "border-destructive" : "border-border", sigClass(d.sig, d.faulty))}>
      {Array.from({ length: n }, (_, i) => (
        <Handle key={i} id={`in${i}`} type="target" position={Position.Left} style={{ top: `${((i + 1) / (n + 1)) * 100}%` }} />
      ))}
      {isGate ? <Symbol t={d.type} /> : (
        <div className="min-w-14 py-1">
          {d.type === "INPUT" ? (
            <button onClick={d.onToggle} className="nodrag rounded border border-current px-2 font-mono text-sm font-bold">{d.sig ?? "X"}</button>
          ) : (
            <div className="font-mono text-sm font-bold">{["DFF", "TFF"].includes(d.type) ? d.type.replace("FF", "-FF") : d.type === "OUTPUT" ? (d.sig ?? "X") : d.type === "CLOCK" ? "⎍ CLK" : d.type === "CONST1" ? "1" : "0"}</div>
          )}
        </div>
      )}
      <div className="font-mono text-[10px] text-muted-foreground">{d.label}{d.faulty && <span className="ml-1 text-destructive">⚡</span>}</div>
      {hasOut && <Handle id="out" type="source" position={Position.Right} />}
    </div>
  );
}
