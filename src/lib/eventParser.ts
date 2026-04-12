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
  agent_session_id?: string;
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
 * Matches "think" events without a tool (assistant text chunks).
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
 * Extract agent_session_id from a stream payload (AgentEvent or StatusEvent).
 */
export function getSessionId(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const p = payload as Record<string, unknown>;
  if (typeof p.agent_session_id === "string") return p.agent_session_id;
  return undefined;
}

// ── Dev-server URL detection ──

const DEV_SERVER_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1):\d{4,5}\b/;

/**
 * Extract the first dev-server URL (localhost / 127.0.0.1 with port) from text.
 * Returns null when no URL is found.
 */
export function extractDevServerUrl(text: string): string | null {
  const match = text.match(DEV_SERVER_URL_RE);
  return match ? match[0] : null;
}

// ── Test-result parsing ──

export interface ParsedTestResult {
  passed: number;
  failed: number;
  total: number;
  testNames: string[];
}

function parseTestNames(text: string): string[] {
  const names: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Jest/Vitest: "✓ test name" or "✕ test name" or "● test name"
    const checkMatch = trimmed.match(/^[✓✕●✗×√]\s+(.+)/);
    if (checkMatch) {
      names.push(checkMatch[1].replace(/\s+\(\d+\s*m?s\)$/, "").trim());
      continue;
    }

    // pytest: "PASSED test_file.py::test_name" or "FAILED test_file.py::test_name"
    const pytestMatch = trimmed.match(/^(?:PASSED|FAILED)\s+(.+)/);
    if (pytestMatch) {
      names.push(pytestMatch[1].trim());
      continue;
    }

    // Rust: "test module::test_name ... ok" or "test module::test_name ... FAILED"
    const rustMatch = trimmed.match(/^test\s+(.+?)\s+\.\.\.\s+(?:ok|FAILED)/);
    if (rustMatch) {
      names.push(rustMatch[1].trim());
      continue;
    }
  }

  return names;
}

/**
 * Parse test result summary lines from Jest/Vitest, pytest, or Rust test output.
 * Returns null when no recognisable summary line is found.
 */
export function parseTestResults(text: string): ParsedTestResult | null {
  // Jest/Vitest: "Tests:  3 passed, 1 failed, 4 total" or "Tests:  8 passed, 8 total"
  const jestMatch = text.match(/Tests:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?,\s+(\d+)\s+total/);
  if (jestMatch) {
    return {
      passed: parseInt(jestMatch[1]),
      failed: jestMatch[2] ? parseInt(jestMatch[2]) : 0,
      total: parseInt(jestMatch[3]),
      testNames: parseTestNames(text),
    };
  }

  // Vitest compact: "N tests passed" or "N tests failed"
  const vitestPass = text.match(/(\d+)\s+tests?\s+passed/);
  const vitestFail = text.match(/(\d+)\s+tests?\s+failed/);
  if (vitestPass || vitestFail) {
    const passed = vitestPass ? parseInt(vitestPass[1]) : 0;
    const failed = vitestFail ? parseInt(vitestFail[1]) : 0;
    return { passed, failed, total: passed + failed, testNames: parseTestNames(text) };
  }

  // pytest: "8 passed, 2 failed" or "8 passed"
  const pytestMatch = text.match(/(\d+)\s+passed(?:,\s+(\d+)\s+failed)?/);
  if (pytestMatch) {
    const passed = parseInt(pytestMatch[1]);
    const failed = pytestMatch[2] ? parseInt(pytestMatch[2]) : 0;
    return { passed, failed, total: passed + failed, testNames: parseTestNames(text) };
  }

  // Rust: "test result: ok. 8 passed; 0 failed"
  const rustMatch = text.match(/test result:.*?(\d+)\s+passed;\s+(\d+)\s+failed/);
  if (rustMatch) {
    const passed = parseInt(rustMatch[1]);
    const failed = parseInt(rustMatch[2]);
    return { passed, failed, total: passed + failed, testNames: parseTestNames(text) };
  }

  return null;
}
