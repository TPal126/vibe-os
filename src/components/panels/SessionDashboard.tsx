import { useState, useEffect } from "react";
import { useAppStore } from "../../stores";
import { PanelHeader } from "../layout/PanelHeader";
import { formatTokens, TOKEN_BUDGET, getBudgetTextColor } from "../../lib/tokens";
import {
  BarChart3,
  Target,
  FolderGit2,
  BookOpen,
  Cpu,
  Clock,
  MessageSquare,
  FileEdit,
} from "lucide-react";
import type { AgentEventType } from "../../stores/types";

function eventColor(type: AgentEventType): string {
  switch (type) {
    case "decision":
      return "text-v-accent";
    case "file_create":
      return "text-v-green";
    case "file_modify":
      return "text-v-cyan";
    case "think":
      return "text-v-dim";
    case "error":
      return "text-v-red";
    case "test_run":
      return "text-v-orange";
    case "result":
      return "text-v-green";
    default:
      return "text-v-dim";
  }
}

export function SessionDashboard() {
  const sessionGoal = useAppStore((s) => s.sessionGoal);
  const setSessionGoal = useAppStore((s) => s.setSessionGoal);
  const activeRepos = useAppStore((s) => s.repos.filter((r) => r.active));
  const activeSkills = useAppStore((s) => s.skills.filter((sk) => sk.active));
  const totalTokens = useAppStore((s) => s.composedPrompt?.totalTokens ?? 0);
  const messageCount = useAppStore((s) => s.chatMessages.length);
  const filesModified = useAppStore(
    (s) =>
      new Set(
        s.agentEvents
          .filter(
            (e) =>
              e.event_type === "file_modify" || e.event_type === "file_create",
          )
          .map((e) => e.content),
      ).size,
  );
  const activeSession = useAppStore((s) => s.activeSession);
  const recentEvents = useAppStore((s) => {
    return [...s.agentEvents].reverse().slice(0, 20);
  });

  const tokenRatio = totalTokens / TOKEN_BUDGET.softLimit;

  const [elapsed, setElapsed] = useState("0:00:00");

  useEffect(() => {
    if (!activeSession) {
      setElapsed("0:00:00");
      return;
    }
    const startTime = new Date(activeSession.startedAt).getTime();
    const tick = () => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader title="SESSION DASHBOARD" icon={<BarChart3 size={12} />} />
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Section 1: Editable Goal */}
        <div className="bg-v-surface rounded px-2 py-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={10} className="text-v-accent shrink-0" />
            <span className="text-[9px] font-mono text-v-dim uppercase tracking-wider">
              Goal
            </span>
          </div>
          <input
            type="text"
            value={sessionGoal}
            onChange={(e) => setSessionGoal(e.target.value)}
            placeholder="What are you working on?"
            className="w-full bg-transparent text-[11px] text-v-textHi font-sans placeholder:text-v-dim/50 outline-none border-b border-transparent focus:border-v-accent/30 transition-colors"
          />
        </div>

        {/* Section 2: Context Summary + Session Stats */}
        <div className="grid grid-cols-2 gap-2">
          {/* Left column: Context Summary */}
          <div className="bg-v-surface rounded px-2 py-1.5 space-y-1">
            <div className="text-[9px] font-mono text-v-dim uppercase tracking-wider mb-1">
              Context
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-v-dim">
              <FolderGit2 size={10} className="shrink-0" />
              <span>{activeRepos.length} repos active</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-v-dim">
              <BookOpen size={10} className="shrink-0" />
              <span>{activeSkills.length} skills loaded</span>
            </div>
            <div
              className={`flex items-center gap-1.5 text-[10px] font-mono ${getBudgetTextColor(tokenRatio)}`}
            >
              <Cpu size={10} className="shrink-0" />
              <span>
                ~{formatTokens(totalTokens)} /{" "}
                {formatTokens(TOKEN_BUDGET.softLimit)} tokens
              </span>
            </div>
          </div>

          {/* Right column: Session Stats */}
          <div className="bg-v-surface rounded px-2 py-1.5 space-y-1">
            <div className="text-[9px] font-mono text-v-dim uppercase tracking-wider mb-1">
              Stats
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-v-dim">
              <Clock size={10} className="shrink-0" />
              <span>Elapsed: {elapsed}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-v-dim">
              <MessageSquare size={10} className="shrink-0" />
              <span>Messages: {messageCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-v-dim">
              <Cpu size={10} className="shrink-0" />
              <span>~{formatTokens(totalTokens)} tokens</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-v-dim">
              <FileEdit size={10} className="shrink-0" />
              <span>{filesModified} files modified</span>
            </div>
          </div>
        </div>

        {/* Section 3: Activity Feed */}
        <div className="bg-v-surface rounded px-2 py-1.5">
          <div className="text-[9px] font-mono text-v-dim uppercase tracking-wider mb-1">
            Activity
          </div>
          <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
            {recentEvents.length === 0 ? (
              <p className="text-[10px] text-v-dim/50">No activity yet</p>
            ) : (
              recentEvents.map((event, i) => (
                <div key={i} className="flex items-start gap-1.5 py-0.5">
                  <span className="text-[9px] font-mono text-v-dim shrink-0 w-[52px]">
                    {new Date(event.timestamp).toLocaleTimeString("en-US", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span
                    className={`text-[9px] font-mono shrink-0 uppercase w-[72px] ${eventColor(event.event_type)}`}
                  >
                    {event.event_type.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-v-text truncate">
                    {event.content}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
