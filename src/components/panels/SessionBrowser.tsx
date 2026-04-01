import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { commands, type ClaudeCodeSessionInfo } from "../../lib/tauri";
import { PanelHeader } from "../layout/PanelHeader";
import { Monitor, RefreshCw, Link, Loader2, AlertCircle } from "lucide-react";

function formatAge(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  if (isNaN(created)) return "unknown";
  const diffSec = Math.floor((Date.now() - created) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ${diffMin % 60}m ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "running":
    case "active":
      return "text-v-green";
    case "backgrounded":
    case "paused":
      return "text-v-orange";
    case "stopped":
    case "completed":
      return "text-v-dim";
    default:
      return "text-v-dim";
  }
}

export function SessionBrowser() {
  const { createClaudeSessionLocal, setActiveClaudeSessionId } = useAppStore(
    useShallow((s) => ({
      createClaudeSessionLocal: s.createClaudeSessionLocal,
      setActiveClaudeSessionId: s.setActiveClaudeSessionId,
    })),
  );

  const [sessions, setSessions] = useState<ClaudeCodeSessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await commands.listClaudeCodeSessions();
      setSessions(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + poll every 10 seconds
  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10_000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleAttach = async (session: ClaudeCodeSessionInfo) => {
    setAttachingId(session.id);
    try {
      const claudeSessionId = crypto.randomUUID();
      const dirName = session.working_dir.split(/[/\\]/).pop() || "attached";
      createClaudeSessionLocal(claudeSessionId, `${dirName} (attached)`);
      setActiveClaudeSessionId(claudeSessionId);
      await commands.attachClaudeCodeSession(session.id, claudeSessionId);
    } catch (err) {
      setError(`Attach failed: ${String(err)}`);
    } finally {
      setAttachingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        title="CLAUDE CODE SESSIONS"
        icon={<Monitor size={12} />}
        actions={
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="p-1 text-v-dim hover:text-v-text transition-colors disabled:opacity-50"
            title="Refresh sessions"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {error && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-v-red/10 border border-v-red/20 rounded text-[10px] text-v-red">
            <AlertCircle size={10} className="shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {!loading && sessions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-8 text-v-dim">
            <Monitor size={24} className="mb-2 opacity-40" />
            <p className="text-[11px]">No active Claude Code sessions</p>
            <p className="text-[9px] mt-1 opacity-60">
              Sessions started via Claude CLI will appear here
            </p>
          </div>
        )}

        {sessions.map((session) => (
          <div
            key={session.id}
            className="bg-v-surface rounded px-2.5 py-2 border border-v-border hover:border-v-borderHi transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`text-[9px] font-mono uppercase font-semibold ${statusColor(session.status)}`}
                >
                  {session.status}
                </span>
                <span className="text-[9px] font-mono text-v-dim truncate">
                  {session.id.slice(0, 12)}...
                </span>
              </div>
              <span className="text-[9px] font-mono text-v-dim shrink-0">
                {formatAge(session.created_at)}
              </span>
            </div>

            <div className="text-[10px] font-mono text-v-text truncate mb-1.5">
              {session.working_dir}
            </div>

            <button
              onClick={() => handleAttach(session)}
              disabled={attachingId === session.id}
              className="flex items-center gap-1 px-2 py-1 bg-v-accent/15 text-v-accent text-[10px] font-medium rounded hover:bg-v-accent/25 transition-colors disabled:opacity-50"
            >
              {attachingId === session.id ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Link size={10} />
              )}
              {attachingId === session.id ? "Attaching..." : "Attach"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
