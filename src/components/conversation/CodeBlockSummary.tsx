import { useState, memo } from "react";
import { Code, ChevronDown, ChevronRight } from "lucide-react";
import { useAppStore } from "../../stores";

interface CodeBlockSummaryProps {
  language: string;
  code: string;
}

export const CodeBlockSummary = memo(function CodeBlockSummary({
  language,
  code,
}: CodeBlockSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const openUntitledFile = useAppStore((s) => s.openUntitledFile);
  const setEditorPanelOpen = useAppStore((s) => s.setEditorPanelOpen);

  const lineCount = code.split("\n").length;

  const handleViewCode = () => {
    openUntitledFile(code, language || "text");
    setEditorPanelOpen(true);
  };

  return (
    <div className="mt-2 rounded-lg border border-v-border overflow-hidden">
      <div className="flex items-center gap-2 bg-v-surface px-3 py-1.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-v-dim hover:text-v-text transition-colors"
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Code size={12} className="text-v-dim shrink-0" />
        <span className="flex-1 text-[11px] text-v-dim font-mono truncate">
          {language || "text"} -- {lineCount} line{lineCount !== 1 ? "s" : ""}
        </span>
        <button
          onClick={handleViewCode}
          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-v-accent bg-v-accent/10 hover:bg-v-accent/20 transition-colors"
          title="Open in editor panel"
        >
          <Code size={10} />
          View Code
        </button>
      </div>
      {expanded && (
        <pre className="bg-v-bg px-3 py-2 overflow-x-auto border-t border-v-border max-h-[200px] overflow-y-auto">
          <code className="text-[11px] font-mono text-v-text/90 leading-snug">
            {code}
          </code>
        </pre>
      )}
    </div>
  );
});
