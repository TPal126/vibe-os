import { useCallback } from "react";
import { DiffEditor, type BeforeMount } from "@monaco-editor/react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../stores";
import type { PendingDiff } from "../../stores/types";
import { VIBE_OS_THEME, VIBE_OS_THEME_NAME } from "../../lib/monacoTheme";
import { Check, X, FileCode } from "lucide-react";

export function DiffView() {
  const { pendingDiffs, activeDiffId, acceptDiff, rejectDiff, setActiveDiff } =
    useAppStore(
      useShallow((s) => ({
        pendingDiffs: s.pendingDiffs,
        activeDiffId: s.activeDiffId,
        acceptDiff: s.acceptDiff,
        rejectDiff: s.rejectDiff,
        setActiveDiff: s.setActiveDiff,
      })),
    );

  const activeDiff = pendingDiffs.find((d) => d.id === activeDiffId) ?? null;

  const handleBeforeMount: BeforeMount = useCallback((m) => {
    m.editor.defineTheme(VIBE_OS_THEME_NAME, VIBE_OS_THEME);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar: pending diffs list */}
      <div className="w-48 shrink-0 border-r border-v-border flex flex-col overflow-hidden">
        <div className="px-2 py-1.5 border-b border-v-border">
          <span className="text-[10px] font-mono text-v-dim uppercase tracking-wider">
            Proposed Changes
          </span>
          {pendingDiffs.length > 0 && (
            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-mono text-v-accent bg-v-accent/10">
              {pendingDiffs.length}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {pendingDiffs.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-[10px] text-v-dim">No pending changes</p>
            </div>
          ) : (
            <div className="divide-y divide-v-border/30">
              {pendingDiffs.map((diff) => (
                <DiffListItem
                  key={diff.id}
                  diff={diff}
                  isActive={diff.id === activeDiffId}
                  onSelect={() => setActiveDiff(diff.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main: diff editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeDiff ? (
          <>
            {/* Accept/Reject toolbar */}
            <div className="flex items-center justify-between px-2 py-1 border-b border-v-border bg-v-bgAlt">
              <span className="text-[10px] font-mono text-v-text truncate">
                {activeDiff.filePath.split(/[/\\]/).pop()}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => acceptDiff(activeDiff.id)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono text-v-green bg-v-green/10 hover:bg-v-green/20 transition-colors"
                  title="Accept changes"
                >
                  <Check size={10} />
                  Accept
                </button>
                <button
                  onClick={() => rejectDiff(activeDiff.id)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono text-v-red bg-v-red/10 hover:bg-v-red/20 transition-colors"
                  title="Reject changes"
                >
                  <X size={10} />
                  Reject
                </button>
              </div>
            </div>

            {/* Monaco Diff Editor */}
            <div className="flex-1 overflow-hidden">
              <DiffEditor
                original={activeDiff.originalContent}
                modified={activeDiff.proposedContent}
                language="python"
                theme={VIBE_OS_THEME_NAME}
                beforeMount={handleBeforeMount}
                options={{
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 20,
                  readOnly: true,
                  renderSideBySide: true,
                  scrollBeyondLastLine: false,
                  minimap: { enabled: false },
                  automaticLayout: true,
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileCode size={24} className="text-v-dim mx-auto mb-2" />
              <p className="text-[11px] text-v-dim">
                {pendingDiffs.length > 0
                  ? "Select a proposed change to review"
                  : "Agent-proposed file changes will appear here"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DiffListItem({
  diff,
  isActive,
  onSelect,
}: {
  diff: PendingDiff;
  isActive: boolean;
  onSelect: () => void;
}) {
  const fileName = diff.filePath.split(/[/\\]/).pop() || diff.filePath;
  const time = new Date(diff.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-2 py-1.5 transition-colors ${
        isActive
          ? "bg-v-accent/10 border-l-2 border-v-accent"
          : "hover:bg-v-surface/50"
      }`}
    >
      <p className="text-[10px] font-mono text-v-textHi truncate">
        {fileName}
      </p>
      <p className="text-[9px] text-v-dim">{time}</p>
    </button>
  );
}
