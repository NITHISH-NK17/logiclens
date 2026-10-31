// LogicLens simulation engine — pure TS, independent of React.
export type Logic = 0 | 1 | null; // null = unknown (X)

export type GateType =
  | "INPUT" | "OUTPUT" | "CONST0" | "CONST1" | "CLOCK"
  | "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR" | "BUFFER"
  | "DFF" | "TFF";

export const GATE_INPUTS: Record<GateType, number> = {
  INPUT: 0, OUTPUT: 1, CONST0: 0, CONST1: 0, CLOCK: 0,
  AND: 2, OR: 2, NOT: 1, NAND: 2, NOR: 2, XOR: 2, XNOR: 2, BUFFER: 1,
  DFF: 1, TFF: 1,
};
export const SEQUENTIAL: GateType[] = ["DFF", "TFF"];

export interface CNode { id: string; type: GateType; label: string; x: number; y: number; value?: 0 | 1 }
export interface CEdge { id: string; source: string; target: string; targetHandle: string }
export interface Circuit { nodes: CNode[]; edges: CEdge[] }

export type FaultType = "SA0" | "SA1" | "OPEN" | "BRIDGE_AND" | "BRIDGE_OR" | "INVERT";
export interface Fault { id: string; type: FaultType; nodeId: string; nodeId2?: string }

export const FAULT_LABEL: Record<FaultType, string> = {
  SA0: "Stuck-at-0", SA1: "Stuck-at-1", OPEN: "Open circuit (→X)",
  BRIDGE_AND: "Bridging (wired-AND)", BRIDGE_OR: "Bridging (wired-OR)", INVERT: "Gate output failure (inverted)",
};

const not = (a: Logic): Logic => (a === null ? null : a ? 0 : 1);
function and(xs: Logic[]): Logic { if (xs.some((x) => x === 0)) return 0; if (xs.some((x) => x === null)) return null; return 1; }
function or(xs: Logic[]): Logic { if (xs.some((x) => x === 1)) return 1; if (xs.some((x) => x === null)) return null; return 0; }
function xor(xs: Logic[]): Logic { if (xs.some((x) => x === null)) return null; return (xs.reduce<number>((a, b) => a ^ (b as number), 0)) as Logic; }

export function gateFn(t: GateType, ins: Logic[]): Logic {
  switch (t) {
    case "AND": return and(ins);
    case "OR": return or(ins);
    case "NAND": return not(and(ins));
    case "NOR": return not(or(ins));
    case "XOR": return xor(ins);
    case "XNOR": return not(xor(ins));
    case "NOT": return not(ins[0]);
    case "BUFFER": case "OUTPUT": return ins[0] ?? null;
    case "CONST0": return 0;
    case "CONST1": return 1;
    default: return null;
  }
}

export interface Analysis { order: string[]; errors: string[]; warnings: string[] }

/** Topological order; sequential element outputs break loops (they come from state). */
export function analyze(c: Circuit): Analysis {
  const errors: string[] = []; const warnings: string[] = [];
  const byId = new Map(c.nodes.map((n) => [n.id, n]));
  const indeg = new Map<string, number>(); const adj = new Map<string, string[]>();
  c.nodes.forEach((n) => { indeg.set(n.id, 0); adj.set(n.id, []); });
  for (const e of c.edges) {
    const s = byId.get(e.source), t = byId.get(e.target);
    if (!s || !t) { errors.push(`Edge ${e.id} references missing node`); continue; }
    if (s.type === "OUTPUT") errors.push(`Output ${s.label} cannot drive other signals`);
    if (SEQUENTIAL.includes(s.type)) continue; // state output: no combinational dependency
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, indeg.get(e.target)! + 1);
  }
  for (const n of c.nodes) {
    const need = GATE_INPUTS[n.type];
    for (let i = 0; i < need; i++) {
      const cnt = c.edges.filter((e) => e.target === n.id && e.targetHandle === `in${i}`).length;
      if (cnt === 0) warnings.push(`${n.label}: input ${i} unconnected (X)`);
      if (cnt > 1) errors.push(`${n.label}: input ${i} has multiple drivers`);
    }
    if (n.type !== "OUTPUT" && !c.edges.some((e) => e.source === n.id)) warnings.push(`${n.label}: output not used`);
  }
  const q = c.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (q.length) {
    const id = q.shift()!; order.push(id);
    for (const t of adj.get(id)!) { indeg.set(t, indeg.get(t)! - 1); if (indeg.get(t) === 0) q.push(t); }
  }
  if (order.length < c.nodes.length) errors.push("Combinational loop detected (cycle without a flip-flop)");
  return { order, errors, warnings };
}

export type Signals = Record<string, Logic>;
export type SeqState = Record<string, Logic>;

