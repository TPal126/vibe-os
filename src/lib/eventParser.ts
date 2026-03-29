import type { AgentEvent } from "../stores/types";

/**
 * Status event from the backend (working/done/cancelled).
 * These are NOT AgentEvents -- they control UI state.
 */
interface StatusEvent {
  type: "status";
  status: "working" | "done" | "cancelled";
  invocation_id: string;
  exit_code?: number;
  claude_session_id?: string;
}

/**
 * Discriminated union of all events the frontend can receive
 * from the 'claude-stream' Tauri event.
 */
export type ClaudeStreamPayload = AgentEvent | StatusEvent;

/**
 * Check if a payload is a status event (not a content event).
 */
export function isStatusEvent(payload: unknown): payload is StatusEvent {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "type" in payload &&
    (payload as Record<string, unknown>).type === "status"
  );
}

/**
 * Check if a payload is an AgentEvent (content event).
 */
export function isAgentEvent(payload: unknown): payload is AgentEvent {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "event_type" in payload &&
    "content" in payload &&
    "timestamp" in payload
  );
}

/**
 * Extract code blocks from assistant text content.
 * Finds ```language\n...\n``` patterns and returns structured blocks.
 */
export function extractCodeBlocks(
  text: string,
): { language: string; code: string }[] {
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  const blocks: { language: string; code: string }[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || "text",
      code: match[2].trim(),
    });
  }
  return blocks;
}

/**
 * Determine if an AgentEvent represents assistant text that should
 * be accumulated into the chat message stream.
 */
export function isAssistantText(event: AgentEvent): boolean {
  return event.event_type === "think" && !event.metadata?.tool;
}

/**
 * Check if a payload indicates a request for user input.
 */
export function isInputRequest(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const meta = (payload as Record<string, unknown>).metadata;
  if (typeof meta !== "object" || meta === null) return false;
  const m = meta as Record<string, unknown>;
  return !!(m.input_request || m.is_input_request);
}

/**
 * Extract claude_session_id from a stream payload (AgentEvent or StatusEvent).
 */
export function getSessionId(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const p = payload as Record<string, unknown>;
  if (typeof p.claude_session_id === "string") return p.claude_session_id;
  return undefined;
}
