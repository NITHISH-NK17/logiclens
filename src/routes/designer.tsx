import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider, useReactFlow, applyNodeChanges, applyEdgeChanges, type Connection, type Edge, type Node, type NodeChange, type EdgeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Copy, Redo2, Save, Trash2, Undo2 } from "lucide-react";
import { analyze, evaluate, type Circuit, type CNode, type GateType, type Logic } from "@/lib/engine";
import { newId, useActive, useStore } from "@/lib/store";
import { GateNode } from "@/components/GateNode";
import { NoProject } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/designer")({ head: () => meta("Circuit Designer", "Drag-and-drop digital logic design with live simulation."), component: () => <ReactFlowProvider><Designer /></ReactFlowProvider> });

const LIB: { group: string; items: GateType[] }[] = [
  { group: "I/O", items: ["INPUT", "OUTPUT", "CONST0", "CONST1", "CLOCK"] },
  { group: "Logic gates", items: ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER"] },
  { group: "Sequential", items: ["DFF", "TFF"] },
];
const nodeTypes = { gate: GateNode };
const prefix: Record<string, string> = { INPUT: "IN", OUTPUT: "OUT", CLOCK: "CLK", DFF: "FF", TFF: "FF", CONST0: "GND", CONST1: "VCC" };

function Designer() {
  const project = useActive();
  const setCircuit = useStore((s) => s.setCircuit);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!project) return <NoProject />;
  if (!mounted) return null;
  return <Editor key={project.id} initial={project.circuit} faults={project.faults.map((f) => f.nodeId)} onSave={setCircuit} />;
}

