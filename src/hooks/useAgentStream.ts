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
  source?: "cli-claude" | "cli-codex" | "sdk-sidecar";
  sessionId?: string;
  message?: SdkAssistantMessage | SdkResultMessage | Record<string, unknown>;
  error?: string;
}

/** Envelope for CLI adapter events */
interface CliEventPayload {
  type: "agent_event";
  source: "cli-claude" | "cli-codex" | "workflow";
  sessionId: string;
  event: {
    event_type: string;
    content: string;
    metadata?: Record<string, unknown>;
    timestamp: string;
  };
}

/** Envelope for CLI status events */
interface CliStatusPayload {
  type: "status";
  source: "cli-claude" | "cli-codex";
  sessionId: string;
  status: "working" | "done" | "cancelled";
  invocation_id?: string;
  exit_code?: number | null;
}

type AgentStreamPayload = AgentEventPayload | CliEventPayload | CliStatusPayload;

// ── Singleton listener — prevents double-registration from React strict mode ──

let listenerActive = false;
const processedIds = new Set<string>();

async function startListener() {
  if (listenerActive) return;
  listenerActive = true;

  await listen<AgentStreamPayload>("agent-stream", (event) => {
    const data = event.payload;
    const store = useAppStore.getState();

    // Handle CLI status events
    if (data.type === "status" && "source" in data && (data as any).source?.startsWith("cli-")) {
      const statusData = data as CliStatusPayload;
      const sid = statusData.sessionId;
      if (!sid) return;
      const backend = statusData.source === "cli-claude" ? "claude" : "codex";
      if (!store.agentSessions.has(sid)) {
        store.createSessionLocal(sid, "CLI Session", backend as any);
      }
      if (statusData.status === "working") {
        store.setSessionWorking(sid, true);
      } else {
        store.setSessionWorking(sid, false);
      }
      return;
    }

    // Handle CLI agent events
    if (data.type === "agent_event") {
      const cliData = data as CliEventPayload;
      const sid = cliData.sessionId;
      if (!sid) return;
      const evt = cliData.event;
      const backend = cliData.source === "cli-claude" ? "claude" : cliData.source === "cli-codex" ? "codex" : "sidecar";

      if (!store.agentSessions.has(sid)) {
        store.createSessionLocal(sid, "CLI Session", backend as any);
      }

      const eventType = evt.event_type;
      const content = evt.content || "";
      const meta = evt.metadata;

      // Agent text (think events without tool metadata)
      if (eventType === "think" && !meta?.tool) {
        store.appendToSessionLastAssistant(sid, content);
        return;
      }

      // Tool use / activity events
      if (meta?.tool) {
        const agentEvent = { timestamp: evt.timestamp, event_type: eventType as any, content, metadata: meta };
        store.addSessionAgentEvent(sid, agentEvent);
        store.upsertActivityLine(sid, agentEvent);
        return;
      }

      // Result events
      if (eventType === "result") {
        store.setSessionWorking(sid, false);
        store.finalizeActivityLine(sid);
        store.insertRichCard(sid, "outcome", content, {
          cost_usd: meta?.cost_usd,
          input_tokens: meta?.input_tokens,
          output_tokens: meta?.output_tokens,
          duration_ms: meta?.duration_ms,
        });
        if (meta?.input_tokens || meta?.output_tokens) {
          store.setSessionApiMetrics(sid, {
            inputTokens: (meta.input_tokens as number) || 0,
            outputTokens: (meta.output_tokens as number) || 0,
            cacheCreationInputTokens: (meta.cache_creation_input_tokens as number) || 0,
            cacheReadInputTokens: (meta.cache_read_input_tokens as number) || 0,
            cost: (meta.cost_usd as number) || 0,
            durationMs: (meta.duration_ms as number) || 0,
            durationApiMs: (meta.duration_api_ms as number) || 0,
          });
        }
        return;
      }

      // Error events
      if (eventType === "error") {
        store.setSessionError(sid, content);
        store.insertRichCard(sid, "error", content, {});
        return;
      }

      // Phase transition events
      if (eventType === "phase_transition") {
        store.insertRichCard(sid, "outcome", content, { ...meta, cardSubtype: "phase_transition" });
        return;
      }

      return;
    }

    if (data.type === "sidecar_ready") return;

    const sid = (data as AgentEventPayload).sessionId;
    if (!sid) return;

    const source = (data as AgentEventPayload).source ?? "sdk-sidecar";

    // Ensure session exists in store
    if (!store.agentSessions.has(sid)) {
      store.createSessionLocal(sid, "Agent Session", "sidecar");
    }

    if (source === "sdk-sidecar" && data.type === "sdk_message" && (data as AgentEventPayload).message) {
      const msg = (data as AgentEventPayload).message!

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
      store.setSessionError(sid, (data as AgentEventPayload).error || "Unknown error");
      store.setSessionWorking(sid, false);
    }
  });
}

/**
 * Hook that listens to 'agent-stream' Tauri events from the sidecar.
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
