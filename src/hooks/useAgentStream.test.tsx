import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";

// Import fixtures
import cliClaudeStatus from "../test-fixtures/events/cli-claude-status.json";
import cliClaudeThink from "../test-fixtures/events/cli-claude-think.json";
import cliClaudeResult from "../test-fixtures/events/cli-claude-result.json";
import phaseTransitionGated from "../test-fixtures/events/phase-transition-gated.json";
import interactionRequest from "../test-fixtures/events/interaction-request.json";
import malformed from "../test-fixtures/events/malformed.json";

// ── Store mock ──
// We spy on the store's getState so we can capture mutations without needing
// the full Tauri-persisted Zustand store.

const mockStore = {
  agentSessions: new Map<string, any>(),
  activePipelineRun: null as any,
  createSessionLocal: vi.fn((id: string, name: string, backend: string) => {
    mockStore.agentSessions.set(id, { id, name, backend, isWorking: false, chatMessages: [], agentEvents: [] });
  }),
  setSessionWorking: vi.fn((id: string, working: boolean) => {
    const s = mockStore.agentSessions.get(id);
    if (s) s.isWorking = working;
  }),
  appendToSessionLastAssistant: vi.fn(),
  addSessionAgentEvent: vi.fn(),
  upsertActivityLine: vi.fn(),
  finalizeActivityLine: vi.fn(),
  insertRichCard: vi.fn(),
  setSessionError: vi.fn(),
  setSessionApiMetrics: vi.fn(),
  refreshPipelineRun: vi.fn().mockResolvedValue(undefined),
  addSessionChatMessage: vi.fn(),
};

vi.mock("../stores", () => ({
  useAppStore: Object.assign(
    // selector-style call (used by components — not by the hook)
    (selector: (s: any) => any) => selector(mockStore),
    // .getState() — used by the hook's applyMutations and startListener
    { getState: () => mockStore },
  ),
}));

// ── Capture the listen callback ──
// The global test-setup mocks listen as vi.fn().mockResolvedValue(() => {}).
// We override it here to capture the callback so we can fire synthetic events.

let capturedCallback: ((event: { payload: unknown }) => void) | null = null;

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((_channel: string, cb: (event: { payload: unknown }) => void) => {
    capturedCallback = cb;
    return Promise.resolve(() => {});
  }),
}));

// ── Helper ──
function fireEvent(payload: unknown) {
  if (!capturedCallback) throw new Error("Listener not registered yet");
  capturedCallback({ payload });
}

// ── Reset module singleton between tests ──
// The hook uses a module-level `listenerActive` flag. We reset the module
// before each test so the singleton starts fresh.
beforeEach(async () => {
  capturedCallback = null;
  mockStore.agentSessions = new Map();
  vi.clearAllMocks();

  // Re-mock listen after clearAllMocks resets it
  vi.mocked(listen).mockImplementation((_channel: string, cb: any) => {
    capturedCallback = cb;
    return Promise.resolve(() => {});
  });

  // Reset the singleton by re-importing the module each test
  vi.resetModules();
});

// ── Dynamic import helper — must happen after resetModules ──
async function mountHook() {
  const { useAgentStream } = await import("./useAgentStream");
  let result!: ReturnType<typeof renderHook>;
  await act(async () => {
    result = renderHook(() => useAgentStream());
  });
  return result;
}

