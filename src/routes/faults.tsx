import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2, Zap } from "lucide-react";
import { FAULT_LABEL, truthTable, inputsOf, outputsOf, type Fault, type FaultType } from "@/lib/engine";
import { newId, useActive, useStore } from "@/lib/store";
import { Bit, NoProject, Page } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/faults")({ head: () => meta("Fault Injection Lab", "Inject stuck-at, bridging and open faults and diagnose them."), component: Faults });

const ASSUMPTIONS: Record<FaultType, string> = {
  SA0: "Net permanently driven to logic 0.",
  SA1: "Net permanently driven to logic 1.",
  OPEN: "Floating net abstracted as unknown (X); X propagates unless masked by a controlling value.",
  BRIDGE_AND: "Two nets shorted; both resolve to A AND B (dominant-0 wired-AND).",
  BRIDGE_OR: "Two nets shorted; both resolve to A OR B (dominant-1 wired-OR).",
  INVERT: "Gate output failure: component emits the complement of its correct value.",
};

function Faults() {
  const p = useActive(); const update = useStore((s) => s.update);
  const [node, setNode] = useState(""); const [node2, setNode2] = useState(""); const [type, setType] = useState<FaultType>("SA0");
  const [ran, setRan] = useState(false);
  if (!p) return <NoProject />;
  const c = p.circuit; const nets = c.nodes.filter((n) => n.type !== "OUTPUT");
  const label = (id?: string) => c.nodes.find((n) => n.id === id)?.label ?? "?";
  const ins = inputsOf(c), outs = outputsOf(c);
  const golden = truthTable(c);
  const analyzeFault = (f: Fault) => {
    const bad = truthTable(c, [f]);
    const vecs = golden.map((g, i) => ({ g, b: bad[i] })).filter(({ g, b }) => g.outs.some((o, k) => o !== b.outs[k]));
    return { detected: vecs.length > 0, vecs, confidence: golden.length ? vecs.length / golden.length : 0 };
  };
  const inject = () => {
    const id = node || nets[0]?.id; if (!id) return;
    if (type.startsWith("BRIDGE") && (!node2 || node2 === id)) return alert("Choose a second, different net for a bridging fault");
    const f: Fault = { id: "F" + newId().slice(0, 4).toUpperCase(), type, nodeId: id, nodeId2: type.startsWith("BRIDGE") ? node2 : undefined };
    const r = analyzeFault(f);
    update(p.id, { faults: [...p.faults, f], faultHistory: [...p.faultHistory, { at: Date.now(), fault: f, detected: r.detected }] });
  };
  // Diagnosis: which single stuck-at fault explains the observed (combined) faulty behaviour?
  const observed = truthTable(c, p.faults);
  const candidates = ran && p.faults.length ? nets.flatMap((n) => (["SA0", "SA1"] as const).map((t) => ({ f: { id: "", type: t, nodeId: n.id } as Fault }))).map(({ f }) => {
    const t = truthTable(c, [f]); const match = t.filter((r, i) => r.outs.every((o, k) => o === observed[i].outs[k])).length;
    return { f, score: observed.length ? match / observed.length : 0 };
  }).sort((a, b) => b.score - a.score).slice(0, 5) : [];

  return (
    <Page title="Fault Injection Lab" actions={<>
      <Button size="sm" variant="secondary" onClick={() => { update(p.id, { faults: [] }); setRan(false); }}>Reset all faults</Button>
      <Button size="sm" onClick={() => setRan(true)} disabled={!p.faults.length}>Run fault simulation</Button>
    </>}>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="panel space-y-3 p-3">
          <div className="panel-title">Inject fault</div>
          <label className="block text-xs"><span className="text-muted-foreground">Fault model</span>
            <select value={type} onChange={(e) => setType(e.target.value as FaultType)} className="mt-1 h-8 w-full rounded border border-input bg-card px-1">{(Object.keys(FAULT_LABEL) as FaultType[]).map((t) => <option key={t} value={t}>{FAULT_LABEL[t]}</option>)}</select></label>
          <label className="block text-xs"><span className="text-muted-foreground">Location (gate / signal)</span>
            <select value={node} onChange={(e) => setNode(e.target.value)} className="mt-1 h-8 w-full rounded border border-input bg-card px-1">{nets.map((n) => <option key={n.id} value={n.id}>{n.label} ({n.type})</option>)}</select></label>
          {type.startsWith("BRIDGE") && <label className="block text-xs"><span className="text-muted-foreground">Bridged with</span>
            <select value={node2} onChange={(e) => setNode2(e.target.value)} className="mt-1 h-8 w-full rounded border border-input bg-card px-1"><option value="">—</option>{nets.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label>}
          <p className="rounded bg-secondary p-2 text-[11px] text-muted-foreground">Model: {ASSUMPTIONS[type]}</p>
          <Button className="w-full" onClick={inject} disabled={!nets.length}><Zap className="h-3.5 w-3.5" />Inject fault</Button>
        </div>
        <div className="panel overflow-auto p-3 lg:col-span-2">
          <div className="panel-title mb-2">Fault analysis</div>
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground"><tr className="[&>th]:py-1"><th>ID</th><th>Type</th><th>Location</th><th>Detected</th><th>First test vector</th><th>Expected → Actual</th><th>Sensitivity</th><th /></tr></thead>
            <tbody>{p.faults.map((f) => {
              const r = analyzeFault(f); const v = r.vecs[0];
              return (
                <tr key={f.id} className="border-t border-border [&>td]:py-1.5">
                  <td className="font-mono">{f.id}</td><td>{f.type}</td><td className="font-mono text-destructive">{label(f.nodeId)}{f.nodeId2 && ` ↔ ${label(f.nodeId2)}`}</td>
                  <td>{r.detected ? <span className="text-success">DETECTED</span> : <span className="text-warning">UNDETECTED</span>}</td>
                  <td className="font-mono">{v ? ins.map((n, i) => `${n.label}=${v.g.ins[i]}`).join(" ") : "—"}</td>
                  <td className="font-mono">{v ? <>{v.g.outs.map((o, i) => <Bit key={i} v={o} />)} → {v.b.outs.map((o, i) => <span key={i} className="text-destructive">{o ?? "X"}</span>)}</> : "—"}</td>
                  <td className="font-mono">{(r.confidence * 100).toFixed(0)}%</td>
                  <td><button onClick={() => update(p.id, { faults: p.faults.filter((x) => x.id !== f.id) })} className="text-muted-foreground hover:text-destructive" title="Remove fault"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              );
            })}</tbody>
          </table>
          {!p.faults.length && <p className="py-4 text-xs text-muted-foreground">No active faults. Injected faults alter the real simulation in every tool (designer, studio, waveform).</p>}
        </div>
      </div>
      {ran && p.faults.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="panel overflow-auto p-3" style={{ maxHeight: 360 }}>
            <div className="panel-title mb-2">Normal vs faulty outputs</div>
            <table className="w-full text-center font-mono text-xs">
              <thead className="text-muted-foreground"><tr>{ins.map((n) => <th key={n.id}>{n.label}</th>)}{outs.map((n) => <th key={n.id}>{n.label} good</th>)}{outs.map((n) => <th key={n.id + "f"}>{n.label} faulty</th>)}</tr></thead>
              <tbody>{golden.map((g, i) => { const diff = g.outs.some((o, k) => o !== observed[i].outs[k]); return <tr key={i} className={`border-t border-border ${diff ? "bg-destructive/10" : ""}`}>{g.ins.map((v, k) => <td key={k}><Bit v={v} /></td>)}{g.outs.map((v, k) => <td key={"g" + k}><Bit v={v} /></td>)}{observed[i].outs.map((v, k) => <td key={"o" + k} className={v !== g.outs[k] ? "text-destructive" : ""}>{v ?? "X"}</td>)}</tr>; })}</tbody>
            </table>
          </div>
          <div className="panel p-3">
            <div className="panel-title mb-2">Diagnosis — most likely single stuck-at explanation</div>
            {candidates.map((cd, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-border py-1.5 text-xs">
                <span className="w-24 font-mono">{label(cd.f.nodeId)}/{cd.f.type}</span>
                <div className="h-2 flex-1 rounded bg-secondary"><div className="h-2 rounded bg-primary" style={{ width: `${cd.score * 100}%` }} /></div>
                <span className="w-12 text-right font-mono">{(cd.score * 100).toFixed(0)}%</span>
              </div>
            ))}
            <p className="mt-2 text-[11px] text-muted-foreground">Confidence = fraction of test vectors where the candidate fault reproduces the observed faulty outputs.</p>
          </div>
        </div>
      )}
      <div className="panel p-3">
        <div className="panel-title mb-2">Fault history</div>
        <div className="max-h-40 overflow-auto font-mono text-[11px]">{[...p.faultHistory].reverse().map((h, i) => <div key={i} className="text-muted-foreground">{new Date(h.at).toLocaleString()} · {h.fault.id} {h.fault.type} @ {label(h.fault.nodeId)} · <span className={h.detected ? "text-success" : "text-warning"}>{h.detected ? "detected" : "undetected"}</span></div>)}</div>
      </div>
    </Page>
  );
}
