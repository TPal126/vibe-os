import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { extractCodeBlocks } from "../../lib/eventParser";
import { commands } from "../../lib/tauri";
import { IconButton } from "../shared/IconButton";
import { SessionTabs } from "./SessionTabs";
import { Send, Square, AlertTriangle, RefreshCw } from "lucide-react";
import { ActivityLine } from "../conversation/ActivityLine";
import { OutcomeCard } from "../conversation/OutcomeCard";
import { ErrorCard } from "../conversation/ErrorCard";
import { InlineDecisionCard } from "../conversation/InlineDecisionCard";
import { InlinePreviewCard } from "../conversation/InlinePreviewCard";
import { TestDetailCard } from "../conversation/TestDetailCard";
import { TaskProgressCard } from "../conversation/TaskProgressCard";
import { CodeBlockSummary } from "../conversation/CodeBlockSummary";
import type { ChatMessage } from "../../stores/types";

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const codeBlocks = !isUser ? extractCodeBlocks(message.content) : [];

  const textContent = !isUser
    ? message.content.replace(/```\w*\n[\s\S]*?```/g, "").trim()
    : message.content;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
          isUser
            ? "bg-v-accent/20 text-v-textHi"
            : isSystem
              ? "bg-v-orange/10 text-v-orange border border-v-orange/20"
              : "bg-v-surfaceHi text-v-text"
        }`}
      >
        {textContent && (
          <div className="whitespace-pre-wrap break-words">{textContent}</div>
        )}

        {codeBlocks.map((block, idx) => (
          <CodeBlockSummary
            key={idx}
            language={block.language}
            code={block.code}
          />
        ))}

        <div
          className={`text-[9px] mt-1 ${
            isUser ? "text-v-accent/50" : "text-v-dim/50"
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

export function ClaudeChat() {
  const {
    claudeSessions,
    activeClaudeSessionId,
    composedPrompt,
    addSessionChatMessage,
    createClaudeSessionLocal,
    setActiveClaudeSessionId,
    activeSessionId,
    claudeCliAvailable,
    claudeCliError,
    validateClaudeCli,
  } = useAppStore(
    useShallow((s) => ({
      claudeSessions: s.claudeSessions,
      activeClaudeSessionId: s.activeClaudeSessionId,
      composedPrompt: s.composedPrompt,
      addSessionChatMessage: s.addSessionChatMessage,
      createClaudeSessionLocal: s.createClaudeSessionLocal,
      setActiveClaudeSessionId: s.setActiveClaudeSessionId,
      activeSessionId: s.activeSession?.id ?? null,
      claudeCliAvailable: s.claudeCliAvailable,
      claudeCliError: s.claudeCliError,
      validateClaudeCli: s.validateClaudeCli,
    }))
  );

  // Derive state from active session
  const activeSession = activeClaudeSessionId
    ? claudeSessions.get(activeClaudeSessionId)
    : undefined;
  const chatMessages = activeSession?.chatMessages ?? [];
  const isWorking = activeSession?.isWorking ?? false;
  const conversationId = activeSession?.conversationId ?? null;
  const attentionMessageId = activeSession?.attentionMessageId ?? null;

  const [input, setInput] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const attentionScrollDone = useRef(false);
  const showCliBanner = claudeCliAvailable === false && !bannerDismissed;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isWorking]);

  // Auto-scroll to attention message
  useEffect(() => {
    if (attentionMessageId && !attentionScrollDone.current) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`msg-${attentionMessageId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-v-orange/50");
          setTimeout(() => el.classList.remove("ring-2", "ring-v-orange/50"), 2000);
        }
        attentionScrollDone.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [attentionMessageId]);

  // Reset scroll flag when switching sessions
  useEffect(() => {
    attentionScrollDone.current = false;
  }, [activeClaudeSessionId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isWorking || !activeSessionId) return;

    // Clear attention when user engages
    if (activeClaudeSessionId) {
      useAppStore.getState().clearSessionAttention(activeClaudeSessionId);
    }

    // Auto-create a claude session if none exists
    let sessionId = activeClaudeSessionId;
    if (!sessionId) {
      try {
        const name = "Session 1";
        const result = await commands.createClaudeSession(activeSessionId, name);
        createClaudeSessionLocal(result.id, result.name ?? name);
        setActiveClaudeSessionId(result.id);
        sessionId = result.id;
      } catch (err) {
        console.error("Failed to auto-create session:", err);
        return;
      }
    }

    addSessionChatMessage(sessionId, {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    });

    setInput("");

    try {
      const workingDir = ".";

      if (conversationId) {
        await commands.sendMessage({
          message: text,
          conversationId: conversationId,
          workingDir: workingDir,
          claudeSessionId: sessionId,
        });
      } else {
        await commands.startClaude({
          working_dir: workingDir,
          message: text,
          system_prompt: composedPrompt?.full || undefined,
          conversation_id: undefined,
          claude_session_id: sessionId,
        });
      }
    } catch (err) {
      addSessionChatMessage(sessionId, {
        id: crypto.randomUUID(),
        role: "system",
        content: `Error: ${err}`,
        timestamp: new Date().toISOString(),
      });
    }
  }, [
    input,
    isWorking,
    activeSessionId,
    activeClaudeSessionId,
    conversationId,
    composedPrompt,
    addSessionChatMessage,
    createClaudeSessionLocal,
    setActiveClaudeSessionId,
  ]);

  const handleCancel = useCallback(async () => {
    if (activeClaudeSessionId) {
      try {
        await commands.cancelClaude(activeClaudeSessionId);
      } catch (err) {
        console.error("Failed to cancel:", err);
      }
    }
  }, [activeClaudeSessionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const hasActiveSession = !!activeClaudeSessionId;

  const handleRetryValidation = useCallback(async () => {
    setRetrying(true);
    try {
      await validateClaudeCli();
      // If validation succeeds, dismiss the banner
      setBannerDismissed(true);
    } finally {
      setRetrying(false);
    }
  }, [validateClaudeCli]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SessionTabs />

      {showCliBanner && (
        <div className="shrink-0 mx-2 mt-2 rounded-lg border border-v-orange/30 bg-v-orange/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-v-orange shrink-0" />
            <p className="text-[11px] font-sans text-v-dim flex-1">
              Could not verify Claude CLI — you can still try chatting.
            </p>
            <button
              onClick={handleRetryValidation}
              disabled={retrying}
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-v-dim hover:text-v-text bg-v-surface border border-v-border transition-colors disabled:opacity-50"
            >
              <RefreshCw size={10} className={retrying ? "animate-spin" : ""} />
              {retrying ? "..." : "Retry"}
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="shrink-0 text-v-dim hover:text-v-text text-[10px] px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-2">
        {!hasActiveSession && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">
              Click '+' above to start a new Claude session
            </p>
          </div>
        )}

        {hasActiveSession && chatMessages.length === 0 && !isWorking && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">
              Send a message to start a conversation with Claude
            </p>
          </div>
        )}

        {chatMessages.map((msg) => {
          const rendered = (() => {
            switch (msg.cardType) {
              case "activity":
                return <ActivityLine key={msg.id} message={msg} />;
              case "outcome":
                return <OutcomeCard key={msg.id} message={msg} />;
              case "error":
                return <ErrorCard key={msg.id} message={msg} />;
              case "decision":
                return <InlineDecisionCard key={msg.id} message={msg} />;
              case "preview":
                return <InlinePreviewCard key={msg.id} message={msg} />;
              case "test-detail":
                return <TestDetailCard key={msg.id} message={msg} />;
              case "task-progress":
                return (
                  <TaskProgressCard
                    key={msg.id}
                    tasks={(msg.cardData as { tasks?: import("../../stores/types").ClaudeTask[] })?.tasks ?? []}
                  />
                );
              default:
                return <MessageBubble key={msg.id} message={msg} />;
            }
          })();
          if (msg.id === attentionMessageId) {
            return <div key={msg.id} id={`msg-${msg.id}`}>{rendered}</div>;
          }
          return rendered;
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-v-border p-2">
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasActiveSession
                ? "Message Claude... (Enter to send, Shift+Enter for newline)"
                : "Start a session to chat with Claude"
            }
            rows={1}
            className="flex-1 resize-none bg-v-surface border border-v-border rounded px-3 py-1.5 text-[12px] font-sans text-v-text placeholder:text-v-dim/50 focus:border-v-accent focus:outline-none max-h-[80px] overflow-y-auto disabled:opacity-50"
            disabled={!hasActiveSession}
          />
          {isWorking ? (
            <IconButton
              icon={<Square size={14} />}
              onClick={handleCancel}
              title="Cancel"
            />
          ) : (
            <IconButton
              icon={<Send size={14} />}
              onClick={handleSend}
              title="Send message"
              active={input.trim().length > 0 && hasActiveSession}
            />
          )}
        </div>
      </div>
    </div>
  );
}
