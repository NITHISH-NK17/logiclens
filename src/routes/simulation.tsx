import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, Pause, Play, RotateCcw, StepForward, ListChecks } from "lucide-react";
import { analyze, clockEdge, evaluate, inputsOf, isSequential, outputsOf, truthTable, type Logic, type SeqState } from "@/lib/engine";
import { download, useActive, useStore } from "@/lib/store";
import { Bit, Kpi, NoProject, Page } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/simulation")({ head: () => meta("Simulation Studio", "Run, step and verify circuits against all test vectors."), component: Sim });

function Sim() {
  const p = useActive(); const update = useStore((s) => s.update);
  const [inputs, setInputs] = useState<Record<string, 0 | 1>>({});
  const [state, setState] = useState<SeqState>({}); const [cycle, setCycle] = useState(0);
  const [log, setLog] = useState<string[]>([]); const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ms: number; rows: ReturnType<typeof truthTable>; golden: ReturnType<typeof truthTable> } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const c = p?.circuit;
  const an = useMemo(() => (c ? analyze(c) : null), [c]);
  if (!p || !c || !an) return <NoProject />;
  const ins = inputsOf(c), outs = outputsOf(c), seq = isSequential(c);
  const iv = (id: string): Logic => inputs[id] ?? c.nodes.find((n) => n.id === id)?.value ?? 0;
  const map = Object.fromEntries(ins.map((n) => [n.id, iv(n.id)]));
  const sig = evaluate(c, map, p.faults, state, an);
  const ts = () => new Date().toLocaleTimeString();
  const step = () => {
    setState((st) => {
      const s = evaluate(c, map, p.faults, st, an); const ns = clockEdge(c, s, st);
      const after = evaluate(c, map, p.faults, ns, an);
      setLog((l) => [...l, `[${ts()}] cycle ${cycle + 1}: ${outs.map((o) => `${o.label}=${after[o.id] ?? "X"}`).join(" ")}`]);
      return ns;
    });
    setCycle((x) => x + 1);
  };
  const run = () => { if (timer.current) return; setRunning(true); timer.current = setInterval(() => document.getElementById("step-btn")?.click(), 500); };
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setRunning(false); };
  const reset = () => { stop(); setState({}); setCycle(0); setLog((l) => [...l, `[${ts()}] reset`]); };
  const runAll = () => {
    const t0 = performance.now(); const golden = truthTable(c); const rows = truthTable(c, p.faults); const ms = performance.now() - t0;
    const failed = rows.filter((r, i) => r.outs.some((o, k) => o !== golden[i].outs[k])).length;
    setResult({ ms, rows, golden });
    update(p.id, { runs: [...p.runs, { at: Date.now(), tests: rows.length, passed: rows.length - failed, failed }] });
    setLog((l) => [...l, `[${ts()}] ran ${rows.length} vectors in ${ms.toFixed(2)} ms — ${rows.length - failed} pass, ${failed} fail${p.faults.length ? ` (${p.faults.length} active fault(s))` : ""}`]);
  };
  const failed = result ? result.rows.filter((r, i) => r.outs.some((o, k) => o !== result.golden[i].outs[k])).length : 0;
  const csv = () => result && download(`${p.name}-truth-table.csv`, ["#," + [...ins, ...outs].map((n) => n.label).join(",") + ",status", ...result.rows.map((r, i) => `${r.idx},${r.ins.join(",")},${r.outs.map((o) => o ?? "X").join(",")},${r.outs.some((o, k) => o !== result.golden[i].outs[k]) ? "FAIL" : "PASS"}`)].join("\n"), "text/csv");

  return (
    <Page title="Simulation Studio" actions={<>
      {seq && <>
        <Button size="sm" variant="secondary" onClick={running ? stop : run}>{running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{running ? "Stop" : "Run"}</Button>
        <Button id="step-btn" size="sm" variant="secondary" onClick={step}><StepForward className="h-3.5 w-3.5" />Step clock</Button>
      </>}
      <Button size="sm" variant="secondary" onClick={reset}><RotateCcw className="h-3.5 w-3.5" />Reset</Button>
      <Button size="sm" onClick={runAll} disabled={!!an.errors.length || ins.length > 12}><ListChecks className="h-3.5 w-3.5" />Run All Test Vectors</Button>
    </>}>
      {an.errors.length > 0 && <div className="panel border-destructive p-3 text-xs text-destructive">{an.errors.join(" · ")}</div>}
      {p.faults.length > 0 && <div className="panel border-warning p-2 text-xs text-warning">{p.faults.length} fault(s) currently injected — actual results compared against fault-free golden model.</div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Status" value={running ? "RUNNING" : result ? "DONE" : "IDLE"} tone={running ? "primary" : undefined} />
        <Kpi label="Test cases" value={result?.rows.length ?? "—"} />
        <Kpi label="Passed" value={result ? result.rows.length - failed : "—"} tone="success" />
        <Kpi label="Failed" value={result ? failed : "—"} tone="destructive" />
        <Kpi label="Exec time" value={result ? `${result.ms.toFixed(2)}ms` : "—"} />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="panel p-3">
          <div className="panel-title mb-2">Inputs {seq && <span className="ml-2 font-mono normal-case">cycle {cycle}</span>}</div>
          {ins.map((n) => (
            <div key={n.id} className="flex items-center justify-between border-b border-border py-1.5 text-xs">
              <span className="font-mono">{n.label}</span>
              <button className="rounded border border-border px-3 font-mono" onClick={() => setInputs({ ...inputs, [n.id]: iv(n.id) ? 0 : 1 })}><Bit v={iv(n.id)} /></button>
            </div>
          ))}
          {!ins.length && <p className="text-xs text-muted-foreground">No input pins.</p>}
          <div className="panel-title mb-2 mt-4">Output monitor</div>
          {outs.map((n) => <div key={n.id} className="flex justify-between py-1 text-xs"><span className="font-mono">{n.label}</span><span className="text-lg"><Bit v={sig[n.id]} /></span></div>)}
        </div>
        <div className="panel overflow-auto p-3 lg:col-span-2" style={{ maxHeight: 420 }}>
          <div className="mb-2 flex items-center justify-between"><div className="panel-title">Truth table — expected vs actual</div>{result && <Button size="sm" variant="ghost" onClick={csv}><Download className="h-3.5 w-3.5" />CSV</Button>}</div>
          {result ? (
            <table className="w-full text-center font-mono text-xs">
              <thead className="text-muted-foreground"><tr><th>#</th>{ins.map((n) => <th key={n.id}>{n.label}</th>)}{outs.map((n) => <th key={n.id}>{n.label} exp</th>)}{outs.map((n) => <th key={n.id + "a"}>{n.label} act</th>)}<th>Status</th></tr></thead>
              <tbody>{result.rows.map((r, i) => {
                const bad = r.outs.some((o, k) => o !== result.golden[i].outs[k]);
                return <tr key={i} className={`border-t border-border ${bad ? "bg-destructive/10" : ""}`}><td>{r.idx}</td>{r.ins.map((v, k) => <td key={k}><Bit v={v} /></td>)}{result.golden[i].outs.map((v, k) => <td key={"g" + k}><Bit v={v} /></td>)}{r.outs.map((v, k) => <td key={"o" + k}><Bit v={v} /></td>)}<td className={bad ? "text-destructive" : "text-success"}>{bad ? "FAIL" : "PASS"}</td></tr>;
              })}</tbody>
            </table>
          ) : <p className="text-xs text-muted-foreground">Click “Run All Test Vectors” to evaluate all 2^{ins.length} = {2 ** ins.length} combinations.</p>}
        </div>
      </div>
      <div className="panel p-3">
        <div className="mb-1 flex items-center justify-between"><div className="panel-title">Execution log</div><Button size="sm" variant="ghost" onClick={() => download(`${p.name}-sim.log`, log.join("\n"))}><Download className="h-3.5 w-3.5" />Log</Button></div>
        <div className="max-h-40 overflow-auto font-mono text-[11px] text-muted-foreground">{an.warnings.map((w, i) => <div key={i} className="text-warning">WARN {w}</div>)}{log.map((l, i) => <div key={i}>{l}</div>)}</div>
      </div>
    </Page>
  );
}