function Editor({ initial, onSave, faults }: { initial: Circuit; onSave: (c: Circuit) => void; faults: string[] }) {
  const [c, setC] = useState<Circuit>(initial);
  const hist = useRef<Circuit[]>([]); const fut = useRef<Circuit[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const rf = useReactFlow();
  const measured = useRef<Record<string, { width?: number; height?: number }>>({});
  const [, force] = useState(0);

  const commit = useCallback((next: Circuit) => { hist.current.push(c); fut.current = []; setC(next); onSave(next); }, [c, onSave]);
  const an = useMemo(() => analyze(c), [c]);
  const sig = useMemo(() => evaluate(c, {}, [], {}, an), [c, an]);

  const toggle = (id: string) => commit({ ...c, nodes: c.nodes.map((n) => (n.id === id ? { ...n, value: n.value ? 0 : 1 } : n)) });
  const nodes: Node[] = c.nodes.map((n) => ({ id: n.id, type: "gate", position: { x: n.x, y: n.y }, selected: n.id === sel, measured: measured.current[n.id], data: { type: n.type, label: n.label, sig: sig[n.id], faulty: faults.includes(n.id), onToggle: () => toggle(n.id) } }));
  const color = (v: Logic) => (v === 1 ? "var(--sig-high)" : v === 0 ? "var(--sig-low)" : "var(--sig-x)");
  const edges: Edge[] = c.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, targetHandle: e.targetHandle, sourceHandle: "out", style: { stroke: faults.includes(e.source) ? "var(--destructive)" : color(sig[e.source]), strokeWidth: 2 } }));

  const onNodesChange = (ch: NodeChange[]) => {
    const dims = ch.filter((x) => x.type === "dimensions");
    if (dims.length) { dims.forEach((d) => { if (d.type === "dimensions" && d.dimensions) measured.current[d.id] = d.dimensions; }); force((x) => x + 1); }
    if (dims.length === ch.length) return;
    const moved = applyNodeChanges(ch, nodes);
    const removed = ch.filter((x) => x.type === "remove").map((x) => (x as { id: string }).id);
    const sl = ch.find((x) => x.type === "select" && x.selected) as { id: string } | undefined;
    if (sl) setSel(sl.id);
    const next: Circuit = {
      nodes: c.nodes.filter((n) => !removed.includes(n.id)).map((n) => { const m = moved.find((x) => x.id === n.id); return m ? { ...n, x: Math.round(m.position.x), y: Math.round(m.position.y) } : n; }),
      edges: c.edges.filter((e) => !removed.includes(e.source) && !removed.includes(e.target)),
    };
    const dragEnd = ch.some((x) => x.type === "position" && !x.dragging) || removed.length;
    if (dragEnd) commit(next); else setC(next);
  };
  const onEdgesChange = (ch: EdgeChange[]) => { const kept = applyEdgeChanges(ch, edges).map((e) => e.id); if (ch.some((x) => x.type === "remove")) commit({ ...c, edges: c.edges.filter((e) => kept.includes(e.id)) }); };
  const onConnect = (cn: Connection) => {
    if (!cn.source || !cn.target || !cn.targetHandle) return;
    if (cn.source === cn.target) { setLogs((l) => [...l, "✗ Cannot connect a component to itself"]); return; }
    const edgesNext = c.edges.filter((e) => !(e.target === cn.target && e.targetHandle === cn.targetHandle));
    commit({ ...c, edges: [...edgesNext, { id: newId(), source: cn.source, target: cn.target, targetHandle: cn.targetHandle }] });
  };
  const add = (t: GateType, pos?: { x: number; y: number }) => {
    const count = c.nodes.filter((n) => n.type === t).length + 1;
    const label = (prefix[t] ?? "U") + (t === "INPUT" ? String.fromCharCode(64 + count) : count);
    const p = pos ?? { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
    commit({ ...c, nodes: [...c.nodes, { id: newId(), type: t, label, x: p.x, y: p.y, value: t === "INPUT" ? 0 : undefined }] });
  };
  const undo = () => { const p = hist.current.pop(); if (p) { fut.current.push(c); setC(p); onSave(p); } };
  const redo = () => { const n = fut.current.pop(); if (n) { hist.current.push(c); setC(n); onSave(n); } };
  const selNode = c.nodes.find((n) => n.id === sel);
  const patchSel = (p: Partial<CNode>) => selNode && commit({ ...c, nodes: c.nodes.map((n) => (n.id === sel ? { ...n, ...p } : n)) });
  const dup = () => selNode && commit({ ...c, nodes: [...c.nodes, { ...selNode, id: newId(), label: selNode.label + "'", x: selNode.x + 40, y: selNode.y + 40 }] });
  const del = () => { if (selNode) { commit({ nodes: c.nodes.filter((n) => n.id !== sel), edges: c.edges.filter((e) => e.source !== sel && e.target !== sel) }); setSel(null); } };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); dup(); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="grid h-full grid-cols-[180px_1fr_220px] grid-rows-[1fr_150px]">
      <aside className="row-span-2 overflow-auto border-r border-border p-2">
        {LIB.map((g) => (
          <div key={g.group} className="mb-3">
            <div className="panel-title mb-1 px-1">{g.group}</div>
            <div className="grid grid-cols-2 gap-1">
              {g.items.map((t) => (
                <button key={t} draggable onDragStart={(e) => e.dataTransfer.setData("gate", t)} onClick={() => add(t)}
                  className="rounded border border-border bg-card px-1 py-1.5 font-mono text-[10px] hover:border-primary hover:text-primary">{t}</button>
              ))}
            </div>
          </div>
        ))}
        <p className="px-1 text-[10px] text-muted-foreground">Drag or click to add. Click INPUT values to toggle. Del removes, Ctrl+Z/Y undo/redo, Ctrl+D duplicate.</p>
      </aside>
      <div className="relative" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const t = e.dataTransfer.getData("gate") as GateType; if (t) add(t, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })); }}>
        <div className="absolute left-2 top-2 z-10 flex gap-1">
          <Button size="sm" variant="secondary" onClick={undo} title="Undo"><Undo2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="secondary" onClick={redo} title="Redo"><Redo2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="secondary" onClick={() => rf.fitView()}>Fit</Button>
          <Button size="sm" onClick={() => { onSave(c); setLogs((l) => [...l, `✓ Saved at ${new Date().toLocaleTimeString()}`]); }}><Save className="h-3.5 w-3.5" />Save</Button>
        </div>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onPaneClick={() => setSel(null)} fitView colorMode="dark" deleteKeyCode={["Delete", "Backspace"]}>
          <Background gap={16} color="var(--border)" /><Controls /><MiniMap pannable zoomable bgColor="var(--card)" maskColor="transparent" />
        </ReactFlow>
      </div>
      <aside className="row-span-2 overflow-auto border-l border-border p-3">
        <div className="panel-title mb-2">Properties</div>
        {selNode ? (
          <div className="space-y-2 text-xs">
            <div><span className="text-muted-foreground">Type</span> <span className="font-mono">{selNode.type}</span></div>
            <div><span className="text-muted-foreground">ID</span> <span className="font-mono">{selNode.id}</span></div>
            <label className="block"><span className="text-muted-foreground">Signal name</span><Input key={selNode.id} defaultValue={selNode.label} onBlur={(e) => patchSel({ label: e.target.value })} /></label>
            <div><span className="text-muted-foreground">Output</span> <span className="font-mono">{sig[selNode.id] ?? "X"}</span></div>
            {selNode.type === "INPUT" && <Button size="sm" variant="secondary" onClick={() => toggle(selNode.id)}>Toggle value</Button>}
            {["AND", "OR", "NAND", "NOR", "XOR", "XNOR"].includes(selNode.type) && (
              <label className="block"><span className="text-muted-foreground">Change gate</span>
                <select value={selNode.type} onChange={(e) => patchSel({ type: e.target.value as GateType })} className="mt-1 h-8 w-full rounded border border-input bg-card px-1">
                  {["AND", "OR", "NAND", "NOR", "XOR", "XNOR"].map((t) => <option key={t}>{t}</option>)}
                </select></label>
            )}
            <div className="flex gap-1 pt-2"><Button size="sm" variant="secondary" onClick={dup}><Copy className="h-3.5 w-3.5" />Duplicate</Button><Button size="sm" variant="destructive" onClick={del}><Trash2 className="h-3.5 w-3.5" /></Button></div>
          </div>
        ) : <p className="text-xs text-muted-foreground">Select a component.</p>}
        <div className="panel-title mb-1 mt-6">Legend</div>
        <div className="space-y-1 text-xs"><div className="text-sig-high">━ HIGH (1)</div><div className="text-sig-low">━ LOW (0)</div><div className="text-sig-x">━ UNKNOWN (X)</div><div className="text-destructive">━ FAULT</div></div>
      </aside>
      <div className="overflow-auto border-t border-border bg-sidebar p-2 font-mono text-[11px]">
        <div className="panel-title mb-1">Console</div>
        {an.errors.map((e, i) => <div key={"e" + i} className="text-destructive">ERROR  {e}</div>)}
        {an.warnings.map((e, i) => <div key={"w" + i} className="text-warning">WARN   {e}</div>)}
        {!an.errors.length && <div className="text-success">OK     {c.nodes.length} components, {c.edges.length} nets — live evaluation active</div>}
        {logs.map((l, i) => <div key={"l" + i} className="text-muted-foreground">{l}</div>)}
      </div>
    </div>
  );
}
