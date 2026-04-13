import { describe, it, expect } from "vitest";
import { normalizeCliStatus, normalizeCliEvent } from "./agentStreamNormalizer";
import type { CliEventPayload, CliStatusPayload } from "./agentStreamNormalizer";

// Import fixtures
import cliClaudeStatus from "../test-fixtures/events/cli-claude-status.json";
import cliClaudeThink from "../test-fixtures/events/cli-claude-think.json";
import cliClaudeResult from "../test-fixtures/events/cli-claude-result.json";
import cliCodexResult from "../test-fixtures/events/cli-codex-result.json";
import phaseTransitionGated from "../test-fixtures/events/phase-transition-gated.json";
import phaseTransitionAuto from "../test-fixtures/events/phase-transition-auto.json";
import interactionRequest from "../test-fixtures/events/interaction-request.json";
import cliClaudeTool from "../test-fixtures/events/cli-claude-tool.json";

// NOTE: The malformed.json fixture (`{ "type": "definitely_not_valid", "garbage": true }`)
// is intentionally not passed directly to normalizeCliStatus / normalizeCliEvent because
// those functions only receive payloads that already passed the type discriminant check in
// useAgentStream. Malformed-payload coverage lives in useAgentStream.test.tsx where the
// full dispatch path (including the hook's guard) is exercised.

describe("normalizeCliStatus", () => {
  it("creates session and sets working=true for 'working' status", () => {
    const mutations = normalizeCliStatus(cliClaudeStatus as CliStatusPayload);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "createSession", sessionId: "test-session-1", backend: "claude" }),
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "setWorking", sessionId: "test-session-1", working: true }),
    );
  });

  it("sets working=false for 'done' status", () => {
    const payload: CliStatusPayload = { type: "status", source: "cli-claude", sessionId: "s1", status: "done" };
    const mutations = normalizeCliStatus(payload);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "setWorking", working: false }),
    );
  });

  it("maps cli-codex source to codex backend", () => {
    const payload: CliStatusPayload = { type: "status", source: "cli-codex", sessionId: "s1", status: "working" };
    const mutations = normalizeCliStatus(payload);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "createSession", backend: "codex" }),
    );
  });
});

describe("normalizeCliEvent", () => {
  it("routes think event to appendAssistant", () => {
    const mutations = normalizeCliEvent(cliClaudeThink as CliEventPayload, null);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "appendAssistant", text: "Let me analyze that for you." }),
    );
  });

  it("routes tool event to addAgentEvent + upsertActivity", () => {
    const mutations = normalizeCliEvent(cliClaudeTool as CliEventPayload, null);
    expect(mutations.some((m) => m.type === "addAgentEvent")).toBe(true);
    expect(mutations.some((m) => m.type === "upsertActivity")).toBe(true);
  });

  it("routes result to outcome card + setWorking(false) + finalizeActivity", () => {
    const mutations = normalizeCliEvent(cliClaudeResult as CliEventPayload, null);
    expect(mutations).toContainEqual(expect.objectContaining({ type: "setWorking", working: false }));
    expect(mutations).toContainEqual(expect.objectContaining({ type: "finalizeActivity" }));
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "insertCard", cardType: "outcome" }),
    );
  });

  it("extracts API metrics from Claude result", () => {
    const mutations = normalizeCliEvent(cliClaudeResult as CliEventPayload, null);
    const metricsMut = mutations.find((m) => m.type === "setApiMetrics");
    expect(metricsMut).toBeDefined();
    if (metricsMut?.type === "setApiMetrics") {
      expect(metricsMut.metrics.inputTokens).toBe(1500);
      expect(metricsMut.metrics.outputTokens).toBe(200);
      expect(metricsMut.metrics.cost).toBe(0.025);
    }
  });

  it("extracts API metrics from Codex result (nulls for unavailable fields)", () => {
    const mutations = normalizeCliEvent(cliCodexResult as CliEventPayload, null);
    const metricsMut = mutations.find((m) => m.type === "setApiMetrics");
    expect(metricsMut).toBeDefined();
    if (metricsMut?.type === "setApiMetrics") {
      expect(metricsMut.metrics.inputTokens).toBe(10884);
      expect(metricsMut.metrics.cost).toBe(0); // null → 0
    }
  });

  it("refreshes pipeline run on result when active run exists", () => {
    const mutations = normalizeCliEvent(cliClaudeResult as CliEventPayload, "run-123");
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "refreshPipelineRun", pipelineRunId: "run-123" }),
    );
  });

  it("does NOT refresh pipeline run on result when no active run", () => {
    const mutations = normalizeCliEvent(cliClaudeResult as CliEventPayload, null);
    expect(mutations.some((m) => m.type === "refreshPipelineRun")).toBe(false);
  });

  it("routes gated phase_transition to gate-prompt card", () => {
    const mutations = normalizeCliEvent(phaseTransitionGated as CliEventPayload, null);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "insertCard", cardType: "gate-prompt" }),
    );
  });

  it("routes auto phase_transition to outcome card", () => {
    const mutations = normalizeCliEvent(phaseTransitionAuto as CliEventPayload, null);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "insertCard", cardType: "outcome" }),
    );
  });

  it("refreshes pipeline run on phase_transition using metadata run ID", () => {
    const mutations = normalizeCliEvent(phaseTransitionGated as CliEventPayload, null);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "refreshPipelineRun", pipelineRunId: "run-1" }),
    );
  });

  it("routes interaction_request to interaction card", () => {
    const mutations = normalizeCliEvent(interactionRequest as CliEventPayload, null);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "insertCard", cardType: "interaction" }),
    );
    const cardMut = mutations.find((m) => m.type === "insertCard");
    if (cardMut?.type === "insertCard") {
      expect(cardMut.content).toBe("What technology stack would you like to use?");
    }
  });

  it("routes error event to error card + setError", () => {
    const payload: CliEventPayload = {
      type: "agent_event",
      source: "cli-claude",
      sessionId: "s1",
      event: { event_type: "error", content: "Something broke", timestamp: "2026-04-12T00:00:00Z" },
    };
    const mutations = normalizeCliEvent(payload, null);
    expect(mutations).toContainEqual(expect.objectContaining({ type: "setError", error: "Something broke" }));
    expect(mutations).toContainEqual(expect.objectContaining({ type: "insertCard", cardType: "error" }));
  });

  it("always includes createSession as first mutation", () => {
    const mutations = normalizeCliEvent(cliClaudeThink as CliEventPayload, null);
    expect(mutations[0].type).toBe("createSession");
  });

  it("returns only createSession for unknown event_type (graceful fallthrough)", () => {
    const payload: CliEventPayload = {
      type: "agent_event",
      source: "cli-claude",
      sessionId: "s1",
      event: { event_type: "unknown_future_type", content: "some content", timestamp: "2026-04-12T00:00:00Z" },
    };
    const mutations = normalizeCliEvent(payload, null);
    // Only the session-guard createSession is emitted — no crash, no spurious cards
    expect(mutations).toHaveLength(1);
    expect(mutations[0].type).toBe("createSession");
  });
});
