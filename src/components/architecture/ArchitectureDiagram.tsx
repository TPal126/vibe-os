import { useState, useCallback, memo, useEffect, useRef } from "react";
import * as d3 from "d3";
import { RefreshCw } from "lucide-react";
import { ArchitectureBreadcrumb } from "./ArchitectureBreadcrumb";
import { IconButton } from "../shared/IconButton";
import { commands } from "../../lib/tauri";

// ── Types ──

interface TopologyNode {
  id: string;
  label: string;
  node_type: string;
  framework: string;
  stats: string;
  active: boolean;
}

interface TopologyEdge {
  source: string;
  target: string;
  edge_type: string;
}

interface TopologyData {
  repos: TopologyNode[];
  modules: TopologyNode[];
  edges: TopologyEdge[];
}

export interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  framework: string;
  stats: string;
  active: boolean;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  edgeType: string;
}

// ── Pure transformation (exported for testing) ──

export function buildRepoSimulation(data: TopologyData): {
  nodes: D3Node[];
  links: D3Link[];
} {
  const repoIdSet = new Set(data.repos.map((r) => r.id));

  const nodes: D3Node[] = data.repos.map((r) => ({
    id: r.id,
    label: r.label,
    framework: r.framework,
    stats: r.stats,
    active: r.active,
  }));

  const links: D3Link[] = data.edges
    .filter((e) => repoIdSet.has(e.source) && repoIdSet.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      edgeType: e.edge_type,
    }));

  return { nodes, links };
}

// ── Constants ──

const NODE_W = 100;
const NODE_H = 44;
const NODE_RX = 6;
const ACTIVE_BORDER = "#5b7cfa";
const INACTIVE_BORDER = "#5a6080";
const NODE_FILL = "#12141c";

// ── Component ──

