import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { useClaudeStream } from "../../hooks/useClaudeStream";
import { extractCodeBlocks } from "../../lib/eventParser";
import { commands } from "../../lib/tauri";
import { Dot } from "../shared/Dot";
import { IconButton } from "../shared/IconButton";
import { Send, Square, Code, Copy } from "lucide-react";
import type { ChatMessage } from "../../stores/types";

function MessageBubble({ message }: { message: ChatMessage }) {
  const openUntitledFile = useAppStore((s) => s.openUntitledFile);
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
          <div key={idx} className="mt-2">
            <div className="flex items-center justify-between bg-v-bg rounded-t px-2 py-0.5 border border-v-border border-b-0">
              <span className="text-[9px] font-mono text-v-dim uppercase">
                {block.language}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(block.code).catch(() => {});
                  }}
                  className="flex items-center gap-1 text-[9px] text-v-dim hover:text-v-text transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy size={10} />
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => openUntitledFile(block.code, block.language || "python")}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono text-v-accent bg-v-accent/10 hover:bg-v-accent/20 transition-colors"
                  title="Open in editor"
                >
                  <Code size={10} />
                  <span>Open in Editor</span>
                </button>
              </div>
            </div>
            <pre className="bg-v-bg rounded-b px-3 py-2 border border-v-border overflow-x-auto">
              <code className="text-[11px] font-mono text-v-text/90 leading-snug">
                {block.code}
              </code>
            </pre>
          </div>
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
  useClaudeStream();

  const {
    chatMessages,
    isWorking,
    conversationId,
    composedPrompt,
    addChatMessage,
    currentInvocationId,
  } = useAppStore(
    useShallow((s) => ({
      chatMessages: s.chatMessages,
      isWorking: s.isWorking,
      conversationId: s.conversationId,
      composedPrompt: s.composedPrompt,
      addChatMessage: s.addChatMessage,
      currentInvocationId: s.currentInvocationId,
    }))
  );

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isWorking]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isWorking) return;

    addChatMessage({
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
          conversation_id: conversationId,
          working_dir: workingDir,
        });
      } else {
        await commands.startClaude({
          working_dir: workingDir,
          message: text,
          system_prompt: composedPrompt?.full || undefined,
          conversation_id: undefined,
        });
      }
    } catch (err) {
      addChatMessage({
        id: crypto.randomUUID(),
        role: "system",
        content: `Error: ${err}`,
        timestamp: new Date().toISOString(),
      });
    }
  }, [input, isWorking, conversationId, composedPrompt, addChatMessage]);

  const handleCancel = useCallback(async () => {
    if (currentInvocationId) {
      try {
        await commands.cancelClaude(currentInvocationId);
      } catch (err) {
        console.error("Failed to cancel:", err);
      }
    }
  }, [currentInvocationId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-2">
        {chatMessages.length === 0 && !isWorking && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">
              Send a message to start a conversation with Claude
            </p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isWorking && (
          <div className="flex items-center gap-2 px-3 py-2">
            <Dot color="bg-v-accent" pulse />
            <span className="text-[11px] text-v-dim animate-pulse">
              Working...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-v-border p-2">
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Claude... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 resize-none bg-v-surface border border-v-border rounded px-3 py-1.5 text-[12px] font-sans text-v-text placeholder:text-v-dim/50 focus:border-v-accent focus:outline-none max-h-[80px] overflow-y-auto"
            disabled={false}
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
              active={input.trim().length > 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}
