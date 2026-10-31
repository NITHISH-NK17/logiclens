import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { Kpi, Page } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/")({ head: () => meta("Dashboard", "Overview of projects, simulations, faults and coverage."), component: Dashboard });

function Dashboard() {
  const { projects, setActive } = useStore();
  const runs = projects.flatMap((p) => p.runs);
  const fh = projects.flatMap((p) => p.faultHistory);
  const passed = runs.reduce((a, r) => a + r.passed, 0), failed = runs.reduce((a, r) => a + r.failed, 0);
  const cov = projects.filter((p) => p.coverage !== undefined);
  const avgCov = cov.length ? cov.reduce((a, p) => a + p.coverage!, 0) / cov.length : null;
  const byDay = new Map<string, number>();
  runs.forEach((r) => { const d = new Date(r.at).toLocaleDateString(); byDay.set(d, (byDay.get(d) ?? 0) + 1); });
  const activity = [...byDay.entries()].map(([day, n]) => ({ day, n }));
  const types = ["SA0", "SA1", "BRIDGE_AND", "BRIDGE_OR", "OPEN", "INVERT"];
  const dist = types.map((t) => ({ name: t, value: fh.filter((f) => f.fault.type === t).length })).filter((d) => d.value);
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

  return (
    <Page title="Dashboard" actions={<>
      <Button size="sm" variant="secondary" asChild><Link to="/projects">Create Project</Link></Button>
      <Button size="sm" variant="secondary" asChild><Link to="/designer">Circuit Designer</Link></Button>
      <Button size="sm" variant="secondary" asChild><Link to="/simulation">Start Simulation</Link></Button>
      <Button size="sm" asChild><Link to="/faults">Inject Fault</Link></Button>
    </>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Projects" value={projects.length} />
        <Kpi label="Gates / Components" value={projects.reduce((a, p) => a + p.circuit.nodes.length, 0)} />
        <Kpi label="Simulations" value={runs.length} tone="primary" />
        <Kpi label="Faults Detected" value={fh.filter((f) => f.detected).length} tone="destructive" />
        <Kpi label="Avg Fault Coverage" value={avgCov === null ? "—" : `${(avgCov * 100).toFixed(1)}%`} tone="success" />
        <Kpi label="Test Pass Rate" value={passed + failed ? `${((passed / (passed + failed)) * 100).toFixed(1)}%` : "—"} />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="panel p-3 lg:col-span-2">
          <div className="panel-title mb-2">Recent projects</div>
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground"><tr><th className="py-1.5">Name</th><th>Type</th><th>Modified</th><th>Last run</th><th /></tr></thead>
            <tbody>
              {[...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6).map((p) => {
                const r = p.runs.at(-1);
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-1.5">{p.name} {p.demo && <span className="ml-1 rounded bg-warning/15 px-1 text-[10px] text-warning">DEMO</span>}</td>
                    <td>{p.circuitType}</td><td className="font-mono">{new Date(p.updatedAt).toLocaleString()}</td>
                    <td>{r ? <span className={r.failed ? "text-destructive" : "text-success"}>{r.passed}/{r.tests} pass</span> : <span className="text-muted-foreground">never</span>}</td>
                    <td className="text-right"><Link to="/designer" onClick={() => setActive(p.id)} className="text-primary">Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="panel p-3">
          <div className="panel-title mb-2">Fault distribution (injected)</div>
          {dist.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart><Pie data={dist} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>{dist.map((_, i) => <Cell key={i} fill={colors[i]} />)}</Pie><Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} /></PieChart>
            </ResponsiveContainer>
          ) : <Empty text="No faults injected yet" />}
        </div>
        <div className="panel p-3 lg:col-span-2">
          <div className="panel-title mb-2">Simulation activity</div>
          {activity.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={activity}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} /><YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} /><Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} /><Bar dataKey="n" name="Runs" fill="var(--chart-1)" /></BarChart>
            </ResponsiveContainer>
          ) : <Empty text="Run a simulation to see activity" />}
        </div>
        <div className="panel space-y-2 p-3">
          <div className="panel-title">Verification overview</div>
          <Row k="Passed test cases" v={passed} c="text-success" /><Row k="Failed test cases" v={failed} c="text-destructive" />
          <Row k="Projects never simulated" v={projects.filter((p) => !p.runs.length).length} c="text-warning" />
        </div>
      </div>
    </Page>
  );
}
const Empty = ({ text }: { text: string }) => <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground">{text}</div>;
const Row = ({ k, v, c }: { k: string; v: number; c: string }) => <div className="flex justify-between text-xs"><span className="text-muted-foreground">{k}</span><span className={`font-mono ${c}`}>{v}</span></div>;