export const ArchitectureDiagram = memo(function ArchitectureDiagram() {
  const [zoomLevel, setZoomLevel] = useState<"repo" | "module">("repo");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  // ── Fetch topology ──

  const fetchTopology = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await commands.graphGetTopology();
      setTopology(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  // ── D3 rendering ──

  useEffect(() => {
    if (!topology || !svgRef.current || !containerRef.current) return;

    const { nodes, links } = buildRepoSimulation(topology);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // Zoom/pan container group
    const g = svg.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Simulation
    const simulation = d3
      .forceSimulation<D3Node>(nodes)
      .force(
        "link",
        d3
          .forceLink<D3Node, D3Link>(links)
          .id((d) => d.id)
          .distance(180),
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(70));

    simulationRef.current = simulation;

    // Links
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll("g")
      .data(links)
      .join("g");

    const linkLine = link
      .append("line")
      .attr("stroke", "#5a6080")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", (d) => {
        const et = typeof d.edgeType === "string" ? d.edgeType : "";
        return et === "depends_on" ? "4 3" : null;
      });

    const linkLabel = link
      .append("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#5a6080")
      .attr("font-size", "8px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("pointer-events", "none")
      .text((d) => d.edgeType as string);

    // Nodes
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, D3Node>()
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

    // Node rectangles
    node
      .append("rect")
      .attr("width", NODE_W)
      .attr("height", NODE_H)
      .attr("rx", NODE_RX)
      .attr("fill", NODE_FILL)
      .attr("stroke", (d) => (d.active ? ACTIVE_BORDER : INACTIVE_BORDER))
      .attr("stroke-width", 1.5);

    // Active pulse indicator
    node
      .filter((d) => d.active)
      .append("circle")
      .attr("r", 4)
      .attr("cx", NODE_W - 10)
      .attr("cy", 10)
      .attr("fill", ACTIVE_BORDER)
      .attr("opacity", 0.9)
      .attr("class", "pulse-dot");

    // Label text
    node
      .append("text")
      .attr("x", NODE_W / 2)
      .attr("y", 17)
      .attr("text-anchor", "middle")
      .attr("fill", "#d0d4f0")
      .attr("font-size", "10px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-weight", "600")
      .attr("pointer-events", "none")
      .text((d) => (d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label));

    // Stats text
    node
      .append("text")
      .attr("x", NODE_W / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("fill", "#5a6080")
      .attr("font-size", "8px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("pointer-events", "none")
      .text((d) => (d.stats.length > 16 ? d.stats.slice(0, 15) + "…" : d.stats));

    // Framework badge
    node
      .filter((d) => !!d.framework)
      .append("text")
      .attr("x", NODE_W / 2)
      .attr("y", 41)
      .attr("text-anchor", "middle")
      .attr("fill", "#3d4870")
      .attr("font-size", "7px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("pointer-events", "none")
      .text((d) => d.framework);

    // Click
    node.on("click", (_event, d) => {
      setSelectedRepo(d.label);
      setZoomLevel("module");
    });

    // Tick
    simulation.on("tick", () => {
      linkLine
        .attr("x1", (d) => ((d.source as D3Node).x ?? 0) + NODE_W / 2)
        .attr("y1", (d) => ((d.source as D3Node).y ?? 0) + NODE_H / 2)
        .attr("x2", (d) => ((d.target as D3Node).x ?? 0) + NODE_W / 2)
        .attr("y2", (d) => ((d.target as D3Node).y ?? 0) + NODE_H / 2);

      linkLabel
        .attr("x", (d) => (((d.source as D3Node).x ?? 0) + ((d.target as D3Node).x ?? 0)) / 2 + NODE_W / 2)
        .attr("y", (d) => (((d.source as D3Node).y ?? 0) + ((d.target as D3Node).y ?? 0)) / 2 + NODE_H / 2);

      node.attr("transform", (d) => `translate(${(d.x ?? 0) - NODE_W / 2},${(d.y ?? 0) - NODE_H / 2})`);
    });

    return () => {
      simulation.stop();
    };
  }, [topology]);

  // ── Breadcrumb navigation ──

  const breadcrumbPath =
    zoomLevel === "repo" ? ["All Repos"] : ["All Repos", selectedRepo ?? ""];

  const handleBreadcrumbNavigate = useCallback((depth: number) => {
    if (depth === 0) {
      setZoomLevel("repo");
      setSelectedRepo(null);
    }
  }, []);

  // ── Derived state ──

  const repoCount = topology?.repos.length ?? 0;
  const hasRepos = repoCount > 0;

  return (
    <div className="flex flex-col h-full bg-v-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-v-border flex items-center justify-between">
        <ArchitectureBreadcrumb
          path={breadcrumbPath}
          onNavigate={handleBreadcrumbNavigate}
        />
        <div className="px-2">
          <IconButton
            icon={<RefreshCw size={10} className={loading ? "animate-spin" : ""} />}
            title="Refresh architecture"
            onClick={fetchTopology}
          />
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-v-red text-[11px]">{error}</span>
          </div>
        )}

        {!error && !hasRepos && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-v-dim pointer-events-none">
            <p className="text-xs">Architecture Diagram</p>
            <p className="text-[10px] mt-1">Repo topology will render here.</p>
            <p className="text-[10px]">Index a repo to see nodes.</p>
          </div>
        )}

        {zoomLevel === "module" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-v-dim pointer-events-none">
            <p className="text-xs">Module Detail: {selectedRepo}</p>
            <p className="text-[10px] mt-1">Module structure will render here.</p>
          </div>
        )}

        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ background: "#08090d", display: zoomLevel === "repo" ? "block" : "none" }}
        />
      </div>

      {/* Legend */}
      <div className="shrink-0 px-2 py-1 border-t border-v-border flex items-center gap-3 text-[8px] text-v-dim">
        <span>
          <span className="text-v-accent">●</span> active session
        </span>
        <span>
          <span className="text-v-green">●</span> changed
        </span>
        <span>
          <span className="text-v-dim">●</span> idle
        </span>
        {repoCount > 0 && (
          <span className="ml-auto font-mono">{repoCount} repos</span>
        )}
      </div>
    </div>
  );
});
