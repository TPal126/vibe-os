import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../stores";
import type { AuditEntry } from "../../stores/types";
import { Download } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  FILE_CREATE:    "text-v-green",
  FILE_MODIFY:    "text-v-green",
  FILE_SAVE:      "text-v-green",
  TEST_RUN:       "text-v-cyan",
  PROMPT_SENT:    "text-v-accent",
  SESSION_START:  "text-v-orange",
  SESSION_END:    "text-v-orange",
  SKILL_TOGGLE:   "text-[#f97316]",
  REPO_ACTIVATE:  "text-v-accent",
  DECISION_MADE:  "text-v-orange",
  PREVIEW_UPDATE: "text-[#f97316]",
  ERROR:          "text-v-red",
};

const ACTOR_STYLES: Record<string, string> = {
  agent:  "text-v-accent",
  user:   "text-v-green",
  system: "text-v-dim",
};

export function AuditLog() {
  const { auditEntries, auditLoading, loadAuditLog, exportAuditLog } =
    useAppStore(
      useShallow((s) => ({
        auditEntries: s.auditEntries,
        auditLoading: s.auditLoading,
        loadAuditLog: s.loadAuditLog,
        exportAuditLog: s.exportAuditLog,
      })),
    );

  useEffect(() => {
    loadAuditLog();
  }, [loadAuditLog]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Export bar */}
      <div className="flex items-center justify-end gap-1 px-2 py-1 border-b border-v-border">
        <button
          onClick={() => exportAuditLog("json")}
          className="text-[9px] font-mono text-v-dim hover:text-v-text px-1.5 py-0.5 rounded hover:bg-v-surface transition-colors"
          title="Export as JSON"
        >
          JSON
        </button>
        <button
          onClick={() => exportAuditLog("csv")}
          className="text-[9px] font-mono text-v-dim hover:text-v-text px-1.5 py-0.5 rounded hover:bg-v-surface transition-colors"
          title="Export as CSV"
        >
          CSV
        </button>
        <Download size={10} className="text-v-dim" />
      </div>

      {/* Audit entries */}
      <div className="flex-1 overflow-y-auto">
        {auditLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">Loading audit log...</p>
          </div>
        ) : auditEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">
              All actions will be logged here during sessions
            </p>
          </div>
        ) : (
          <div className="divide-y divide-v-border/20">
            {auditEntries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const actionColor = ACTION_COLORS[entry.actionType] || "text-v-dim";
  const actorColor = ACTOR_STYLES[entry.actor] || "text-v-dim";

  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-start gap-2 px-2 py-1 hover:bg-v-surface/50 transition-colors">
      <span className="shrink-0 text-[9px] font-mono text-v-dim pt-px">
        {time}
      </span>
      <span
        className={`shrink-0 text-[9px] font-mono font-bold uppercase pt-px ${actionColor}`}
      >
        {entry.actionType}
      </span>
      <span className="flex-1 min-w-0 text-[10.5px] text-v-text break-words leading-snug">
        {entry.detail}
      </span>
      <span
        className={`shrink-0 text-[9px] font-mono pt-px ${actorColor}`}
      >
        {entry.actor}
      </span>
    </div>
  );
}