function applyFault(v: Logic, id: string, faults: Fault[]): Logic {
  for (const f of faults) {
    if (f.nodeId !== id) continue;
    if (f.type === "SA0") v = 0; else if (f.type === "SA1") v = 1;
    else if (f.type === "OPEN") v = null; else if (f.type === "INVERT") v = not(v);
  }
  return v;
}

/** Evaluate one combinational settle. inputs: map of INPUT/CLOCK node id -> value. */
export function evaluate(c: Circuit, inputs: Record<string, Logic>, faults: Fault[] = [], state: SeqState = {}, an?: Analysis): Signals {
  const a = an ?? analyze(c);
  const sig: Signals = {};
  const byId = new Map(c.nodes.map((n) => [n.id, n]));
  const drivers = (id: string, k: number) => {
    const e = c.edges.find((x) => x.target === id && x.targetHandle === `in${k}`);
    return e ? sig[e.source] ?? null : null;
  };
  const order = a.errors.length ? c.nodes.map((n) => n.id) : a.order;
  for (const id of order) {
    const n = byId.get(id)!;
    let v: Logic;
    if (n.type === "INPUT" || n.type === "CLOCK") v = inputs[id] ?? (n.value ?? 0);
    else if (SEQUENTIAL.includes(n.type)) v = state[id] ?? 0;
    else v = gateFn(n.type, Array.from({ length: GATE_INPUTS[n.type] }, (_, k) => drivers(id, k)));
    sig[id] = applyFault(v, id, faults);
  }
  // Bridging: deterministic wired-AND / wired-OR resolution between two nets, one pass + re-propagation
  const bridges = faults.filter((f) => f.type.startsWith("BRIDGE") && f.nodeId2);
  if (bridges.length) {
    const forced: Fault[] = [...faults.filter((f) => !f.type.startsWith("BRIDGE"))];
    for (const b of bridges) {
      const r = b.type === "BRIDGE_AND" ? and([sig[b.nodeId], sig[b.nodeId2!]]) : or([sig[b.nodeId], sig[b.nodeId2!]]);
      const t: FaultType = r === null ? "OPEN" : r ? "SA1" : "SA0";
      forced.push({ id: b.id + "a", type: t, nodeId: b.nodeId }, { id: b.id + "b", type: t, nodeId: b.nodeId2! });
    }
    return evaluate(c, inputs, forced, state, a);
  }
  return sig;
}

/** Rising clock edge: update flip-flop states from their D/T inputs. */
export function clockEdge(c: Circuit, sig: Signals, state: SeqState): SeqState {
  const next: SeqState = { ...state };
  for (const n of c.nodes) {
    if (!SEQUENTIAL.includes(n.type)) continue;
    const e = c.edges.find((x) => x.target === n.id && x.targetHandle === "in0");
    const d = e ? sig[e.source] ?? null : null;
    next[n.id] = n.type === "DFF" ? d : d === 1 ? not(state[n.id] ?? 0) : d === 0 ? (state[n.id] ?? 0) : null;
  }
  return next;
}

export const inputsOf = (c: Circuit) => c.nodes.filter((n) => n.type === "INPUT");
export const outputsOf = (c: Circuit) => c.nodes.filter((n) => n.type === "OUTPUT");
export const isSequential = (c: Circuit) => c.nodes.some((n) => SEQUENTIAL.includes(n.type));

export function vectors(n: number): (0 | 1)[][] {
  return Array.from({ length: 2 ** n }, (_, i) => Array.from({ length: n }, (_, b) => ((i >> (n - 1 - b)) & 1) as 0 | 1));
}

export interface TTRow { idx: number; ins: (0 | 1)[]; outs: Logic[] }
export function truthTable(c: Circuit, faults: Fault[] = []): TTRow[] {
  const ins = inputsOf(c), outs = outputsOf(c); const an = analyze(c);
  if (ins.length > 12) return [];
  return vectors(ins.length).map((v, idx) => {
    const m: Record<string, Logic> = {}; ins.forEach((n, i) => (m[n.id] = v[i]));
    const s = evaluate(c, m, faults, {}, an);
    return { idx, ins: v, outs: outs.map((o) => s[o.id]) };
  });
}

/** Single stuck-at fault universe: SA0 + SA1 on every driving net. */
export function faultUniverse(c: Circuit): Fault[] {
  return c.nodes.filter((n) => n.type !== "OUTPUT").flatMap((n) => [
    { id: `${n.id}/SA0`, type: "SA0" as const, nodeId: n.id },
    { id: `${n.id}/SA1`, type: "SA1" as const, nodeId: n.id },
  ]);
}

