import React, { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { ChatMessage } from "../../stores/types";

interface InlineDecisionCardProps {
  message: ChatMessage;
}

const IMPACT_COLORS: Record<
  string,
  { border: string; bg: string; text: string; label: string }
> = {
  perf: {
    border: "border-l-v-cyan",
    bg: "bg-v-cyan/10",
    text: "text-v-cyan",
    label: "Perf",
  },
  accuracy: {
    border: "border-l-v-green",
    bg: "bg-v-green/10",
    text: "text-v-green",
    label: "Accuracy",
  },
  dx: {
    border: "border-l-v-accent",
    bg: "bg-v-accent/10",
    text: "text-v-accent",
    label: "DX",
  },
  security: {
    border: "border-l-v-red",
    bg: "bg-v-red/10",
    text: "text-v-red",
    label: "Security",
  },
  architecture: {
    border: "border-l-[#a78bfa]",
    bg: "bg-[#a78bfa]/10",
    text: "text-[#a78bfa]",
    label: "Arch",
  },
};

const DEFAULT_IMPACT = IMPACT_COLORS.dx;

function confidenceBadgeClass(confidence: number): string {
  const pct = confidence * 100;
  if (pct > 90) return "bg-[#4ade80]/15 text-[#4ade80]";
  if (pct >= 80) return "bg-[#fbbf24]/15 text-[#fbbf24]";
  return "bg-[#f97316]/15 text-[#f97316]";
}

export const InlineDecisionCard = React.memo(function InlineDecisionCard({
  message,
}: InlineDecisionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const data = message.cardData as
    | {
        decision: string;
        rationale: string;
        confidence: number;
        impactCategory: string;
        reversible: boolean;
        relatedFiles: string[];
      }
    | undefined;

  if (!data) return null;

  const impact = IMPACT_COLORS[data.impactCategory] ?? DEFAULT_IMPACT;
  const pct = Math.round(data.confidence * 100);
  const confClass = confidenceBadgeClass(data.confidence);

  return (
    <div
      className={`rounded-lg px-3 py-2 my-1 bg-v-surface/50 border-l-[3px] ${impact.border}`}
    >
      {/* Collapsed header row */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className={`shrink-0 text-[14px] ${impact.text}`}>
          {"\u25C6"}
        </span>
        <span className="flex-1 text-[12px] text-v-textHi truncate">
          {data.decision}
        </span>
        <span
          className={`shrink-0 inline-block px-1.5 py-0.5 rounded text-[9px] font-mono ${confClass}`}
        >
          {pct}%
        </span>
        <span
          className={`shrink-0 inline-block px-1.5 py-0.5 rounded text-[9px] font-mono ${impact.bg} ${impact.text}`}
        >
          {impact.label}
        </span>
        {expanded ? (
          <ChevronDown size={12} className="text-v-dim shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-v-dim shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-1.5 ml-5 space-y-1.5 animate-fade-slide-in">
          {data.rationale && (
            <div>
              <span className="text-[9px] font-mono text-v-dim uppercase tracking-wide">
                Rationale
              </span>
              <p className="text-[10.5px] text-v-dim leading-snug mt-0.5">
                {data.rationale}
              </p>
            </div>
          )}

          {data.relatedFiles.length > 0 && (
            <div>
              <span className="text-[9px] font-mono text-v-dim uppercase tracking-wide">
                Files
              </span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {data.relatedFiles.map((f, i) => (
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

          {data.reversible && (
            <div className="text-[9px] text-v-dim">
              {"\u21BA"} Reversible
            </div>
          )}
        </div>
      )}
    </div>
  );
});
