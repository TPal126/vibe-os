import type { Project, ClaudeSessionState } from "../../stores/types";

interface ProjectCardProps {
  project: Project;
  session: ClaudeSessionState | undefined;
  onClick: () => void;
}

const statusConfig = {
  idle: { color: "bg-v-dim", text: "text-v-dim", label: "Idle", pulse: false },
  working: { color: "bg-v-accent", text: "text-v-accent", label: "Working", pulse: true },
  "needs-input": { color: "bg-v-orange", text: "text-v-orange", label: "Needs input", pulse: true },
  error: { color: "bg-v-red", text: "text-v-red", label: "Error", pulse: false },
  done: { color: "bg-v-green", text: "text-v-green", label: "Done", pulse: false },
} as const;

type DisplayStatus = keyof typeof statusConfig;

function deriveDisplayStatus(session: ClaudeSessionState | undefined): DisplayStatus {
  if (!session) return "idle";
  if (session.status !== "idle") return session.status;
  // Derive "done" when idle but last event was a successful result
  const lastEvent = session.agentEvents[session.agentEvents.length - 1];
  if (lastEvent?.event_type === "result") return "done";
  return "idle";
}

export function ProjectCard({ project, session, onClick }: ProjectCardProps) {
  const displayStatus = deriveDisplayStatus(session);
  const config = statusConfig[displayStatus];

  return (
    <button
      onClick={onClick}
      className="bg-v-surface border border-v-border rounded-lg p-5 cursor-pointer hover:border-v-borderHi hover:bg-v-surfaceHi transition-colors text-left w-full"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${config.color} ${config.pulse ? "animate-dot-pulse" : ""}`}
        />
        <span className="text-v-textHi text-sm font-medium truncate">
          {project.name}
        </span>
      </div>
      <p className="text-v-dim text-[11px] truncate mt-1.5 ml-[18px]">
        {project.summary || "No activity yet"}
      </p>
      <span className={`text-[10px] ${config.text} mt-2 block ml-[18px]`}>
        {config.label}
      </span>
    </button>
  );
}
