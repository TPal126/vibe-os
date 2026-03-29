import { useCallback } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { commands } from "../../lib/tauri";
import { Dot } from "../shared/Dot";
import { Plus, X } from "lucide-react";
import type { ClaudeSessionState } from "../../stores/types";

function statusDotColor(
  status: ClaudeSessionState["status"],
): string {
  switch (status) {
    case "working":
      return "bg-v-green";
    case "needs-input":
      return "bg-v-orange";
    case "error":
      return "bg-v-red";
    default:
      return "bg-v-dim";
  }
}

function statusPulse(status: ClaudeSessionState["status"]): boolean {
  return status === "working" || status === "needs-input";
}

export function SessionTabs() {
  const {
    claudeSessions,
    activeClaudeSessionId,
    setActiveClaudeSessionId,
    createClaudeSessionLocal,
    removeClaudeSession,
    activeSessionId,
  } = useAppStore(
    useShallow((s) => ({
      claudeSessions: s.claudeSessions,
      activeClaudeSessionId: s.activeClaudeSessionId,
      setActiveClaudeSessionId: s.setActiveClaudeSessionId,
      createClaudeSessionLocal: s.createClaudeSessionLocal,
      removeClaudeSession: s.removeClaudeSession,
      activeSessionId: s.activeSession?.id ?? null,
    })),
  );

  const sessions = Array.from(claudeSessions.values());

  const handleNewSession = useCallback(async () => {
    try {
      const appSessionId = activeSessionId;
      if (!appSessionId) {
        console.error("No active app session for claude session creation");
        return;
      }
      const name = `Session ${sessions.length + 1}`;
      const result = await commands.createClaudeSession(appSessionId, name);
      createClaudeSessionLocal(result.id, result.name ?? name);
      setActiveClaudeSessionId(result.id);
    } catch (err) {
      console.error("Failed to create Claude session:", err);
    }
  }, [
    activeSessionId,
    sessions.length,
    createClaudeSessionLocal,
    setActiveClaudeSessionId,
  ]);

  const handleClose = useCallback(
    async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await commands.closeClaudeSession(sessionId);
      } catch {
        // Session may already be closed on backend
      }
      removeClaudeSession(sessionId);
    },
    [removeClaudeSession],
  );

  // Empty state
  if (sessions.length === 0) {
    return (
      <div className="flex items-center border-b border-v-border bg-v-bg px-2 py-1">
        <button
          onClick={handleNewSession}
          className="flex items-center gap-1 text-[11px] text-v-dim hover:text-v-text transition-colors"
        >
          <Plus size={12} />
          <span>New Session</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center border-b border-v-border bg-v-bg overflow-x-auto">
      {sessions.map((session) => {
        const isActive = session.id === activeClaudeSessionId;
        return (
          <button
            key={session.id}
            onClick={() => setActiveClaudeSessionId(session.id)}
            className={`group flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] shrink-0 border-b-2 transition-colors ${
              isActive
                ? "font-semibold text-v-textHi border-v-accent bg-v-surface/50"
                : "font-normal text-v-dim border-transparent hover:text-v-text hover:bg-v-surface/30"
            }`}
          >
            <Dot
              color={statusDotColor(session.status)}
              pulse={statusPulse(session.status)}
            />
            <span className="max-w-[100px] truncate">{session.name}</span>
            <span
              onClick={(e) => handleClose(session.id, e)}
              className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded hover:bg-v-border/50 transition-opacity"
              title="Close session"
            >
              <X size={10} />
            </span>
          </button>
        );
      })}
      <button
        onClick={handleNewSession}
        className="flex items-center px-2 py-1.5 text-v-dim hover:text-v-text transition-colors shrink-0"
        title="New session"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
