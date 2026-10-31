import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { parseVCD, toVCD, waveform, type Wave } from "@/lib/engine";
import { download, useActive } from "@/lib/store";
import { NoProject, Page } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/waveform")({ head: () => meta("Waveform Analyzer", "Digital timing waveforms with cursor, VCD import and export."), component: WavePage });

function WavePage() {
  const p = useActive();
  const [steps, setSteps] = useState(16); const [zoom, setZoom] = useState(40);
  const [cursor, setCursor] = useState(0); const [imported, setImported] = useState<Wave[] | null>(null);
  const [compare, setCompare] = useState(false); const [hidden, setHidden] = useState<string[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const good = useMemo(() => (p ? waveform(p.circuit, steps) : []), [p, steps]);
  const bad = useMemo(() => (p && p.faults.length ? waveform(p.circuit, steps, p.faults) : null), [p, steps]);
  if (!p) return <NoProject />;
  const waves = (imported ?? good).filter((w) => !hidden.includes(w.name));
  const len = Math.max(0, ...waves.map((w) => w.values.length));
  const H = 28, labelW = 0;
  const y = (v: 0 | 1 | null) => (v === 1 ? 4 : v === 0 ? H - 4 : H / 2);
  const path = (vals: (0 | 1 | null)[]) => vals.map((v, i) => `${i ? "L" : "M"}${i * zoom + labelW},${y(v)} L${(i + 1) * zoom + labelW},${y(v)}`).join(" ");
  const transitions = (w: Wave) => w.values.filter((v, i) => i && v !== w.values[i - 1]).length;
  return (
    <Page title="Waveform Analyzer" actions={<>
      <input ref={file} type="file" accept=".vcd" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImported(parseVCD(await f.text())); }} />
      {imported ? <Button size="sm" variant="secondary" onClick={() => setImported(null)}>Back to simulation</Button> : <Button size="sm" variant="secondary" onClick={() => file.current?.click()}><Upload className="h-3.5 w-3.5" />Import VCD</Button>}
      <Button size="sm" variant="secondary" onClick={() => download(`${p.name}.vcd`, toVCD(imported ?? good))}><Download className="h-3.5 w-3.5" />Export VCD</Button>
      <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.min(120, z + 10))}><ZoomIn className="h-3.5 w-3.5" /></Button>
      <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.max(10, z - 10))}><ZoomOut className="h-3.5 w-3.5" /></Button>
    </>}>
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="text-muted-foreground">{imported ? "Source: imported VCD" : `Source: simulation of “${p.name}” — inputs count in binary${p.circuit.nodes.some((n) => n.type === "CLOCK") ? " per clock cycle" : " per step"}`}</span>
        {!imported && <label className="flex items-center gap-1">Steps <input type="number" min={2} max={128} value={steps} onChange={(e) => setSteps(+e.target.value || 16)} className="w-16 rounded border border-input bg-card px-1 font-mono" /></label>}
        {bad && !imported && <label className="flex items-center gap-1"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />Overlay faulty ({p.faults.length})</label>}
        <span className="font-mono">cursor t={cursor}</span>
      </div>
      <div className="panel flex overflow-hidden">
        <div className="w-44 shrink-0 border-r border-border">
          <div className="h-6 border-b border-border" />
          {waves.map((w) => (
            <div key={w.name} className="flex items-center justify-between px-2 font-mono text-xs" style={{ height: H + 8 }}>
              <span>{w.name}</span><span className="text-muted-foreground">{w.values[cursor] ?? "X"} · {transitions(w)}↕</span>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <svg width={len * zoom + 20} height={24 + waves.length * (H + 8)} onClick={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); setCursor(Math.max(0, Math.min(len - 1, Math.floor((e.clientX - r.left) / zoom)))); }} className="cursor-crosshair font-mono">
            {Array.from({ length: len + 1 }, (_, i) => <g key={i}><line x1={i * zoom} x2={i * zoom} y1={0} y2="100%" stroke="var(--border)" strokeDasharray="2 3" /><text x={i * zoom + 2} y={14} fontSize={9} fill="var(--muted-foreground)">{i * 10}</text></g>)}
            {waves.map((w, k) => {
              const fw = compare && bad ? bad.find((b) => b.name === w.name) : null;
              return (
                <g key={w.name} transform={`translate(0 ${24 + k * (H + 8)})`}>
                  <path d={path(w.values)} fill="none" stroke={w.name.toUpperCase().includes("CLK") ? "var(--primary)" : "var(--sig-high)"} strokeWidth={2} />
                  {fw && <path d={path(fw.values)} fill="none" stroke="var(--destructive)" strokeWidth={1.5} strokeDasharray="4 2" />}
                </g>
              );
            })}
            <rect x={cursor * zoom} width={zoom} y={0} height="100%" fill="var(--primary)" opacity={0.08} />
            <line x1={cursor * zoom} x2={cursor * zoom} y1={0} y2="100%" stroke="var(--warning)" />
          </svg>
        </div>
      </div>
      <div className="panel p-3 text-xs">
        <div className="panel-title mb-2">Signals</div>
        <div className="flex flex-wrap gap-3">{(imported ?? good).map((w) => <label key={w.name} className="flex items-center gap-1 font-mono"><input type="checkbox" checked={!hidden.includes(w.name)} onChange={() => setHidden(hidden.includes(w.name) ? hidden.filter((h) => h !== w.name) : [...hidden, w.name])} />{w.name}</label>)}</div>
      </div>
    </Page>
  );
}
