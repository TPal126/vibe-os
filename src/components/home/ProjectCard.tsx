import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { Project, AgentSessionState, BuildStatus } from "../../stores/types";
import { PreviewThumbnail } from "./PreviewThumbnail";

interface ProjectCardProps {
  project: Project;
  session: AgentSessionState | undefined;
  onClick: () => void;
}

const statusConfig = {
  idle: { color: "text-v-dim", bg: "bg-v-dim", label: "Idle", pulse: false, icon: null },
  working: { color: "text-v-accent", bg: "bg-v-accent", label: "Working", pulse: true, icon: null },
  "needs-input": { color: "text-v-orange", bg: "bg-v-orange", label: "Needs input", pulse: true, icon: AlertCircle },
  error: { color: "text-v-red", bg: "bg-v-red", label: "Error", pulse: false, icon: XCircle },
  done: { color: "text-v-green", bg: "bg-v-green", label: "Done", pulse: false, icon: CheckCircle },
} as const;

type DisplayStatus = keyof typeof statusConfig;

function deriveDisplayStatus(session: AgentSessionState | undefined): DisplayStatus {
  if (!session) return "idle";
  if (session.status !== "idle") return session.status;
  // Derive "done" when idle but last event was a successful result
  const lastEvent = session.agentEvents[session.agentEvents.length - 1];
  if (lastEvent?.event_type === "result") return "done";
  return "idle";
}

function TestBadge({ summary }: { summary: { passed: number; failed: number; total: number } }) {
  const allPassed = summary.failed === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
        allPassed
          ? "bg-v-green/10 text-v-green"
          : "bg-v-red/10 text-v-red"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${allPassed ? "bg-v-green" : "bg-v-red"}`} />
      {allPassed ? `${summary.passed}/${summary.total} passing` : `${summary.failed} failed`}
    </span>
  );
}

function BuildStatusLine({ status, text }: { status: BuildStatus; text: string | null }) {
  if (status === "idle" || !text) return null;

  const statusStyles = {
    building: "text-v-accent animate-pulse",
    running: "text-v-green",
    failed: "text-v-red",
  } as const;

  return (
    <p className={`text-[10px] font-mono truncate ${statusStyles[status]}`}>
      {text}
    </p>
  );
}

export function ProjectCard({ project, session, onClick }: ProjectCardProps) {
  const displayStatus = deriveDisplayStatus(session);
  const config = statusConfig[displayStatus];

  const summaryText = (() => {
    if (displayStatus === "needs-input" && session?.attentionPreview) {
      return session.attentionPreview;
    }
    if (displayStatus === "error" && session?.agentError) {
      return session.agentError.split("\n")[0].slice(0, 60);
    }
    return project.summary || "No activity yet";
  })();

  const StatusIcon = config.icon;

  return (
    <button
      onClick={onClick}
      className="bg-v-surface border border-v-border rounded-lg p-5 cursor-pointer hover:border-v-borderHi hover:bg-v-surfaceHi transition-colors text-left w-full"
    >
      <div className="flex items-center gap-2.5">
        {StatusIcon ? (
          <StatusIcon size={14} className={`shrink-0 ${config.color}`} />
        ) : (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${config.bg} ${config.pulse ? "animate-dot-pulse" : ""}`}
          />
        )}
        <span className="text-v-textHi text-sm font-medium truncate">
          {project.name}
        </span>
      </div>
      <p className={`text-[11px] truncate mt-1.5 ml-[18px] ${
        displayStatus === "needs-input" ? "text-v-orange/80" :
        displayStatus === "error" ? "text-v-red/80" :
        "text-v-dim"
      }`}>
        {summaryText}
      </p>

      {/* Outcome badges: test results + build status */}
      {session && (session.testSummary || session.buildStatus !== "idle") && (
        <div className="mt-1.5 ml-[18px] flex flex-col gap-1">
          {session.testSummary && <TestBadge summary={session.testSummary} />}
          <BuildStatusLine status={session.buildStatus} text={session.buildStatusText} />
        </div>
      )}

      {/* Preview thumbnail */}
      {session?.previewUrl && <PreviewThumbnail url={session.previewUrl} />}

      <span className={`text-[10px] ${config.color} mt-2 block ml-[18px]`}>
        {config.label}
      </span>
    </button>
  );
}
