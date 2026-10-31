import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Copy, Download, Trash2, Upload } from "lucide-react";
import { download, useStore } from "@/lib/store";
import { Page } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/projects")({ head: () => meta("My Projects", "Create, organize, import and export circuit projects."), component: Projects });

function Projects() {
  const { projects, create, remove, duplicate, update, setActive, importProject, activeId } = useStore();
  const [q, setQ] = useState(""); const [type, setType] = useState("All"); const [sort, setSort] = useState("updated");
  const [name, setName] = useState(""); const [newType, setNewType] = useState("Combinational");
  const file = useRef<HTMLInputElement>(null);
  const list = projects
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) && (type === "All" || p.circuitType === type))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt));
  return (
    <Page title="My Projects" actions={<>
      <input ref={file} type="file" accept=".json" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { const j = JSON.parse(await f.text()); if (!j.circuit?.nodes) throw 0; importProject(j); } catch { alert("Invalid LogicLens JSON"); }
      }} />
      <Button size="sm" variant="secondary" onClick={() => file.current?.click()}><Upload className="h-3.5 w-3.5" />Import JSON</Button>
    </>}>
      <form className="panel flex flex-wrap items-end gap-2 p-3" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { create(name.trim(), newType); setName(""); } }}>
        <div className="flex-1"><div className="panel-title mb-1">New project</div><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" /></div>
        <select value={newType} onChange={(e) => setNewType(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2"><option>Combinational</option><option>Sequential</option></select>
        <Button type="submit">Create</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2"><option>All</option><option>Combinational</option><option>Sequential</option></select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2"><option value="updated">Last modified</option><option value="name">Name</option></select>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-muted-foreground"><tr className="[&>th]:px-3 [&>th]:py-2"><th>ID</th><th>Name</th><th>Type</th><th>Components</th><th>Created</th><th>Modified</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id} className={`border-t border-border [&>td]:px-3 [&>td]:py-2 ${p.id === activeId ? "bg-secondary/50" : ""}`}>
              <td className="font-mono text-muted-foreground">{p.id}</td>
              <td><input className="w-full bg-transparent outline-none focus:text-primary" defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && update(p.id, { name: e.target.value })} aria-label="Rename" />{p.demo && <span className="rounded bg-warning/15 px-1 text-[10px] text-warning">DEMO</span>}</td>
              <td>{p.circuitType}</td><td className="font-mono">{p.circuit.nodes.length}</td>
              <td className="font-mono">{new Date(p.createdAt).toLocaleDateString()}</td><td className="font-mono">{new Date(p.updatedAt).toLocaleString()}</td>
              <td>{p.runs.at(-1) ? (p.runs.at(-1)!.failed ? <span className="text-destructive">FAILED</span> : <span className="text-success">PASSED</span>) : <span className="text-muted-foreground">NOT RUN</span>}</td>
              <td className="whitespace-nowrap text-right">
                <Link to="/designer" onClick={() => setActive(p.id)} className="mr-3 text-primary">Open</Link>
                <button title="Duplicate" onClick={() => duplicate(p.id)} className="mr-2 text-muted-foreground hover:text-foreground"><Copy className="inline h-3.5 w-3.5" /></button>
                <button title="Export JSON" onClick={() => download(`${p.name}.json`, JSON.stringify(p, null, 2), "application/json")} className="mr-2 text-muted-foreground hover:text-foreground"><Download className="inline h-3.5 w-3.5" /></button>
                <button title="Delete" onClick={() => confirm(`Delete ${p.name}?`) && remove(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="inline h-3.5 w-3.5" /></button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Page>
  );
}
