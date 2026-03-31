import { describe, it, expect } from "vitest";
import {
  isStatusEvent,
  isAgentEvent,
  isAssistantText,
  isInputRequest,
  getSessionId,
  extractCodeBlocks,
  extractDevServerUrl,
  parseTestResults,
} from "./eventParser";
import type { AgentEvent } from "../stores/types";

// ── Real event shapes (matching what the Rust parser emits after parsing CLI output) ──

// The Rust parser converts assistant text to: { event_type: "think", content: "...", metadata: null }
const assistantTextEvent: AgentEvent = {
  timestamp: "2026-03-29T08:00:00Z",
  event_type: "think",
  content: "Hi! How can I help you today?",
  // metadata is null/undefined for assistant text — this is the key distinction
};

// Tool events have metadata.tool set
const toolEvent: AgentEvent = {
  timestamp: "2026-03-29T08:00:00Z",
  event_type: "think",
  content: "Reading: src/main.rs",
  metadata: { tool: "Read" },
};

const bashToolEvent: AgentEvent = {
  timestamp: "2026-03-29T08:00:00Z",
  event_type: "think",
  content: "Executing: ls -la",
  metadata: { tool: "Bash", command: "ls -la" },
};

const resultEvent: AgentEvent = {
  timestamp: "2026-03-29T08:00:00Z",
  event_type: "result",
  content: "Hi! How can I help you today?",
  metadata: { session_id: "abc-123", cost_usd: 0.05, duration_ms: 2000 },
};

const fileCreateEvent: AgentEvent = {
  timestamp: "2026-03-29T08:00:00Z",
  event_type: "file_create",
  content: "Creating /tmp/test.py",
  metadata: { tool: "Write", path: "/tmp/test.py" },
};

const errorEvent: AgentEvent = {
  timestamp: "2026-03-29T08:00:00Z",
  event_type: "error",
  content: "Something went wrong",
};

// ── isStatusEvent ──

describe("isStatusEvent", () => {
  it("matches valid status events", () => {
    expect(
      isStatusEvent({
        type: "status",
        status: "working",
        invocation_id: "inv-1",
      }),
    ).toBe(true);
    expect(
      isStatusEvent({ type: "status", status: "done", invocation_id: "inv-1" }),
    ).toBe(true);
    expect(
      isStatusEvent({
        type: "status",
        status: "cancelled",
        invocation_id: "inv-1",
      }),
    ).toBe(true);
  });

  it("rejects agent events", () => {
    expect(isStatusEvent(assistantTextEvent)).toBe(false);
    expect(isStatusEvent(resultEvent)).toBe(false);
  });

  it("rejects nulls and primitives", () => {
    expect(isStatusEvent(null)).toBe(false);
    expect(isStatusEvent(undefined)).toBe(false);
    expect(isStatusEvent("string")).toBe(false);
    expect(isStatusEvent(42)).toBe(false);
  });
});

// ── isAgentEvent ──

describe("isAgentEvent", () => {
  it("matches valid agent events", () => {
    expect(isAgentEvent(assistantTextEvent)).toBe(true);
    expect(isAgentEvent(toolEvent)).toBe(true);
    expect(isAgentEvent(resultEvent)).toBe(true);
    expect(isAgentEvent(errorEvent)).toBe(true);
    expect(isAgentEvent(fileCreateEvent)).toBe(true);
  });

  it("rejects status events", () => {
    expect(
      isAgentEvent({
        type: "status",
        status: "working",
        invocation_id: "inv-1",
      }),
    ).toBe(false);
  });

  it("rejects partial objects", () => {
    expect(isAgentEvent({ event_type: "think" })).toBe(false);
    expect(isAgentEvent({ content: "hello" })).toBe(false);
    expect(isAgentEvent({})).toBe(false);
  });
});

// ── isAssistantText (most critical function) ──

