import { Plus, X } from "lucide-react";
import type { Project, AgentSessionState } from "../../stores/types";

interface EnhancedProjectCardProps {
  project: Project;
  sessions: Map<string, AgentSessionState>;
  onOpen: () => void;
  onOpenSession: (sessionId: string) => void;
  onDelete: () => void;
}

const statusDotColor: Record<AgentSessionState["status"], string> = {
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
  onDelete,
}: EnhancedProjectCardProps) {
  const sessionList = Array.from(sessions.values());
  const activeCount = sessionList.filter((s) => s.status === "working" || s.status === "needs-input").length;
  const hasActive = activeCount > 0;

  return (
    <div
      className={`bg-v-surface border rounded-lg p-3.5 flex flex-col group ${
        hasActive ? "border-v-accent" : "border-v-border"
      } hover:border-v-borderHi transition-colors`}
    >
      <div className="flex justify-between items-center mb-2.5">
        <button
          onClick={onOpen}
          className="text-xs font-semibold text-v-textHi hover:text-v-accentHi transition-colors text-left truncate flex-1"
        >
          {project.name}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {hasActive ? (
            <span className="text-[8px] text-v-green bg-v-greenDim px-1.5 py-0.5 rounded">
              {activeCount} active
            </span>
          ) : (
            <span className="text-[8px] text-v-dim bg-v-surfaceHi px-1.5 py-0.5 rounded">
              idle
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-0.5 text-v-dim hover:text-v-red transition-colors opacity-0 group-hover:opacity-100"
            title="Delete project"
          >
            <X size={10} />
          </button>
        </div>
      </div>

      <p className="text-[9px] text-v-dim mb-2.5 line-clamp-1">
        {project.summary || "No description"}
      </p>

      {/* Resource summary chips */}
      <div className="flex gap-1 flex-wrap mb-2">
        {(project.linkedRepoIds?.length ?? 0) > 0 && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-v-accent/10 text-v-accent">
            {project.linkedRepoIds.length} repo{project.linkedRepoIds.length !== 1 ? "s" : ""}
          </span>
        )}
        {(project.linkedSkillIds?.length ?? 0) > 0 && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-v-cyan/10 text-v-cyan">
            {project.linkedSkillIds.length} skill{project.linkedSkillIds.length !== 1 ? "s" : ""}
          </span>
        )}
        {(project.linkedAgentNames?.length ?? 0) > 0 && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-v-orange/10 text-v-orange">
            {project.linkedAgentNames.length} agent{project.linkedAgentNames.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

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
