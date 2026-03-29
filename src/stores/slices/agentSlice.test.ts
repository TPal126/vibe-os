import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import { createAgentSlice } from "./agentSlice";
import type { AgentSlice, ChatMessage, AgentEvent, AppState } from "../types";

// Minimal store that only has agentSlice (sufficient for unit tests)
function createTestStore() {
  return create<AgentSlice>()((...a) => createAgentSlice(...(a as Parameters<typeof createAgentSlice>)));
}

const makeMessage = (role: "user" | "assistant", content: string): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  timestamp: new Date().toISOString(),
});

const makeEvent = (type: string, content: string): AgentEvent => ({
  timestamp: new Date().toISOString(),
  event_type: type as AgentEvent["event_type"],
  content,
});

describe("agentSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  // ── Session lifecycle ──

  describe("session lifecycle", () => {
    it("creates a session and auto-activates it", () => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
      const state = store.getState();
      expect(state.claudeSessions.has("s1")).toBe(true);
      expect(state.activeClaudeSessionId).toBe("s1");
      expect(state.claudeSessions.get("s1")!.name).toBe("Session 1");
    });

    it("second session does not override active", () => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
      store.getState().createClaudeSessionLocal("s2", "Session 2");
      expect(store.getState().activeClaudeSessionId).toBe("s1");
      expect(store.getState().claudeSessions.size).toBe(2);
    });

    it("switches active session", () => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
      store.getState().createClaudeSessionLocal("s2", "Session 2");
      store.getState().setActiveClaudeSessionId("s2");
      expect(store.getState().activeClaudeSessionId).toBe("s2");
    });

    it("removes session and reassigns active", () => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
      store.getState().createClaudeSessionLocal("s2", "Session 2");
      store.getState().setActiveClaudeSessionId("s1");
      store.getState().removeClaudeSession("s1");
      expect(store.getState().claudeSessions.has("s1")).toBe(false);
      expect(store.getState().activeClaudeSessionId).toBe("s2");
    });

    it("removing last session sets active to null", () => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
      store.getState().removeClaudeSession("s1");
      expect(store.getState().activeClaudeSessionId).toBeNull();
    });
  });

  // ── Chat message handling (the bug area) ──

  describe("chat messages", () => {
    beforeEach(() => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
    });

    it("adds a user message to session", () => {
      const msg = makeMessage("user", "hello");
      store.getState().addSessionChatMessage("s1", msg);
      const session = store.getState().claudeSessions.get("s1")!;
      expect(session.chatMessages).toHaveLength(1);
      expect(session.chatMessages[0].content).toBe("hello");
    });

    it("appendToSessionLastAssistant creates new message if none exists", () => {
      store.getState().appendToSessionLastAssistant("s1", "Hi there!");
      const session = store.getState().claudeSessions.get("s1")!;
      expect(session.chatMessages).toHaveLength(1);
      expect(session.chatMessages[0].role).toBe("assistant");
      expect(session.chatMessages[0].content).toBe("Hi there!");
    });

    it("appendToSessionLastAssistant appends to existing assistant message", () => {
      store.getState().appendToSessionLastAssistant("s1", "Hello");
      store.getState().appendToSessionLastAssistant("s1", " world");
      const session = store.getState().claudeSessions.get("s1")!;
      expect(session.chatMessages).toHaveLength(1);
      expect(session.chatMessages[0].content).toBe("Hello world");
    });

    it("appendToSessionLastAssistant creates new message after user message", () => {
      store.getState().addSessionChatMessage("s1", makeMessage("user", "question"));
      store.getState().appendToSessionLastAssistant("s1", "answer");
      const session = store.getState().claudeSessions.get("s1")!;
      expect(session.chatMessages).toHaveLength(2);
      expect(session.chatMessages[0].role).toBe("user");
      expect(session.chatMessages[1].role).toBe("assistant");
      expect(session.chatMessages[1].content).toBe("answer");
    });

    it("does nothing for non-existent session", () => {
      store.getState().appendToSessionLastAssistant("nonexistent", "text");
      // Should not throw, should not modify anything
      expect(store.getState().claudeSessions.get("s1")!.chatMessages).toHaveLength(0);
    });

    it("syncs to legacy chatMessages when session is active", () => {
      store.getState().appendToSessionLastAssistant("s1", "Hello");
      expect(store.getState().chatMessages).toHaveLength(1);
      expect(store.getState().chatMessages[0].content).toBe("Hello");
    });
  });

  // ── Duplication prevention (the exact bug we had) ──

  describe("no duplication", () => {
    beforeEach(() => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
    });

    it("appendToLastAssistant delegates to session (not double-writing)", () => {
      // This was the bug: appendToLastAssistant calls appendToSessionLastAssistant internally
      // If the hook calls BOTH, the text doubles
      store.getState().appendToSessionLastAssistant("s1", "Hello");
      // Now calling the legacy method should append, not create a new message
      store.getState().appendToLastAssistant(" world");
      const session = store.getState().claudeSessions.get("s1")!;
      expect(session.chatMessages).toHaveLength(1);
      expect(session.chatMessages[0].content).toBe("Hello world");
    });

    it("simulates the fixed hook behavior: only session-scoped call when sid exists", () => {
      // This is what the fixed useClaudeStream does:
      // if (sid) { appendToSessionLastAssistant(sid, text) } else { appendToLastAssistant(text) }
      const sid = "s1";
      const text = "Hello!";

      // Only one call — no duplication
      store.getState().appendToSessionLastAssistant(sid, text);

      const session = store.getState().claudeSessions.get(sid)!;
      expect(session.chatMessages).toHaveLength(1);
      expect(session.chatMessages[0].content).toBe("Hello!");
    });

    it("OLD BUG: calling both session AND legacy would double the text", () => {
      // This demonstrates the bug that existed before the fix
      store.getState().appendToSessionLastAssistant("s1", "Hello");
      // appendToLastAssistant delegates to appendToSessionLastAssistant("s1", ...)
      store.getState().appendToLastAssistant("Hello");
      const session = store.getState().claudeSessions.get("s1")!;
      // The text is now "HelloHello" — this is the duplication bug
      expect(session.chatMessages[0].content).toBe("HelloHello");
    });
  });

  // ── Status derivation ──

  describe("status derivation", () => {
    beforeEach(() => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
    });

    it("defaults to idle", () => {
      expect(store.getState().claudeSessions.get("s1")!.status).toBe("idle");
    });

    it("working state", () => {
      store.getState().setSessionWorking("s1", true);
      expect(store.getState().claudeSessions.get("s1")!.status).toBe("working");
    });

    it("error takes priority over working", () => {
      store.getState().setSessionWorking("s1", true);
      store.getState().setSessionError("s1", "fail");
      expect(store.getState().claudeSessions.get("s1")!.status).toBe("error");
    });

    it("needs-input takes priority over working", () => {
      store.getState().setSessionWorking("s1", true);
      store.getState().setSessionNeedsInput("s1", true);
      expect(store.getState().claudeSessions.get("s1")!.status).toBe("needs-input");
    });

    it("clearing error returns to correct state", () => {
      store.getState().setSessionWorking("s1", true);
      store.getState().setSessionError("s1", "fail");
      store.getState().setSessionError("s1", null);
      expect(store.getState().claudeSessions.get("s1")!.status).toBe("working");
    });
  });

  // ── CLI validation ──

  describe("CLI validation state", () => {
    it("starts as null (unchecked)", () => {
      expect(store.getState().claudeCliAvailable).toBeNull();
      expect(store.getState().claudeCliError).toBeNull();
    });
  });
});
