import { describe, it, expect } from "vitest";
import { buildRepoSimulation } from "./ArchitectureDiagram";

describe("buildRepoSimulation", () => {
  it("returns empty arrays for empty topology", () => {
    const result = buildRepoSimulation({ repos: [], modules: [], edges: [] });
    expect(result.nodes).toEqual([]);
    expect(result.links).toEqual([]);
  });

  it("converts repos to D3 nodes", () => {
    const result = buildRepoSimulation({
      repos: [
        { id: "repo:api", label: "api-server", node_type: "repo", framework: "Express", stats: "24 routes", active: true },
        { id: "repo:web", label: "web-client", node_type: "repo", framework: "React", stats: "18 components", active: false },
      ],
      modules: [],
      edges: [],
    });
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toMatchObject({ id: "repo:api", label: "api-server", active: true });
    expect(result.nodes[1]).toMatchObject({ id: "repo:web", label: "web-client", active: false });
  });

  it("converts edges to D3 links", () => {
    const result = buildRepoSimulation({
      repos: [
        { id: "repo:api", label: "api", node_type: "repo", framework: "", stats: "", active: false },
        { id: "repo:shared", label: "shared", node_type: "repo", framework: "", stats: "", active: false },
      ],
      modules: [],
      edges: [
        { source: "repo:api", target: "repo:shared", edge_type: "depends_on" },
      ],
    });
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toMatchObject({ source: "repo:api", target: "repo:shared" });
  });

  it("filters edges to only include repo-to-repo at repo level", () => {
    const result = buildRepoSimulation({
      repos: [
        { id: "repo:api", label: "api", node_type: "repo", framework: "", stats: "", active: false },
      ],
      modules: [
        { id: "module:auth", label: "auth", node_type: "module", framework: "", stats: "", active: false },
      ],
      edges: [
        { source: "repo:api", target: "module:auth", edge_type: "belongs_to" },
      ],
    });
    expect(result.links).toHaveLength(0);
  });
});