describe("isAssistantText", () => {
  it("matches assistant text events (think without tool)", () => {
    expect(isAssistantText(assistantTextEvent)).toBe(true);
  });

  it("rejects tool events (think WITH tool metadata)", () => {
    expect(isAssistantText(toolEvent)).toBe(false);
    expect(isAssistantText(bashToolEvent)).toBe(false);
  });

  it("rejects result events", () => {
    expect(isAssistantText(resultEvent)).toBe(false);
  });

  it("rejects error events", () => {
    expect(isAssistantText(errorEvent)).toBe(false);
  });

  it("rejects file events", () => {
    expect(isAssistantText(fileCreateEvent)).toBe(false);
  });

  it("handles metadata being null", () => {
    const event: AgentEvent = {
      timestamp: "2026-03-29T08:00:00Z",
      event_type: "think",
      content: "hello",
      metadata: undefined,
    };
    expect(isAssistantText(event)).toBe(true);
  });

  it("handles metadata being empty object", () => {
    const event: AgentEvent = {
      timestamp: "2026-03-29T08:00:00Z",
      event_type: "think",
      content: "hello",
      metadata: {},
    };
    expect(isAssistantText(event)).toBe(true);
  });
});

// ── getSessionId ──

describe("getSessionId", () => {
  it("extracts claude_session_id from events", () => {
    expect(
      getSessionId({ claude_session_id: "session-123", event_type: "think" }),
    ).toBe("session-123");
  });

  it("extracts from status events", () => {
    expect(
      getSessionId({
        type: "status",
        status: "done",
        claude_session_id: "session-456",
      }),
    ).toBe("session-456");
  });

  it("returns undefined when missing", () => {
    expect(getSessionId({ event_type: "think" })).toBeUndefined();
    expect(getSessionId(null)).toBeUndefined();
    expect(getSessionId(undefined)).toBeUndefined();
  });
});

// ── isInputRequest ──

describe("isInputRequest", () => {
  it("detects input_request in metadata", () => {
    expect(
      isInputRequest({ metadata: { input_request: true } }),
    ).toBe(true);
  });

  it("detects is_input_request in metadata", () => {
    expect(
      isInputRequest({ metadata: { is_input_request: true } }),
    ).toBe(true);
  });

  it("returns false for normal events", () => {
    expect(isInputRequest(assistantTextEvent)).toBe(false);
    expect(isInputRequest(resultEvent)).toBe(false);
  });
});

// ── extractCodeBlocks ──

describe("extractCodeBlocks", () => {
  it("extracts single code block", () => {
    const text = "Here is code:\n```python\nprint('hi')\n```\nDone.";
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("python");
    expect(blocks[0].code).toBe("print('hi')");
  });

  it("extracts multiple code blocks", () => {
    const text = "```js\nconst a = 1;\n```\nand\n```rust\nfn main() {}\n```";
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe("js");
    expect(blocks[1].language).toBe("rust");
  });

  it("handles no language specified", () => {
    const text = "```\nsome code\n```";
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("text");
  });

  it("returns empty for no code blocks", () => {
    expect(extractCodeBlocks("just text")).toEqual([]);
  });
});

// ── extractDevServerUrl ──

describe("extractDevServerUrl", () => {
  it("extracts localhost URL from text", () => {
    const url = extractDevServerUrl("Server running at http://localhost:3000");
    expect(url).toBe("http://localhost:3000");
  });

  it("extracts 127.0.0.1 URL", () => {
    const url = extractDevServerUrl("Listening on http://127.0.0.1:5173/");
    expect(url).toBe("http://127.0.0.1:5173");
  });

  it("returns null for no URL", () => {
    expect(extractDevServerUrl("no url here")).toBeNull();
  });
});

// ── parseTestResults ──

describe("parseTestResults", () => {
  it("parses Jest/Vitest output", () => {
    const result = parseTestResults("Tests:  3 passed, 1 failed, 4 total");
    expect(result).not.toBeNull();
    expect(result!.passed).toBe(3);
    expect(result!.failed).toBe(1);
    expect(result!.total).toBe(4);
  });

  it("parses pytest output", () => {
    const result = parseTestResults("5 passed, 2 failed in 3.2s");
    expect(result).not.toBeNull();
    expect(result!.passed).toBe(5);
    expect(result!.failed).toBe(2);
  });

  it("parses Rust test output", () => {
    const result = parseTestResults("test result: ok. 8 passed; 0 failed; 0 ignored");
    expect(result).not.toBeNull();
    expect(result!.passed).toBe(8);
    expect(result!.failed).toBe(0);
  });

  it("returns null for non-test output", () => {
    expect(parseTestResults("hello world")).toBeNull();
  });
});
