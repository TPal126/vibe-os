import { Plus } from "lucide-react";
import type { Project, ClaudeSessionState } from "../../stores/types";

interface EnhancedProjectCardProps {
  project: Project;
  sessions: Map<string, ClaudeSessionState>;
  onOpen: () => void;
  onOpenSession: (sessionId: string) => void;
}

const statusDotColor: Record<ClaudeSessionState["status"], string> = {
  working: "bg-v-green",
  "needs-input": "bg-v-orange",
  error: "bg-v-red",
  idle: "bg-v-dim",
};

export function EnhancedProjectCard({
  project,
  sessions,
  onOpen,
  onOpenSession,
}: EnhancedProjectCardProps) {
  const sessionList = Array.from(sessions.values());
  const activeCount = sessionList.filter((s) => s.status === "working" || s.status === "needs-input").length;
  const hasActive = activeCount > 0;

  return (
    <div
      className={`bg-v-surface border rounded-lg p-3.5 flex flex-col ${
        hasActive ? "border-v-accent" : "border-v-border"
      } hover:border-v-borderHi transition-colors`}
    >
      <div className="flex justify-between items-center mb-2.5">
        <button
          onClick={onOpen}
          className="text-xs font-semibold text-v-textHi hover:text-v-accentHi transition-colors text-left"
        >
          {project.name}
        </button>
        {hasActive ? (
          <span className="text-[8px] text-v-green bg-v-greenDim px-1.5 py-0.5 rounded">
            {activeCount} active
          </span>
        ) : (
          <span className="text-[8px] text-v-dim bg-v-surfaceHi px-1.5 py-0.5 rounded">
            idle
          </span>
        )}
      </div>

      <p className="text-[9px] text-v-dim mb-2.5 line-clamp-1">
        {project.summary || "No description"}
      </p>

      {sessionList.length > 0 && (
        <div className="border-t border-v-border pt-2 flex flex-col gap-1">
          {sessionList.slice(0, 4).map((session) => (
            <button
              key={session.id}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSession(session.id);
              }}
              className="flex items-center gap-1.5 px-1.5 py-1 bg-v-surfaceHi rounded hover:bg-v-borderHi/30 transition-colors text-left"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotColor[session.status]}`} />
              <span className="text-[9px] text-v-text truncate flex-1">
                {session.name}
              </span>
            </button>
          ))}
          {sessionList.length > 4 && (
            <span className="text-[8px] text-v-dim px-1.5">
              +{sessionList.length - 4} more
            </span>
          )}
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="mt-2 text-[8px] text-v-accent hover:text-v-accentHi flex items-center gap-1"
      >
        <Plus size={8} />
        New session
      </button>
    </div>
  );
}