describe("useAgentStream", () => {
  it("calls listen with 'agent-stream' on mount", async () => {
    await mountHook();
    expect(listen).toHaveBeenCalledWith("agent-stream", expect.any(Function));
  });

  it("CLI status event creates session and sets working=true", async () => {
    await mountHook();
    await act(async () => {
      fireEvent(cliClaudeStatus);
    });
    expect(mockStore.createSessionLocal).toHaveBeenCalledWith(
      "test-session-1",
      expect.any(String),
      "claude",
    );
    expect(mockStore.setSessionWorking).toHaveBeenCalledWith("test-session-1", true);
  });

  it("CLI think event appends to assistant", async () => {
    await mountHook();
    // Pre-create session so it exists
    mockStore.agentSessions.set("test-session-1", { id: "test-session-1" });
    await act(async () => {
      fireEvent(cliClaudeThink);
    });
    expect(mockStore.appendToSessionLastAssistant).toHaveBeenCalledWith(
      "test-session-1",
      "Let me analyze that for you.",
    );
  });

  it("CLI result event inserts outcome card", async () => {
    await mountHook();
    mockStore.agentSessions.set("test-session-1", { id: "test-session-1" });
    await act(async () => {
      fireEvent(cliClaudeResult);
    });
    expect(mockStore.insertRichCard).toHaveBeenCalledWith(
      "test-session-1",
      "outcome",
      expect.any(String),
      expect.any(Object),
    );
    expect(mockStore.setSessionWorking).toHaveBeenCalledWith("test-session-1", false);
  });

  it("gated phase_transition inserts gate-prompt card", async () => {
    await mountHook();
    mockStore.agentSessions.set("test-session-1", { id: "test-session-1" });
    await act(async () => {
      fireEvent(phaseTransitionGated);
    });
    expect(mockStore.insertRichCard).toHaveBeenCalledWith(
      "test-session-1",
      "gate-prompt",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("interaction_request inserts interaction card", async () => {
    await mountHook();
    mockStore.agentSessions.set("test-session-1", { id: "test-session-1" });
    await act(async () => {
      fireEvent(interactionRequest);
    });
    expect(mockStore.insertRichCard).toHaveBeenCalledWith(
      "test-session-1",
      "interaction",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("handles malformed payload without crashing", async () => {
    await mountHook();
    // Should not throw, should not call any store mutations
    await act(async () => {
      expect(() => fireEvent(malformed)).not.toThrow();
    });
    // No session should have been created for the garbage payload
    expect(mockStore.createSessionLocal).not.toHaveBeenCalled();
    expect(mockStore.insertRichCard).not.toHaveBeenCalled();
  });

  it("sidecar sdk_message creates session and adds chat message", async () => {
    await mountHook();

    const sdkMessage = {
      type: "sdk_message",
      source: "sdk-sidecar",
      sessionId: "sidecar-session-1",
      message: {
        type: "assistant",
        uuid: "msg-uuid-1",
        session_id: "sidecar-session-1",
        message: {
          content: [{ type: "text", text: "Hello from sidecar" }],
          model: "claude-opus-4",
          stop_reason: "end_turn",
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
    };

    await act(async () => {
      fireEvent(sdkMessage);
    });

    expect(mockStore.createSessionLocal).toHaveBeenCalledWith(
      "sidecar-session-1",
      "Agent Session",
      "sidecar",
    );
    expect(mockStore.addSessionChatMessage).toHaveBeenCalledWith(
      "sidecar-session-1",
      expect.objectContaining({ role: "assistant", content: "Hello from sidecar" }),
    );
  });

  it("sidecar sdk_message result type sets working=false and inserts outcome card", async () => {
    await mountHook();

    // Pre-create the session
    mockStore.agentSessions.set("sidecar-session-2", { id: "sidecar-session-2" });

    const sdkResult = {
      type: "sdk_message",
      source: "sdk-sidecar",
      sessionId: "sidecar-session-2",
      message: {
        type: "result",
        subtype: "success",
        uuid: "result-uuid-1",
        session_id: "sidecar-session-2",
        duration_ms: 4000,
        total_cost_usd: 0.042,
        num_turns: 3,
        usage: { input_tokens: 800, output_tokens: 300 },
        result: "Task done",
      },
    };

    await act(async () => {
      fireEvent(sdkResult);
    });

    expect(mockStore.setSessionWorking).toHaveBeenCalledWith("sidecar-session-2", false);
    expect(mockStore.insertRichCard).toHaveBeenCalledWith(
      "sidecar-session-2",
      "outcome",
      "Task done",
      expect.objectContaining({ cost_usd: 0.042, num_turns: 3 }),
    );
  });
});
