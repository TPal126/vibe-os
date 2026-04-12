import type { AgentEvent, ApiMetrics, CardType } from "../stores/types";

// ── Payload types (re-export from useAgentStream for consistency) ──

export interface CliEventPayload {
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

export interface CliStatusPayload {
  type: "status";
  source: "cli-claude" | "cli-codex";
  sessionId: string;
  status: "working" | "done" | "cancelled";
}

// ── Mutation descriptors (what the store should do) ──

export type StoreMutation =
  | { type: "createSession"; sessionId: string; name: string; backend: "claude" | "codex" | "sidecar" }
  | { type: "setWorking"; sessionId: string; working: boolean }
  | { type: "appendAssistant"; sessionId: string; text: string }
  | { type: "addAgentEvent"; sessionId: string; event: AgentEvent }
  | { type: "upsertActivity"; sessionId: string; event: AgentEvent }
  | { type: "finalizeActivity"; sessionId: string }
  | { type: "insertCard"; sessionId: string; cardType: CardType; content: string; data: Record<string, unknown> }
  | { type: "setError"; sessionId: string; error: string }
  | { type: "setApiMetrics"; sessionId: string; metrics: ApiMetrics }
  | { type: "refreshPipelineRun"; pipelineRunId: string };

/**
 * Normalize a CLI status event into store mutations.
 */
export function normalizeCliStatus(payload: CliStatusPayload): StoreMutation[] {
  const mutations: StoreMutation[] = [];
  const backend = payload.source === "cli-claude" ? "claude" : "codex";

  mutations.push({
    type: "createSession",
    sessionId: payload.sessionId,
    name: "CLI Session",
    backend: backend as "claude" | "codex",
  });

  mutations.push({
    type: "setWorking",
    sessionId: payload.sessionId,
    working: payload.status === "working",
  });

  return mutations;
}

/**
 * Normalize a CLI agent event into store mutations.
 */
export function normalizeCliEvent(
  payload: CliEventPayload,
  activePipelineRunId: string | null,
): StoreMutation[] {
  const mutations: StoreMutation[] = [];
  const sid = payload.sessionId;
  const evt = payload.event;
  const eventType = evt.event_type;
  const content = evt.content || "";
  const meta = evt.metadata;
  const backend =
    payload.source === "cli-claude" ? "claude" : payload.source === "cli-codex" ? "codex" : "sidecar";

  // Ensure session exists
  mutations.push({
    type: "createSession",
    sessionId: sid,
    name: "CLI Session",
    backend: backend as "claude" | "codex" | "sidecar",
  });

  // Think without tool = assistant text
  if (eventType === "think" && !meta?.tool) {
    mutations.push({ type: "appendAssistant", sessionId: sid, text: content });
    return mutations;
  }

  // Tool use
  if (meta?.tool) {
    const agentEvent: AgentEvent = {
      timestamp: evt.timestamp,
      event_type: eventType as AgentEvent["event_type"],
      content,
      metadata: meta,
    };
    mutations.push({ type: "addAgentEvent", sessionId: sid, event: agentEvent });
    mutations.push({ type: "upsertActivity", sessionId: sid, event: agentEvent });
    return mutations;
  }

  // Result
  if (eventType === "result") {
    mutations.push({ type: "setWorking", sessionId: sid, working: false });
    mutations.push({ type: "finalizeActivity", sessionId: sid });
    mutations.push({
      type: "insertCard",
      sessionId: sid,
      cardType: "outcome",
      content,
      data: {
        cost_usd: meta?.cost_usd,
        input_tokens: meta?.input_tokens,
        output_tokens: meta?.output_tokens,
        duration_ms: meta?.duration_ms,
      },
    });

    if (meta?.input_tokens || meta?.output_tokens) {
      mutations.push({
        type: "setApiMetrics",
        sessionId: sid,
        metrics: {
          inputTokens: (meta.input_tokens as number) || 0,
          outputTokens: (meta.output_tokens as number) || 0,
          cacheCreationInputTokens: (meta.cache_creation_input_tokens as number) || 0,
          cacheReadInputTokens: (meta.cache_read_input_tokens as number) || 0,
          cost: (meta.cost_usd as number) || 0,
          durationMs: (meta.duration_ms as number) || 0,
          durationApiMs: (meta.duration_api_ms as number) || 0,
        },
      });
    }

    if (activePipelineRunId) {
      mutations.push({ type: "refreshPipelineRun", pipelineRunId: activePipelineRunId });
    }
    return mutations;
  }

  // Error
  if (eventType === "error") {
    mutations.push({ type: "setError", sessionId: sid, error: content });
    mutations.push({ type: "insertCard", sessionId: sid, cardType: "error", content, data: {} });
    return mutations;
  }

  // Phase transition
  if (eventType === "phase_transition") {
    const isGate = meta?.gate === "awaiting";
    mutations.push({
      type: "insertCard",
      sessionId: sid,
      cardType: isGate ? "gate-prompt" : "outcome",
      content,
      data: meta || {},
    });
    const runId = (meta?.pipeline_run_id as string) || activePipelineRunId;
    if (runId) {
      mutations.push({ type: "refreshPipelineRun", pipelineRunId: runId });
    }
    return mutations;
  }

  // Interaction request
  if (eventType === "interaction_request") {
    mutations.push({
      type: "insertCard",
      sessionId: sid,
      cardType: "interaction",
      content,
      data: meta || {},
    });
    return mutations;
  }

  return mutations;
}
