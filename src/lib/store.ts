import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Circuit, Fault } from "./engine";

export interface SimRun { at: number; tests: number; passed: number; failed: number }
export interface Project {
  id: string; name: string; description: string; circuitType: string;
  createdAt: number; updatedAt: number; demo?: boolean;
  circuit: Circuit; faults: Fault[]; runs: SimRun[];
  faultHistory: { at: number; fault: Fault; detected: boolean }[];
  coverage?: number;
}

const uid = () => Math.random().toString(36).slice(2, 9);

const fullAdder: Circuit = {
  nodes: [
    { id: "a", type: "INPUT", label: "A", x: 0, y: 0, value: 0 },
    { id: "b", type: "INPUT", label: "B", x: 0, y: 120, value: 0 },
    { id: "cin", type: "INPUT", label: "Cin", x: 0, y: 260, value: 0 },
    { id: "x1", type: "XOR", label: "U1", x: 200, y: 40 },
    { id: "x2", type: "XOR", label: "U2", x: 400, y: 80 },
    { id: "a1", type: "AND", label: "U3", x: 200, y: 200 },
    { id: "a2", type: "AND", label: "U4", x: 400, y: 220 },
    { id: "o1", type: "OR", label: "U5", x: 600, y: 240 },
    { id: "s", type: "OUTPUT", label: "SUM", x: 640, y: 80 },
    { id: "co", type: "OUTPUT", label: "COUT", x: 800, y: 240 },
  ],
  edges: [
    ["a", "x1", 0], ["b", "x1", 1], ["x1", "x2", 0], ["cin", "x2", 1], ["x2", "s", 0],
    ["a", "a1", 0], ["b", "a1", 1], ["x1", "a2", 0], ["cin", "a2", 1],
    ["a1", "o1", 0], ["a2", "o1", 1], ["o1", "co", 0],
  ].map(([s, t, h]) => ({ id: `${s}-${t}-${h}`, source: s as string, target: t as string, targetHandle: `in${h}` })),
};

const counter: Circuit = {
  nodes: [
    { id: "clk", type: "CLOCK", label: "CLK", x: 0, y: 100 },
    { id: "one", type: "CONST1", label: "VCC", x: 0, y: 0 },
    { id: "t0", type: "TFF", label: "FF0", x: 220, y: 0 },
    { id: "q0", type: "OUTPUT", label: "Q0", x: 440, y: 0 },
    { id: "t1", type: "TFF", label: "FF1", x: 220, y: 160 },
    { id: "q1", type: "OUTPUT", label: "Q1", x: 440, y: 160 },
  ],
  edges: [
    { id: "e1", source: "one", target: "t0", targetHandle: "in0" },
    { id: "e2", source: "t0", target: "q0", targetHandle: "in0" },
    { id: "e3", source: "t0", target: "t1", targetHandle: "in0" },
    { id: "e4", source: "t1", target: "q1", targetHandle: "in0" },
  ],
};

const demo = (id: string, name: string, type: string, desc: string, circuit: Circuit): Project => ({
  id, name, description: desc, circuitType: type, createdAt: Date.now(), updatedAt: Date.now(),
  demo: true, circuit, faults: [], runs: [], faultHistory: [],
});

interface State {
  projects: Project[]; activeId: string | null;
  setActive: (id: string) => void;
  create: (name: string, type: string) => string;
  update: (id: string, patch: Partial<Project>) => void;
  setCircuit: (c: Circuit) => void;
  remove: (id: string) => void; duplicate: (id: string) => void;
  importProject: (p: Partial<Project> & { circuit: Circuit }) => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const seed = [
        demo("demo-fa", "Full Adder (Demo)", "Combinational", "1-bit full adder built from XOR/AND/OR", fullAdder),
        demo("demo-ctr", "2-bit Counter (Demo)", "Sequential", "Ripple-style synchronous T flip-flop counter", counter),
      ];
      return {
        projects: seed, activeId: seed[0].id,
        setActive: (id) => set({ activeId: id }),
        create: (name, type) => {
          const p: Project = { id: uid(), name, description: "", circuitType: type, createdAt: Date.now(), updatedAt: Date.now(), circuit: { nodes: [], edges: [] }, faults: [], runs: [], faultHistory: [] };
          set({ projects: [p, ...get().projects], activeId: p.id }); return p.id;
        },
        update: (id, patch) => set({ projects: get().projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)) }),
        setCircuit: (c) => { const id = get().activeId; if (id) get().update(id, { circuit: c }); },
        remove: (id) => { const ps = get().projects.filter((p) => p.id !== id); set({ projects: ps, activeId: get().activeId === id ? ps[0]?.id ?? null : get().activeId }); },
        duplicate: (id) => { const p = get().projects.find((x) => x.id === id); if (p) set({ projects: [{ ...structuredClone(p), id: uid(), name: p.name + " (copy)", demo: false, createdAt: Date.now() }, ...get().projects] }); },
        importProject: (p) => { const np: Project = { id: uid(), name: p.name ?? "Imported", description: p.description ?? "", circuitType: p.circuitType ?? "Combinational", createdAt: Date.now(), updatedAt: Date.now(), circuit: p.circuit, faults: [], runs: [], faultHistory: [] }; set({ projects: [np, ...get().projects], activeId: np.id }); },
      };
    },
    { name: "logiclens", skipHydration: true },
  ),
);

export const useActive = () => useStore((s) => s.projects.find((p) => p.id === s.activeId) ?? null);
export const newId = uid;

export function download(name: string, text: string, type = "text/plain") {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
}
