import React, { useState, useCallback } from "react";
import { XCircle, RefreshCw, ChevronRight, ChevronDown } from "lucide-react";
import { useAppStore } from "../../stores";
import { commands } from "../../lib/tauri";
import type { ChatMessage } from "../../stores/types";

interface ErrorCardProps {
  message: ChatMessage;
}

export const ErrorCard = React.memo(function ErrorCard({
  message,
}: ErrorCardProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const data = message.cardData as
    | {
        errorMessage: string;
        fullError: string;
        sessionId: string;
      }
    | undefined;

  if (!data) return null;

  const onRetry = useCallback(() => {
    const store = useAppStore.getState();
    const session = store.agentSessions.get(data.sessionId);
    if (!session) return;

    // Find last user message
    const lastUserMsg = [...session.chatMessages]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Re-send via commands
    const conversationId = session.conversationId;
    if (conversationId) {
      commands
        .sendMessage({
          message: lastUserMsg.content,
          conversationId,
          workingDir: ".",
          agentSessionId: session.id,
        })
        .catch(console.error);
    }
  }, [data.sessionId]);

  // Read live state for disable logic
  const isRetryDisabled = useAppStore((s) => {
    const session = s.agentSessions.get(data.sessionId);
    if (!session) return true;
    if (session.isWorking) return true;
    const hasUserMsg = session.chatMessages.some((m) => m.role === "user");
    return !hasUserMsg;
  });

  return (
    <div className="bg-v-red/5 border border-v-red/30 rounded-lg px-3 py-2 my-1">
      <div className="flex items-center gap-2">
        <XCircle size={14} className="text-v-red shrink-0" />
        <span className="flex-1 text-[12px] text-v-textHi truncate">
          {data.errorMessage}
        </span>

        <button
          type="button"
          onClick={onRetry}
          disabled={isRetryDisabled}
          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-v-dim hover:text-v-text bg-v-surface border border-v-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={10} />
          Retry
        </button>

        <button
          type="button"
          onClick={() => setDetailsExpanded((prev) => !prev)}
          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-v-dim hover:text-v-text bg-v-surface border border-v-border transition-colors"
        >
          {detailsExpanded ? (
            <ChevronDown size={10} />
          ) : (
            <ChevronRight size={10} />
          )}
          {detailsExpanded ? "Hide Details" : "Show Details"}
        </button>
      </div>

      {detailsExpanded && (
        <div className="bg-v-bg rounded px-3 py-2 mt-1 text-[10px] font-mono text-v-dim overflow-x-auto max-h-[200px] overflow-y-auto animate-fade-slide-in">
          <pre className="whitespace-pre-wrap break-words">{data.fullError}</pre>
        </div>
      )}
    </div>
  );
});
