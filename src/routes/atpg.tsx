import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { atpg, inputsOf, isSequential, type ATPGResult } from "@/lib/engine";
import { download, useActive, useStore } from "@/lib/store";
import { Bit, Kpi, NoProject, Page } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/atpg")({ head: () => meta("ATPG & Coverage", "Automatic test pattern generation and stuck-at fault coverage."), component: ATPG });

function ATPG() {
  const p = useActive(); const update = useStore((s) => s.update);
  const [r, setR] = useState<ATPGResult | null>(null);
  if (!p) return <NoProject />;
  const c = p.circuit; const ins = inputsOf(c);
  const label = (id: string) => c.nodes.find((n) => n.id === id)?.label ?? id;
  const run = () => { const res = atpg(c); setR(res); update(p.id, { coverage: res.coverage }); };
  const blocked = isSequential(c) ? "ATPG currently supports combinational circuits only." : ins.length > 12 ? "Exhaustive ATPG limited to 12 inputs." : null;
  return (
    <Page title="ATPG & Coverage Analysis" actions={<>
      {r && <Button size="sm" variant="secondary" onClick={() => download(`${p.name}-patterns.txt`, [`# ${ins.map((n) => n.label).join(" ")}`, ...r.patterns.map((v) => v.join(""))].join("\n"))}><Download className="h-3.5 w-3.5" />Export patterns</Button>}
      <Button size="sm" onClick={run} disabled={!!blocked}>Generate test patterns</Button>
    </>}>
      {blocked && <div className="panel p-3 text-xs text-warning">{blocked}</div>}
      <p className="text-xs text-muted-foreground">Method: single stuck-at fault universe (SA0/SA1 on every net), exhaustive fault simulation against the golden model, then greedy set-cover compaction to a minimal pattern set.</p>
      {r && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Total faults" value={r.total} />
          <Kpi label="Detected" value={r.detected} tone="success" />
          <Kpi label="Undetectable / redundant" value={r.total - r.detected} tone="warning" />
          <Kpi label="Fault coverage" value={`${(r.coverage * 100).toFixed(1)}%`} tone="primary" />
          <Kpi label="Compacted patterns" value={`${r.patterns.length} / ${2 ** ins.length}`} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="panel p-3">
            <div className="panel-title mb-2">Generated test set</div>
            <table className="w-full text-center font-mono text-xs"><thead className="text-muted-foreground"><tr><th>#</th>{ins.map((n) => <th key={n.id}>{n.label}</th>)}</tr></thead>
              <tbody>{r.patterns.map((v, i) => <tr key={i} className="border-t border-border"><td>T{i + 1}</td>{v.map((b, k) => <td key={k}><Bit v={b} /></td>)}</tr>)}</tbody></table>
          </div>
          <div className="panel overflow-auto p-3" style={{ maxHeight: 420 }}>
            <div className="panel-title mb-2">Fault list</div>
            <table className="w-full text-left font-mono text-xs"><thead className="text-muted-foreground"><tr><th>Fault</th><th>Status</th><th>Detecting vectors</th></tr></thead>
              <tbody>{r.faults.map((f) => <tr key={f.fault.id} className="border-t border-border"><td>{label(f.fault.nodeId)}/{f.fault.type}</td><td className={f.detectedBy.length ? "text-success" : "text-warning"}>{f.detectedBy.length ? "DT" : "UD"}</td><td className="text-muted-foreground">{f.detectedBy.length}</td></tr>)}</tbody></table>
          </div>
        </div>
      </>}
    </Page>
  );
}
