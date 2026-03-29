import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../stores";
import { commands } from "../../lib/tauri";
import { archGraphToMermaid } from "../../lib/mermaidConverter";
import { RefreshCw } from "lucide-react";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: "basis",
  },
  themeVariables: {
    primaryColor: "#5b7cfa",
    primaryTextColor: "#e1e4f0",
    primaryBorderColor: "#232738",
    lineColor: "#5a6080",
    secondaryColor: "#12141c",
    tertiaryColor: "#181b26",
  },
});

let renderCounter = 0;

export function MermaidDiagram() {
  const repos = useAppStore(useShallow((s) => s.repos));
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  const renderDiagram = useCallback(async () => {
    const activePaths = repos.filter((r) => r.active).map((r) => r.localPath);
    if (activePaths.length === 0 || !containerRef.current) {
      if (containerRef.current) containerRef.current.innerHTML = "";
      setNodeCount(0);
      setEdgeCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const graph = await commands.analyzeArchitecture(activePaths);
      setNodeCount(graph.nodes.length);
      setEdgeCount(graph.edges.length);
      const definition = archGraphToMermaid(graph);

      if (!definition) {
        if (containerRef.current) containerRef.current.innerHTML = "";
        return;
      }

      const id = `mermaid-${++renderCounter}`;
      const { svg } = await mermaid.render(id, definition);
      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
      }
    } catch (e) {
      console.error("Mermaid render failed:", e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [repos]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 border-b border-v-border shrink-0">
        <span className="text-[10px] font-mono text-v-dim">
          {nodeCount > 0 ? `${nodeCount} nodes \u00b7 ${edgeCount} edges` : ""}
        </span>
        <button
          onClick={renderDiagram}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono text-v-dim hover:text-v-text hover:bg-v-surface transition-colors disabled:opacity-40"
          title="Rebuild diagram"
        >
          <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
          Rebuild
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-v-bg p-2">
        {error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-red">Render error: {error}</p>
          </div>
        ) : loading && nodeCount === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">Analyzing architecture...</p>
          </div>
        ) : nodeCount === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">
              Activate repos to see architecture
            </p>
          </div>
        ) : (
          <div ref={containerRef} className="w-full [&>svg]:max-w-full" />
        )}
      </div>
    </div>
  );
}
