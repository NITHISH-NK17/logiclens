import { createFileRoute } from "@tanstack/react-router";
import { Download, Printer } from "lucide-react";
import { analyze, atpg, inputsOf, isSequential, outputsOf, truthTable } from "@/lib/engine";
import { download, useActive } from "@/lib/store";
import { NoProject, Page } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/reports")({ head: () => meta("Verification Reports", "Generated verification report for the current circuit."), component: Reports });

function Reports() {
  const p = useActive();
  if (!p) return <NoProject />;
  const c = p.circuit; const an = analyze(c); const seq = isSequential(c);
  const ins = inputsOf(c), outs = outputsOf(c);
  const comb = !seq && ins.length <= 12 && !an.errors.length;
  const tt = comb ? truthTable(c) : []; const at = comb ? atpg(c) : null;
  const gates = c.nodes.reduce<Record<string, number>>((a, n) => ({ ...a, [n.type]: (a[n.type] ?? 0) + 1 }), {});
  const last = p.runs.at(-1);
  const md = [
    `# Verification Report — ${p.name}`, `Generated: ${new Date().toISOString()}`, "",
    `## Design`, `Type: ${p.circuitType}  Components: ${c.nodes.length}  Nets: ${c.edges.length}`, `Inventory: ${Object.entries(gates).map(([k, v]) => `${k}×${v}`).join(", ")}`,
    `## Static checks`, `Errors: ${an.errors.length}`, ...an.errors.map((e) => `- ${e}`), `Warnings: ${an.warnings.length}`, ...an.warnings.map((e) => `- ${e}`),
    `## Simulation`, last ? `Last run: ${new Date(last.at).toISOString()} — ${last.passed}/${last.tests} passed` : "No simulation runs recorded.",
    at ? `## ATPG\nStuck-at faults: ${at.total}, detected ${at.detected}, coverage ${(at.coverage * 100).toFixed(1)}%, patterns ${at.patterns.length}` : "",
    `## Injected faults`, ...(p.faultHistory.length ? p.faultHistory.map((h) => `- ${h.fault.id} ${h.fault.type} — ${h.detected ? "detected" : "undetected"}`) : ["None"]),
    tt.length ? `## Truth table\n| ${[...ins, ...outs].map((n) => n.label).join(" | ")} |\n|${[...ins, ...outs].map(() => "---").join("|")}|\n${tt.map((r) => `| ${[...r.ins, ...r.outs.map((o) => o ?? "X")].join(" | ")} |`).join("\n")}` : "",
  ].join("\n");
  const verdict = an.errors.length ? "FAIL" : last?.failed ? "FAIL" : last ? "PASS" : "INCOMPLETE";
  return (
    <Page title="Verification Report" actions={<>
      <Button size="sm" variant="secondary" onClick={() => download(`${p.name}-report.md`, md)}><Download className="h-3.5 w-3.5" />Markdown</Button>
      <Button size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Print / PDF</Button>
    </>}>
      <div className="panel flex items-center justify-between p-4">
        <div><div className="text-base font-semibold">{p.name}</div><div className="text-xs text-muted-foreground">{p.circuitType} · {c.nodes.length} components · {c.edges.length} nets</div></div>
        <span className={`rounded px-3 py-1 font-mono text-sm font-bold ${verdict === "PASS" ? "bg-success/15 text-success" : verdict === "FAIL" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>{verdict}</span>
      </div>
      <pre className="panel overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed">{md}</pre>
    </Page>
  );
}
