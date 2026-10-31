import { describe, it, expect } from "vitest";
import { truthTable, atpg, analyze, type Circuit } from "./engine";

const xorC: Circuit = {
  nodes: [
    { id: "a", type: "INPUT", label: "A", x: 0, y: 0 }, { id: "b", type: "INPUT", label: "B", x: 0, y: 0 },
    { id: "g", type: "AND", label: "G", x: 0, y: 0 }, { id: "y", type: "OUTPUT", label: "Y", x: 0, y: 0 },
  ],
  edges: [
    { id: "1", source: "a", target: "g", targetHandle: "in0" }, { id: "2", source: "b", target: "g", targetHandle: "in1" },
    { id: "3", source: "g", target: "y", targetHandle: "in0" },
  ],
};

describe("engine", () => {
  it("AND truth table", () => expect(truthTable(xorC).map((r) => r.outs[0])).toEqual([0, 0, 0, 1]));
  it("SA0 on gate forces output 0", () => expect(truthTable(xorC, [{ id: "f", type: "SA0", nodeId: "g" }]).map((r) => r.outs[0])).toEqual([0, 0, 0, 0]));
  it("ATPG reaches full coverage on AND", () => expect(atpg(xorC).coverage).toBe(1));
  it("detects combinational loop", () => {
    const c: Circuit = { nodes: [{ id: "n", type: "NOT", label: "N", x: 0, y: 0 }], edges: [{ id: "l", source: "n", target: "n", targetHandle: "in0" }] };
    expect(analyze(c).errors.some((e) => e.includes("loop"))).toBe(true);
  });
});
