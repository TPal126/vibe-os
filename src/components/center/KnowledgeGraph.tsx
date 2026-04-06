import { useEffect, useRef, useState, useCallback, memo } from "react";
import * as d3 from "d3";
import { invoke } from "@tauri-apps/api/core";
import {
  Search,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  FolderGit2,
} from "lucide-react";

// ── Types matching Rust GraphData ──

interface GraphNode {
  id: string;
  node_type: string;
  label: string;
  data: Record<string, unknown>;
  // d3 simulation fields
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  edge_type: string;
  data: Record<string, unknown>;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Visual encoding ──

const NODE_COLORS: Record<string, string> = {
  repo: "#5b7cfa",     // accent
  module: "#22d3ee",    // cyan
  function: "#34d399",  // green
  class: "#fbbf24",     // yellow
  ticket: "#a78bfa",    // purple
  skill: "#fb923c",     // orange
  decision: "#fbbf24",  // yellow
  action: "#6b7280",    // gray
  test: "#34d399",      // green
  prompt: "#5b7cfa80",  // accent dim
  session: "#f87171",   // red
};

const NODE_RADIUS: Record<string, number> = {
  repo: 18,
  module: 12,
  function: 8,
  class: 10,
  ticket: 12,
  skill: 10,
  decision: 9,
  action: 5,
  test: 6,
  prompt: 7,
  session: 14,
};

const EDGE_COLORS: Record<string, string> = {
  belongs_to: "#232738",
  defined_in: "#232738",
  imports: "#22d3ee80",
  calls: "#22d3ee80",
  inherits: "#22d3ee80",
  informed_by: "#fb923c80",
  modified: "#34d39980",
  addresses: "#a78bfa60",
  implemented_by: "#a78bfa60",
  led_to: "#fbbf2480",
  validated_by: "#34d39980",
  triggered_by: "#5b7cfa40",
  produced: "#5b7cfa40",
  occurred_in: "#23273840",
  followed: "#23273840",
  included_in: "#fb923c40",
  contextualized: "#5b7cfa40",
  linked_to: "#a78bfa40",
  depends_on: "#a78bfa40",
  updated_by: "#23273840",
};

const EDGE_DASHED: Set<string> = new Set([
  "informed_by",
  "triggered_by",
  "produced",
  "included_in",
  "contextualized",
  "depends_on",
]);

// ── Node type toggles ──

const ALL_NODE_TYPES = [
  "repo", "module", "function", "class", "ticket",
  "skill", "decision", "test",
];

// ── Component ──

export const KnowledgeGraph = memo(function KnowledgeGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(ALL_NODE_TYPES),
  );
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<string | null>(null);

