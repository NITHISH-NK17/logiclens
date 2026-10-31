import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, Boxes, CircuitBoard, FileText, FolderKanban, LayoutDashboard, LineChart, PanelLeftClose, PanelLeftOpen, ScanSearch, Target, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { analyze } from "@/lib/engine";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "My Projects", icon: FolderKanban },
  { to: "/designer", label: "Circuit Designer", icon: CircuitBoard },
  { to: "/simulation", label: "Simulation Studio", icon: Activity },
  { to: "/waveform", label: "Waveform Analyzer", icon: LineChart },
  { to: "/faults", label: "Fault Injection Lab", icon: Zap },
  { to: "/atpg", label: "ATPG & Coverage", icon: Target },
  { to: "/reports", label: "Verification Reports", icon: FileText },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { void Promise.resolve(useStore.persist.rehydrate()).then(() => setReady(true)); }, []);
  const loc = useLocation();
  const { projects, activeId, setActive } = useStore();
  const active = projects.find((p) => p.id === activeId);
  const an = active ? analyze(active.circuit) : null;
  const current = NAV.find((n) => n.to === loc.pathname);
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className={cn("flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all", collapsed ? "w-14" : "w-56")}>
        <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-3">
          <ScanSearch className="h-5 w-5 shrink-0 text-primary" />
          {!collapsed && <span className="font-mono text-sm font-bold tracking-tight">Logic<span className="text-primary">Lens</span></span>}
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} title={n.label}
              className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline focus-visible:outline-ring", loc.pathname === n.to && "bg-sidebar-accent text-primary")}>
              <n.icon className="h-4 w-4 shrink-0" />{!collapsed && <span>{n.label}</span>}
            </Link>
          ))}
        </nav>
        <button onClick={() => setCollapsed(!collapsed)} className="m-2 flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent" aria-label="Toggle sidebar">
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border px-4">
          <div className="text-xs text-muted-foreground">LogicLens <span className="mx-1">/</span><span className="text-foreground">{current?.label ?? "Page"}</span></div>
          <div className="ml-auto flex items-center gap-3">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            {ready && <select value={activeId ?? ""} onChange={(e) => setActive(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 text-xs" aria-label="Current project">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>}
            {ready && an && (
              <span className={cn("rounded px-2 py-0.5 font-mono text-[11px]", an.errors.length ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>
                {an.errors.length ? `${an.errors.length} ERR` : "READY"}
              </span>
            )}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{ready ? children : null}</main>
      </div>
    </div>
  );
}

export function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3"><h1 className="text-lg font-semibold">{title}</h1><div className="flex gap-2">{actions}</div></div>
      {children}
    </div>
  );
}

export function Kpi({ label, value, tone }: { label: string; value: ReactNode; tone?: "success" | "destructive" | "warning" | "primary" }) {
  return (
    <div className="panel p-3">
      <div className="panel-title">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold", tone && `text-${tone}`)}>{value}</div>
    </div>
  );
}

export function Bit({ v }: { v: 0 | 1 | null | undefined }) {
  return <span className={cn("font-mono", v === 1 ? "text-sig-high" : v === 0 ? "text-sig-low" : "text-sig-x")}>{v ?? "X"}</span>;
}

export function NoProject() {
  return <div className="p-10 text-center text-muted-foreground">No project selected. Create one in <Link to="/projects" className="text-primary underline">My Projects</Link>.</div>;
}
