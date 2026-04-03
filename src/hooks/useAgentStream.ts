import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "../stores";

interface SdkAssistantMessage {
  type: "assistant";
  uuid: string;
  session_id: string;
  message: {
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      | { type: "thinking"; thinking: string }
    >;
    model: string;
    stop_reason: string | null;
    usage: { input_tokens: number; output_tokens: number };
  };
}

interface SdkResultMessage {
  type: "result";
  subtype: "success" | "error";
  session_id: string;
  duration_ms: number;
  total_cost_usd: number;
  num_turns: number;
  usage: { input_tokens: number; output_tokens: number };
  result: string;
}

interface AgentEventPayload {
  type: "sdk_message" | "sidecar_ready" | "session_ended" | "error";
  sessionId?: string;
  message?: SdkAssistantMessage | SdkResultMessage | Record<string, unknown>;
  error?: string;
}

/**
 * Hook that listens to 'agent-event' Tauri events from the sidecar
 * and dispatches typed SDK messages to the Zustand store.
 *
 * Mount once at the app level.
 */
export function useAgentStream() {
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    const setup = async () => {
      unlistenRef.current = await listen<AgentEventPayload>("agent-event", (event) => {
        const data = event.payload;
        const store = useAppStore.getState();

        if (data.type === "sidecar_ready") {
          // Sidecar is ready — could update UI status
          return;
        }

        const sid = data.sessionId;
        if (!sid) return;

        // Ensure session exists in store
        if (!store.claudeSessions.has(sid)) {
          store.createClaudeSessionLocal(sid, "Agent Session");
        }

        if (data.type === "sdk_message" && data.message) {
          const msg = data.message;

          if (msg.type === "assistant") {
            const assistantMsg = msg as SdkAssistantMessage;
            // Extract text content
            const textParts = assistantMsg.message.content
              .filter((c): c is { type: "text"; text: string } => c.type === "text")
              .map((c) => c.text);

            if (textParts.length > 0) {
              store.addSessionChatMessage(sid, {
                id: assistantMsg.uuid || crypto.randomUUID(),
                role: "assistant",
                content: textParts.join("\n"),
                timestamp: new Date().toISOString(),
              });
            }

            // Extract tool uses for activity cards
            const toolUses = assistantMsg.message.content
              .filter((c): c is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => c.type === "tool_use");

            for (const tu of toolUses) {
              store.addSessionAgentEvent(sid, {
                timestamp: new Date().toISOString(),
                event_type: "raw",
                content: `Tool: ${tu.name}`,
                metadata: { tool: tu.name, input: tu.input, tool_use_id: tu.id },
              });
            }

            store.setSessionWorking(sid, true);
          }

          if (msg.type === "result") {
            const resultMsg = msg as SdkResultMessage;
            store.setSessionWorking(sid, false);

            store.insertRichCard(sid, "outcome", resultMsg.result || "Done", {
              cost_usd: resultMsg.total_cost_usd,
              duration_ms: resultMsg.duration_ms,
              num_turns: resultMsg.num_turns,
              input_tokens: resultMsg.usage?.input_tokens,
              output_tokens: resultMsg.usage?.output_tokens,
            });
          }
        }

        if (data.type === "session_ended") {
          store.setSessionWorking(sid, false);
        }

        if (data.type === "error") {
          store.setSessionError(sid, data.error || "Unknown error");
          store.setSessionWorking(sid, false);
        }
      });
    };

    setup();

    return () => {
      unlistenRef.current?.();
    };
  }, []);
}