  // ── Fetch graph data ──

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<GraphData>("graph_get_full", {
        sessionId: null,
      });
      setGraphData(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // ── Index repo ──

  const indexRepo = useCallback(async () => {
    // Index the vibe-os repo itself as a test
    setIndexing(true);
    setIndexResult(null);
    try {
      const result = await invoke<{
        repo_name: string;
        total_files: number;
        modules_created: number;
        functions_created: number;
        classes_created: number;
        edges_created: number;
        first_fn_error: string | null;
      }>("graph_index_repo", {
        repoPath: "C:\\Users\\Thoma\\vibe-os",
        sessionId: "test-session",
      });
      const errMsg = result.first_fn_error ? ` | FN ERROR: ${result.first_fn_error}` : "";
      setIndexResult(
        `${result.repo_name}: ${result.modules_created} mod, ${result.functions_created} fn, ${result.classes_created} cls, ${result.edges_created} edges${errMsg}`,
      );
      await fetchGraph();
    } catch (e) {
      setIndexResult(`Error: ${e}`);
    } finally {
      setIndexing(false);
    }
  }, [fetchGraph]);

  // ── Search ──

  const searchGraph = useCallback(async () => {
    if (!searchQuery.trim()) {
      fetchGraph();
      return;
    }
    setLoading(true);
    try {
      const nodes = await invoke<GraphNode[]>("graph_search", {
        query: searchQuery,
        nodeTypes: [],
      });
      setGraphData({ nodes, edges: [] });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, fetchGraph]);

  // ── D3 rendering ──

  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // Filter by visible types
    const nodes = graphData.nodes.filter((n) => visibleTypes.has(n.node_type));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = graphData.edges.filter(
      (e) => {
        const srcId = typeof e.source === "string" ? e.source : e.source.id;
        const tgtId = typeof e.target === "string" ? e.target : e.target.id;
        return nodeIds.has(srcId) && nodeIds.has(tgtId);
      },
    );

    // Zoom
    const g = svg.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Arrow markers
    const defs = svg.append("defs");
    Object.keys(EDGE_COLORS).forEach((type) => {
      defs
        .append("marker")
        .attr("id", `arrow-${type}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", EDGE_COLORS[type] || "#232738");
    });

    // Simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance(80),
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) =>
        (NODE_RADIUS[(d as GraphNode).node_type] || 8) + 4,
      ));

    simulationRef.current = simulation;

    // Edges
    const link = g
      .append("g")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", (d) => EDGE_COLORS[d.edge_type] || "#232738")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", (d) =>
        EDGE_DASHED.has(d.edge_type) ? "4 3" : null,
      )
      .attr("marker-end", (d) => `url(#arrow-${d.edge_type})`);

    // Nodes
    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any,
      );

    // Node circles
    node
      .append("circle")
      .attr("r", (d) => NODE_RADIUS[d.node_type] || 8)
      .attr("fill", (d) => NODE_COLORS[d.node_type] || "#6b7280")
      .attr("stroke", "#08090d")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.9);

    // Node labels
    node
      .append("text")
      .text((d) => {
        const label = d.label || d.id;
        return label.length > 20 ? label.slice(0, 18) + "..." : label;
      })
      .attr("dy", (d) => (NODE_RADIUS[d.node_type] || 8) + 12)
      .attr("text-anchor", "middle")
      .attr("fill", "#b8bdd4")
      .attr("font-size", "9px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("pointer-events", "none");

    // Hover / Click
    node.on("mouseover", function (_event, d) {
      d3.select(this).select("circle").attr("stroke", "#5b7cfa").attr("stroke-width", 2.5);
      // Highlight connected edges
      link.attr("opacity", (l) => {
        const src = typeof l.source === "string" ? l.source : l.source.id;
        const tgt = typeof l.target === "string" ? l.target : l.target.id;
        return src === d.id || tgt === d.id ? 1 : 0.15;
      });
    });

    node.on("mouseout", function () {
      d3.select(this).select("circle").attr("stroke", "#08090d").attr("stroke-width", 1.5);
      link.attr("opacity", 1);
    });

    node.on("click", (_event, d) => {
      setSelectedNode(d);
    });

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, visibleTypes]);

  // ── Zoom controls ──

  const handleZoom = useCallback((factor: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
      factor,
    );
  }, []);

  const handleFitView = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const { width, height } = containerRef.current.getBoundingClientRect();
    svg.transition().duration(500).call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8),
    );
  }, []);

  const toggleType = useCallback((type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // ── Empty state ──

  const nodeCount = graphData?.nodes.length ?? 0;
  const edgeCount = graphData?.edges.length ?? 0;

  return (
    <div className="flex flex-col h-full bg-v-bg">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-v-border shrink-0">
        {/* Row 1: Index + Search + Refresh + Zoom */}
        <button
          onClick={indexRepo}
          disabled={indexing}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-v-accent bg-v-accent/10 hover:bg-v-accent/20 transition-colors disabled:opacity-50"
          title="Index vibe-os repo"
        >
          <FolderGit2 size={11} className={indexing ? "animate-spin" : ""} />
          {indexing ? "Indexing..." : "Index Repo"}
        </button>

        <div className="flex items-center gap-1 bg-v-surface rounded px-2 py-0.5 min-w-[120px] flex-1 max-w-[200px]">
          <Search size={10} className="text-v-dim shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchGraph()}
            placeholder="Search..."
            className="bg-transparent text-[11px] text-v-text outline-none w-full placeholder:text-v-dim"
          />
        </div>

        <button
          onClick={async () => {
            try {
              const dump = await invoke("graph_debug_dump") as any;
              setIndexResult(`fn_def DB count: ${dump.fn_count?.[0]?.cnt ?? 0} | modules: ${dump.module_count?.[0]?.cnt ?? 0} | sample_fns: ${JSON.stringify(dump.sample_fns)}`);
            } catch (e) {
              setIndexResult(`Debug error: ${e}`);
            }
          }}
          className="px-1.5 py-0.5 rounded text-[9px] font-mono text-v-dim bg-v-surface hover:bg-v-surfaceHi transition-colors"
        >
          Debug
        </button>

        <button
          onClick={fetchGraph}
          className="p-1 text-v-dim hover:text-v-text transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>

        <button onClick={() => handleZoom(1.5)} className="p-1 text-v-dim hover:text-v-text" title="Zoom in">
          <ZoomIn size={12} />
        </button>
        <button onClick={() => handleZoom(0.67)} className="p-1 text-v-dim hover:text-v-text" title="Zoom out">
          <ZoomOut size={12} />
        </button>
        <button onClick={handleFitView} className="p-1 text-v-dim hover:text-v-text" title="Fit view">
          <Maximize2 size={12} />
        </button>

        <span className="text-[9px] text-v-dim font-mono ml-auto">
          {nodeCount}n &middot; {edgeCount}e
        </span>
      </div>

      {/* Row 2: Type filters + status */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1 border-b border-v-border shrink-0">
        <Filter size={10} className="text-v-dim shrink-0" />
        {ALL_NODE_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
              visibleTypes.has(type)
                ? "bg-opacity-20 text-opacity-100"
                : "bg-v-surface text-v-dim/40"
            }`}
            style={{
              backgroundColor: visibleTypes.has(type)
                ? NODE_COLORS[type] + "30"
                : undefined,
              color: visibleTypes.has(type)
                ? NODE_COLORS[type]
                : undefined,
            }}
          >
            {type}
          </button>
        ))}
        {indexResult && (
          <span className={`text-[9px] font-mono ml-auto ${indexResult.startsWith("Error") ? "text-v-red" : "text-v-green"}`}>
            {indexResult}
          </span>
        )}
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-v-red text-[11px]">{error}</span>
          </div>
        )}

        {!error && nodeCount === 0 && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-v-dim">
            <div className="text-[11px] mb-1">Graph is empty</div>
            <div className="text-[9px]">
              Index a repo or create decisions to populate the knowledge graph
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ background: "#08090d" }}
        />

        {/* Selected node detail panel */}
        {selectedNode && (
          <div className="absolute top-2 right-2 w-[260px] bg-v-surface border border-v-border rounded-lg p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor:
                      NODE_COLORS[selectedNode.node_type] || "#6b7280",
                  }}
                />
                <span className="text-[10px] font-mono text-v-dim uppercase">
                  {selectedNode.node_type}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-v-dim hover:text-v-text text-[11px]"
              >
                &times;
              </button>
            </div>
            <div className="text-[12px] text-v-textHi font-mono mb-2 break-words">
              {selectedNode.label}
            </div>
            <div className="text-[9px] text-v-dim font-mono break-all">
              {selectedNode.id}
            </div>
            <div className="mt-2 max-h-[200px] overflow-y-auto">
              {Object.entries(selectedNode.data)
                .filter(
                  ([k]) =>
                    !["id", "node_type", "label"].includes(k) &&
                    selectedNode.data[k] != null,
                )
                .map(([key, val]) => (
                  <div
                    key={key}
                    className="flex justify-between text-[9px] py-0.5 border-t border-v-border/50"
                  >
                    <span className="text-v-dim">{key}</span>
                    <span className="text-v-text/70 text-right max-w-[140px] truncate">
                      {typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
