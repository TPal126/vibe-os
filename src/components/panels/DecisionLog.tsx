import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../stores";
import type { Decision } from "../../stores/types";
import { Download } from "lucide-react";

const IMPACT_CONFIG: Record<string, { color: string; label: string }> = {
  perf:         { color: "var(--color-v-cyan)",    label: "Perf" },
  accuracy:     { color: "var(--color-v-green)",   label: "Accuracy" },
  dx:           { color: "var(--color-v-accent)",  label: "DX" },
  security:     { color: "var(--color-v-red)",     label: "Security" },
  architecture: { color: "#a78bfa",                label: "Arch" },
};

export function DecisionLog() {
  const { decisions, decisionsLoading, loadDecisions, exportDecisions } =
    useAppStore(
      useShallow((s) => ({
        decisions: s.decisions,
        decisionsLoading: s.decisionsLoading,
        loadDecisions: s.loadDecisions,
        exportDecisions: s.exportDecisions,
      })),
    );

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Export bar */}
      <div className="flex items-center justify-end gap-1 px-2 py-1 border-b border-v-border">
        <button
          onClick={() => exportDecisions("json")}
          className="text-[9px] font-mono text-v-dim hover:text-v-text px-1.5 py-0.5 rounded hover:bg-v-surface transition-colors"
          title="Export as JSON"
        >
          JSON
        </button>
        <button
          onClick={() => exportDecisions("csv")}
          className="text-[9px] font-mono text-v-dim hover:text-v-text px-1.5 py-0.5 rounded hover:bg-v-surface transition-colors"
          title="Export as CSV"
        >
          CSV
        </button>
        <Download size={10} className="text-v-dim" />
      </div>

      {/* Decision list */}
      <div className="flex-1 overflow-y-auto">
        {decisionsLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">Loading decisions...</p>
          </div>
        ) : decisions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">
              Agent decisions will appear here during sessions
            </p>
          </div>
        ) : (
          <div className="divide-y divide-v-border/30">
            {decisions.map((d) => (
              <DecisionCard key={d.id} decision={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionCard({ decision }: { decision: Decision }) {
  const [expanded, setExpanded] = useState(false);
  const impact = IMPACT_CONFIG[decision.impactCategory] || IMPACT_CONFIG.dx;

  let confidenceColor: string;
  if (decision.confidence > 0.9) {
    confidenceColor = "bg-[#4ade80]/15 text-[#4ade80]";
  } else if (decision.confidence >= 0.8) {
    confidenceColor = "bg-[#fbbf24]/15 text-[#fbbf24]";
  } else {
    confidenceColor = "bg-[#f97316]/15 text-[#f97316]";
  }

  const time = new Date(decision.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className="cursor-pointer hover:bg-v-surface/50 transition-colors"
      style={{ borderLeft: `3px solid ${impact.color}` }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header row */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="shrink-0 text-[9px] font-mono text-v-dim">
          {time}
        </span>
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-medium"
          style={{
            backgroundColor: `${impact.color}20`,
            color: impact.color,
          }}
        >
          {impact.label}
        </span>
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono ${confidenceColor}`}
        >
          {Math.round(decision.confidence * 100)}%
        </span>
        {decision.reversible && (
          <span className="text-[9px] text-v-dim" title="Reversible">
            {"\u21BA"}
          </span>
        )}
        <span className="ml-auto text-[9px] text-v-dim">
          {expanded ? "\u25BE" : "\u25B8"}
        </span>
      </div>

      {/* Decision text */}
      <div className="px-2 pb-1.5">
        <p className="text-[12px] text-v-textHi leading-snug">
          {decision.decision}
        </p>
      </div>

      {/* Expanded: rationale + related files */}
      {expanded && (
        <div className="px-2 pb-2 space-y-1.5 animate-fade-slide-in">
          {decision.rationale && (
            <div>
              <span className="text-[9px] font-mono text-v-dim uppercase tracking-wide">
                Rationale
              </span>
              <p className="text-[10.5px] text-v-dim leading-snug mt-0.5">
                {decision.rationale}
              </p>
            </div>
          )}
          {decision.relatedFiles.length > 0 && (
            <div>
              <span className="text-[9px] font-mono text-v-dim uppercase tracking-wide">
                Files
              </span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {decision.relatedFiles.map((f, i) => (
                  <span
                    key={i}
                    className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono text-v-dim bg-v-surface truncate max-w-[200px]"
                    title={f}
                  >
                    {f.split(/[/\\]/).pop()}
                  </span>
                ))}
              </div>
            </div>
          )}
          {decision.relatedTickets.length > 0 && (
            <div>
              <span className="text-[9px] font-mono text-v-dim uppercase tracking-wide">
                Tickets
              </span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {decision.relatedTickets.map((t, i) => (
                  <span
                    key={i}
                    className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono text-v-accent bg-v-accent/10"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
