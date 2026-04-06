import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
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
  uuid?: string;
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

// ── Singleton listener — prevents double-registration from React strict mode ──

let listenerActive = false;
const processedIds = new Set<string>();

async function startListener() {
  if (listenerActive) return;
  listenerActive = true;

  await listen<AgentEventPayload>("agent-event", (event) => {
    const data = event.payload;
    const store = useAppStore.getState();

    if (data.type === "sidecar_ready") return;

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
        const uuid = assistantMsg.uuid;

        // Deduplicate by UUID
        if (uuid) {
          if (processedIds.has(uuid)) return;
          processedIds.add(uuid);
        }

        const textParts = assistantMsg.message.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text);

        if (textParts.length > 0) {
          store.addSessionChatMessage(sid, {
            id: uuid || crypto.randomUUID(),
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
        const uuid = resultMsg.uuid;

        if (uuid) {
          if (processedIds.has(uuid)) return;
          processedIds.add(uuid);
        }

        store.setSessionWorking(sid, false);

        store.insertRichCard(sid, "outcome", resultMsg.result || "Done", {
          cost_usd: resultMsg.total_cost_usd,
          duration_ms: resultMsg.duration_ms,
          num_turns: resultMsg.num_turns,
          input_tokens: resultMsg.usage?.input_tokens,
          output_tokens: resultMsg.usage?.output_tokens,
        });
      }

      // SDK message types we pass through but don't render yet
      if (msg.type === "user") {
        // User message replay — ignore (we already show user messages from handleSend)
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
}

/**
 * Hook that listens to 'agent-event' Tauri events from the sidecar.
 * Uses a module-level singleton so React strict mode double-mount
 * doesn't create duplicate listeners.
 */
export function useAgentStream() {
  useEffect(() => {
    startListener();
    // Don't stop on unmount — singleton stays alive for app lifetime
    // stopListener is only called if truly needed (e.g., app teardown)
  }, []);
}