export interface ATPGResult {
  faults: { fault: Fault; detectedBy: number[] }[];
  patterns: (0 | 1)[][]; coverage: number; detected: number; total: number;
}
/** Exhaustive fault simulation + greedy set-cover compaction (combinational). */
export function atpg(c: Circuit): ATPGResult {
  const good = truthTable(c);
  const fl = faultUniverse(c).map((fault) => {
    const bad = truthTable(c, [fault]);
    const detectedBy = good.filter((g, i) => g.outs.some((o, k) => o !== null && bad[i].outs[k] !== null && o !== bad[i].outs[k])).map((g) => g.idx);
    return { fault, detectedBy };
  });
  const remaining = new Set(fl.filter((f) => f.detectedBy.length).map((f) => f.fault.id));
  const chosen: number[] = [];
  while (remaining.size) {
    let best = -1, bestCount = 0;
    for (const g of good) {
      const cnt = fl.filter((f) => remaining.has(f.fault.id) && f.detectedBy.includes(g.idx)).length;
      if (cnt > bestCount) { best = g.idx; bestCount = cnt; }
    }
    if (best < 0) break;
    chosen.push(best);
    fl.forEach((f) => f.detectedBy.includes(best) && remaining.delete(f.fault.id));
  }
  const detected = fl.filter((f) => f.detectedBy.length).length;
  return { faults: fl, patterns: chosen.map((i) => good[i].ins), detected, total: fl.length, coverage: fl.length ? detected / fl.length : 0 };
}

export interface Wave { name: string; values: Logic[] }
/** Time-step simulation: inputs count through binary; CLOCK toggles each step; flip-flops update on rising edge. */
export function waveform(c: Circuit, steps = 16, faults: Fault[] = []): Wave[] {
  const ins = inputsOf(c); const clocks = c.nodes.filter((n) => n.type === "CLOCK");
  const watch = c.nodes.filter((n) => ["INPUT", "CLOCK", "OUTPUT", "DFF", "TFF"].includes(n.type));
  const an = analyze(c); let state: SeqState = {};
  const waves: Wave[] = watch.map((n) => ({ name: n.label, values: [] }));
  let prevClk: Logic = 0;
  for (let t = 0; t < steps; t++) {
    const m: Record<string, Logic> = {};
    const cycle = clocks.length ? Math.floor(t / 2) : t;
    ins.forEach((n, i) => (m[n.id] = ((cycle >> (ins.length - 1 - i)) & 1) as 0 | 1));
    const clk = (t % 2) as 0 | 1; clocks.forEach((n) => (m[n.id] = clk));
    let s = evaluate(c, m, faults, state, an);
    if (clocks.length && prevClk === 0 && clk === 1) { state = clockEdge(c, s, state); s = evaluate(c, m, faults, state, an); }
    prevClk = clk;
    watch.forEach((n, i) => waves[i].values.push(s[n.id]));
  }
  return waves;
}

/** Minimal VCD parser: scalar value changes ($var wire 1 <id> <name>). */
export function parseVCD(text: string, maxSteps = 64): Wave[] {
  const ids = new Map<string, string>(); const cur = new Map<string, Logic>();
  const out = new Map<string, Logic[]>(); let started = false; let times = 0;
  const toks = text.split(/\s+/).filter(Boolean);
  const snap = () => { ids.forEach((name, id) => out.get(name)!.push(cur.get(id) ?? null)); times++; };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === "$var") { const id = toks[i + 3], name = toks[i + 4]; ids.set(id, name); out.set(name, []); i += 4; continue; }
    if (t === "$enddefinitions") { started = true; continue; }
    if (!started) continue;
    if (t.startsWith("#")) { if (times > 0 || cur.size) snap(); if (times >= maxSteps) break; continue; }
    const m = /^([01xXzZ])(.+)$/.exec(t);
    if (m && ids.has(m[2])) cur.set(m[2], m[1] === "1" ? 1 : m[1] === "0" ? 0 : null);
  }
  if (cur.size) snap();
  return [...out.entries()].map(([name, values]) => ({ name, values }));
}

export function toVCD(waves: Wave[]): string {
  const ids = waves.map((_, i) => String.fromCharCode(33 + i));
  let s = "$timescale 1ns $end\n$scope module top $end\n";
  waves.forEach((w, i) => (s += `$var wire 1 ${ids[i]} ${w.name.replace(/\s/g, "_")} $end\n`));
  s += "$upscope $end\n$enddefinitions $end\n";
  const len = waves[0]?.values.length ?? 0;
  for (let t = 0; t < len; t++) {
    s += `#${t * 10}\n`;
    waves.forEach((w, i) => { const v = w.values[t]; if (t === 0 || v !== w.values[t - 1]) s += `${v === null ? "x" : v}${ids[i]}\n`; });
  }
  return s;
}
