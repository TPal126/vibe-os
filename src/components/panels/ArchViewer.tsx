import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../stores";
import {
  commands,
  type ArchNode,
  type ArchEdge,
  type ArchGraph,
} from "../../lib/tauri";
import { RefreshCw } from "lucide-react";

const REPO_COLORS = [
  "#5b7cfa", // accent
  "#34d399", // green
  "#22d3ee", // cyan
  "#f87171", // red
  "#fbbf24", // orange
  "#a78bfa", // purple
  "#f472b6", // pink
  "#818cf8", // indigo
];

type SimNode = ArchNode & d3.SimulationNodeDatum;
type SimEdge = ArchEdge & d3.SimulationLinkDatum<SimNode>;

export function ArchViewer() {
  const repos = useAppStore(useShallow((s) => s.repos));

  const [graph, setGraph] = useState<ArchGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    node: ArchNode;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);

  const fetchGraph = useCallback(async () => {
    const activePaths = repos.filter((r) => r.active).map((r) => r.localPath);
    if (activePaths.length === 0) {
      setGraph({ nodes: [], edges: [] });
      return;
    }
    setLoading(true);
    try {
      const data = await commands.analyzeArchitecture(activePaths);
      setGraph(data);
    } catch (e) {
      console.error("Architecture analysis failed:", e);
    } finally {
      setLoading(false);
    }
  }, [repos]);

  // Fetch on mount and when repos change
  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // D3 rendering
  useEffect(() => {
    if (!graph || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Count incoming edges per node for sizing
    const incomingCount = new Map<string, number>();
    graph.edges.forEach((e) => {
      incomingCount.set(e.to_id, (incomingCount.get(e.to_id) || 0) + 1);
    });

    // Assign colors by repo
    const repoNames = [...new Set(graph.nodes.map((n) => n.repo_name))];
    const repoColorMap = new Map(
      repoNames.map((name, i) => [name, REPO_COLORS[i % REPO_COLORS.length]]),
    );

    // SVG defs for glow filter
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Container group for zoom/pan
    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // Deep copy nodes and edges for D3 mutation
    const simNodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
    const simEdges: SimEdge[] = graph.edges.map((e) => ({
      ...e,
      source: e.from_id as unknown as SimNode,
      target: e.to_id as unknown as SimNode,
    }));

    // Create simulation
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance(80),
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(20));

    simulationRef.current = simulation;

    // Draw edges
    const link = g
      .append("g")
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", "var(--color-v-border)")
      .attr("stroke-opacity", 0.3)
      .attr("stroke-dasharray", "4,2")
      .attr("stroke-width", 1);

    // Draw nodes
    const node = g
      .append("g")
      .selectAll<SVGCircleElement, SimNode>("circle")
      .data(simNodes)
      .join("circle")
      .attr("r", (d) => {
        const count = incomingCount.get(d.id) || 0;
        return Math.max(6, Math.sqrt(count + 1) * 4);
      })
      .attr("fill", (d) => repoColorMap.get(d.repo_name) || REPO_COLORS[0])
      .attr("stroke", "var(--color-v-bg)")
      .attr("stroke-width", 1.5)
      .style("filter", (d) => {
        const count = incomingCount.get(d.id) || 0;
        return count > 3 ? "url(#glow)" : "none";
      })
      .style("cursor", "grab");

    // Labels for module nodes
    const label = g
      .append("g")
      .selectAll("text")
      .data(simNodes.filter((n) => n.node_type === "module"))
      .join("text")
      .text((d) => d.label.split(".").pop() || d.label)
      .attr("font-size", 9)
      .attr("font-family", "var(--font-mono)")
      .attr("fill", "var(--color-v-dim)")
      .attr("text-anchor", "middle")
      .attr("dy", -12)
      .style("pointer-events", "none");

    // Hover handlers
    node
      .on("mouseenter", (event, d) => {
        // Highlight connected edges
        link
          .attr("stroke-opacity", (l) =>
            (l.source as SimNode).id === d.id ||
            (l.target as SimNode).id === d.id
              ? 0.8
              : 0.1,
          )
          .attr("stroke-width", (l) =>
            (l.source as SimNode).id === d.id ||
            (l.target as SimNode).id === d.id
              ? 2
              : 1,
          );
        // Highlight connected nodes
        const connectedIds = new Set<string>();
        simEdges.forEach((e) => {
          if ((e.source as SimNode).id === d.id)
            connectedIds.add((e.target as SimNode).id);
          if ((e.target as SimNode).id === d.id)
            connectedIds.add((e.source as SimNode).id);
        });
        connectedIds.add(d.id);
        node.attr("opacity", (n) => (connectedIds.has(n.id) ? 1 : 0.2));
        label.attr("opacity", (n) => (connectedIds.has(n.id) ? 1 : 0.2));

        setTooltip({
          x: event.pageX,
          y: event.pageY,
          node: d,
        });
      })
      .on("mouseleave", () => {
        link.attr("stroke-opacity", 0.3).attr("stroke-width", 1);
        node.attr("opacity", 1);
        label.attr("opacity", 1);
        setTooltip(null);
      });

    // Drag behavior
    const drag = d3
      .drag<SVGCircleElement, SimNode>()
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
      });
    node.call(drag);

    // Tick function
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);
      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
      label.attr("x", (d) => d.x ?? 0).attr("y", (d) => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [graph]);

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-v-border">
        <span className="text-[10px] font-mono text-v-dim">
          {graph
            ? `${graph.nodes.length} nodes · ${graph.edges.length} edges`
            : ""}
        </span>
        <button
          onClick={fetchGraph}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono text-v-dim hover:text-v-text hover:bg-v-surface transition-colors disabled:opacity-40"
          title="Rebuild graph"
        >
          <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
          Rebuild
        </button>
      </div>

      {/* Graph container */}
      <div className="flex-1 overflow-hidden bg-v-bg">
        {loading && !graph ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">
              Analyzing architecture...
            </p>
          </div>
        ) : graph && graph.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">
              Activate repos to see architecture
            </p>
          </div>
        ) : (
          <svg ref={svgRef} className="w-full h-full" />
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-v-surfaceHi border border-v-border rounded px-2 py-1.5 shadow-lg pointer-events-none"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 8,
          }}
        >
          <p className="text-[10px] font-mono text-v-textHi">
            {tooltip.node.label}
          </p>
          <p className="text-[9px] text-v-dim truncate max-w-[250px]">
            {tooltip.node.file_path}
          </p>
          {tooltip.node.function_list.length > 0 && (
            <div className="mt-1 border-t border-v-border/50 pt-1">
              <span className="text-[8px] text-v-dim uppercase tracking-wider">
                Functions
              </span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {tooltip.node.function_list.slice(0, 8).map((fn, i) => (
                  <span key={i} className="text-[9px] font-mono text-v-cyan">
                    {fn}()
                  </span>
                ))}
                {tooltip.node.function_list.length > 8 && (
                  <span className="text-[9px] text-v-dim">
                    +{tooltip.node.function_list.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
