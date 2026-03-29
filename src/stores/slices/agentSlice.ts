import type {
  SliceCreator,
  AgentSlice,
  ChatMessage,
  AgentEvent,
  ClaudeSessionState,
  ActivityEvent,
  CardType,
} from "../types";
import { commands } from "../../lib/tauri";

// ── Helpers ──

function createDefaultSession(id: string, name: string): ClaudeSessionState {
  return {
    id,
    name,
    chatMessages: [],
    agentEvents: [],
    isWorking: false,
    conversationId: null,
    currentInvocationId: null,
    agentError: null,
    needsInput: false,
    attentionPreview: null,
    attentionMessageId: null,
    status: "idle",
    createdAt: new Date().toISOString(),
    currentActivityMessageId: null,
  };
}

function summarizeActivity(events: ActivityEvent[]): string {
  const reads = events.filter(
    (e) => e.tool === "Read" || e.tool === "Glob" || e.tool === "Grep",
  );
  const edits = events.filter((e) => e.tool === "Edit");
  const creates = events.filter((e) => e.tool === "Write");
  const tests = events.filter((e) => e.type === "test_run");
  const cmds = events.filter(
    (e) => e.tool === "Bash" && e.type !== "test_run",
  );

  const parts: string[] = [];
  if (reads.length)
    parts.push(`Reading ${reads.length} file${reads.length > 1 ? "s" : ""}`);
  if (edits.length) {
    const paths = edits
      .map((e) => e.path?.split(/[/\\]/).pop())
      .filter(Boolean);
    parts.push(`Editing ${paths.join(", ") || edits.length + " files"}`);
  }
  if (creates.length) {
    const paths = creates
      .map((e) => e.path?.split(/[/\\]/).pop())
      .filter(Boolean);
    parts.push(`Creating ${paths.join(", ") || creates.length + " files"}`);
  }
  if (tests.length) parts.push("Running tests");
  if (cmds.length)
    parts.push(
      `Running ${cmds.length} command${cmds.length > 1 ? "s" : ""}`,
    );

  return parts.join(" \u00b7 ") || "Working...";
}

function updateSession(
  sessions: Map<string, ClaudeSessionState>,
  sessionId: string,
  updater: (s: ClaudeSessionState) => Partial<ClaudeSessionState>,
): Map<string, ClaudeSessionState> {
  const existing = sessions.get(sessionId);
  if (!existing) return sessions;
  const next = new Map(sessions);
  const updated = { ...existing, ...updater(existing) };
  updated.status = deriveStatus(updated);
  next.set(sessionId, updated);
  return next;
}

function deriveStatus(
  s: ClaudeSessionState,
): ClaudeSessionState["status"] {
  if (s.agentError) return "error";
  if (s.needsInput) return "needs-input";
  if (s.isWorking) return "working";
  return "idle";
}

// ── Slice ──

export const createAgentSlice: SliceCreator<AgentSlice> = (set, get) => ({
  // CLI availability
  claudeCliAvailable: null,
  claudeCliError: null,

  validateClaudeCli: async () => {
    try {
      const version = await commands.validateClaudeCli();
      set({ claudeCliAvailable: true, claudeCliError: null });
      console.log("[vibe-os] Claude CLI validated:", version);
    } catch (err) {
      const message =
        typeof err === "string" ? err : (err as Error)?.message ?? String(err);
      set({ claudeCliAvailable: false, claudeCliError: message });
      console.warn("[vibe-os] Claude CLI validation failed:", message);
    }
  },

  // Per-session state
  claudeSessions: new Map<string, ClaudeSessionState>(),
  activeClaudeSessionId: null,

  // Legacy compat defaults
  chatMessages: [],
  agentEvents: [],
  isWorking: false,
  conversationId: null,
  currentInvocationId: null,
  agentError: null,

  // ── Session lifecycle ──

  createClaudeSessionLocal: (id: string, name: string) =>
    set((state) => {
      const next = new Map(state.claudeSessions);
      next.set(id, createDefaultSession(id, name));
      // Auto-activate if first session
      const activeId =
        state.activeClaudeSessionId ?? id;
      return { claudeSessions: next, activeClaudeSessionId: activeId };
    }),

  removeClaudeSession: (id: string) =>
    set((state) => {
      const next = new Map(state.claudeSessions);
      next.delete(id);
      let activeId = state.activeClaudeSessionId;
      if (activeId === id) {
        // Activate another session, or null
        const remaining = Array.from(next.keys());
        activeId = remaining.length > 0 ? remaining[0] : null;
      }
      // Derive legacy state from new active
      const activeSession = activeId ? next.get(activeId) : undefined;
      return {
        claudeSessions: next,
        activeClaudeSessionId: activeId,
        chatMessages: activeSession?.chatMessages ?? [],
        agentEvents: activeSession?.agentEvents ?? [],
        isWorking: activeSession?.isWorking ?? false,
        conversationId: activeSession?.conversationId ?? null,
        currentInvocationId: activeSession?.currentInvocationId ?? null,
        agentError: activeSession?.agentError ?? null,
      };
    }),

  setActiveClaudeSessionId: (id: string | null) =>
    set((state) => {
      // Clear needsInput and attention on target session when switching to it
      let sessions = state.claudeSessions;
      if (id) {
        sessions = updateSession(sessions, id, () => ({
          needsInput: false,
          attentionPreview: null,
          attentionMessageId: null,
        }));
      }
      const activeSession = id ? sessions.get(id) : undefined;
      return {
        claudeSessions: sessions,
        activeClaudeSessionId: id,
        chatMessages: activeSession?.chatMessages ?? [],
        agentEvents: activeSession?.agentEvents ?? [],
        isWorking: activeSession?.isWorking ?? false,
        conversationId: activeSession?.conversationId ?? null,
        currentInvocationId: activeSession?.currentInvocationId ?? null,
        agentError: activeSession?.agentError ?? null,
      };
    }),

  renameClaudeSession: (id: string, name: string) =>
    set((state) => ({
      claudeSessions: updateSession(state.claudeSessions, id, () => ({
        name,
      })),
    })),

  // ── Session-scoped mutations ──

  addSessionChatMessage: (sessionId: string, message: ChatMessage) =>
    set((state) => {
      const sessions = updateSession(
        state.claudeSessions,
        sessionId,
        (s) => ({ chatMessages: [...s.chatMessages, message] }),
      );
      const isActive = sessionId === state.activeClaudeSessionId;
      return {
        claudeSessions: sessions,
        ...(isActive
          ? { chatMessages: sessions.get(sessionId)!.chatMessages }
          : {}),
      };
    }),

  addSessionAgentEvent: (sessionId: string, event: AgentEvent) =>
    set((state) => {
      const sessions = updateSession(
        state.claudeSessions,
        sessionId,
        (s) => ({ agentEvents: [...s.agentEvents, event] }),
      );
      const isActive = sessionId === state.activeClaudeSessionId;
      return {
        claudeSessions: sessions,
        ...(isActive
          ? { agentEvents: sessions.get(sessionId)!.agentEvents }
          : {}),
      };
    }),

  appendToSessionLastAssistant: (sessionId: string, text: string) =>
    set((state) => {
      const sessions = updateSession(
        state.claudeSessions,
        sessionId,
        (s) => {
          const messages = [...s.chatMessages];
          const lastIdx = messages.length - 1;
          if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
            messages[lastIdx] = {
              ...messages[lastIdx],
              content: messages[lastIdx].content + text,
            };
          } else {
            messages.push({
              id: crypto.randomUUID(),
              role: "assistant",
              content: text,
              timestamp: new Date().toISOString(),
            });
          }
          return { chatMessages: messages };
        },
      );
      const isActive = sessionId === state.activeClaudeSessionId;
      return {
        claudeSessions: sessions,
        ...(isActive
          ? { chatMessages: sessions.get(sessionId)!.chatMessages }
          : {}),
      };
    }),

  setSessionWorking: (sessionId: string, working: boolean) =>
    set((state) => {
      const sessions = updateSession(
        state.claudeSessions,
        sessionId,
        () => ({ isWorking: working }),
      );
      const isActive = sessionId === state.activeClaudeSessionId;
      return {
        claudeSessions: sessions,
        ...(isActive ? { isWorking: working } : {}),
      };
    }),

  setSessionConversationId: (sessionId: string, id: string | null) =>
    set((state) => {
      const sessions = updateSession(
        state.claudeSessions,
        sessionId,
        () => ({ conversationId: id }),
      );
      const isActive = sessionId === state.activeClaudeSessionId;
      return {
        claudeSessions: sessions,
        ...(isActive ? { conversationId: id } : {}),
      };
    }),

  setSessionInvocationId: (sessionId: string, id: string | null) =>
    set((state) => {
      const sessions = updateSession(
        state.claudeSessions,
        sessionId,
        () => ({ currentInvocationId: id }),
      );
      const isActive = sessionId === state.activeClaudeSessionId;
      return {
        claudeSessions: sessions,
        ...(isActive ? { currentInvocationId: id } : {}),
      };
    }),

  setSessionError: (sessionId: string, error: string | null) =>
    set((state) => {
      const sessions = updateSession(
        state.claudeSessions,
        sessionId,
        () => ({ agentError: error }),
      );
      const isActive = sessionId === state.activeClaudeSessionId;
      return {
        claudeSessions: sessions,
        ...(isActive ? { agentError: error } : {}),
      };
    }),

  setSessionNeedsInput: (sessionId: string, needsInput: boolean) =>
    set((state) => ({
      claudeSessions: updateSession(
        state.claudeSessions,
        sessionId,
        () => ({ needsInput }),
      ),
    })),

  clearSessionChat: (sessionId: string) =>
    set((state) => {
      const sessions = updateSession(
        state.claudeSessions,
        sessionId,
        () => ({
          chatMessages: [],
          agentEvents: [],
          conversationId: null,
          currentInvocationId: null,
          agentError: null,
          needsInput: false,
          currentActivityMessageId: null,
        }),
      );
      const isActive = sessionId === state.activeClaudeSessionId;
      return {
        claudeSessions: sessions,
        ...(isActive
          ? {
              chatMessages: [],
              agentEvents: [],
              conversationId: null,
              currentInvocationId: null,
              agentError: null,
            }
          : {}),
      };
    }),

  // ── Attention tracking ──

  setSessionAttention: (sessionId: string, preview: string | null, messageId: string | null) =>
    set((state) => ({
      claudeSessions: updateSession(state.claudeSessions, sessionId, () => ({
        attentionPreview: preview,
        attentionMessageId: messageId,
      })),
    })),

  clearSessionAttention: (sessionId: string) =>
    set((state) => ({
      claudeSessions: updateSession(state.claudeSessions, sessionId, () => ({
        attentionPreview: null,
        attentionMessageId: null,
        needsInput: false,
      })),
    })),

  // ── Rich card methods ──

  upsertActivityLine: (sessionId: string, event: AgentEvent) =>
    set((state) => {
      const session = state.claudeSessions.get(sessionId);
      if (!session) return {};

      const tool = event.metadata?.tool as string | undefined;
      const path = event.metadata?.path as string | undefined;
      const activityEvent: ActivityEvent = {
        type: event.event_type,
        content: event.content,
        tool,
        path,
        timestamp: event.timestamp,
      };

      if (session.currentActivityMessageId) {
        // Update existing activity line
        const sessions = updateSession(
          state.claudeSessions,
          sessionId,
          (s) => {
            const messages = s.chatMessages.map((msg) => {
              if (msg.id !== s.currentActivityMessageId) return msg;
              const existingEvents = (msg.cardData?.events as ActivityEvent[]) ?? [];
              const updatedEvents = [...existingEvents, activityEvent];
              return {
                ...msg,
                content: summarizeActivity(updatedEvents),
                cardData: { ...msg.cardData, events: updatedEvents },
              };
            });
            return { chatMessages: messages };
          },
        );
        const isActive = sessionId === state.activeClaudeSessionId;
        return {
          claudeSessions: sessions,
          ...(isActive
            ? { chatMessages: sessions.get(sessionId)!.chatMessages }
            : {}),
        };
      } else {
        // Create new activity line message
        const newId = crypto.randomUUID();
        const newMsg: ChatMessage = {
          id: newId,
          role: "system",
          content: summarizeActivity([activityEvent]),
          timestamp: event.timestamp,
          cardType: "activity",
          cardData: { events: [activityEvent] },
        };
        const sessions = updateSession(
          state.claudeSessions,
          sessionId,
          (s) => ({
            chatMessages: [...s.chatMessages, newMsg],
            currentActivityMessageId: newId,
          }),
        );
        const isActive = sessionId === state.activeClaudeSessionId;
        return {
          claudeSessions: sessions,
          ...(isActive
            ? { chatMessages: sessions.get(sessionId)!.chatMessages }
            : {}),
        };
      }
    }),

  finalizeActivityLine: (sessionId: string) =>
    set((state) => {
      const session = state.claudeSessions.get(sessionId);
      if (!session || !session.currentActivityMessageId) return {};
      const sessions = updateSession(
        state.claudeSessions,
        sessionId,
        () => ({ currentActivityMessageId: null }),
      );
      return { claudeSessions: sessions };
    }),

  insertRichCard: (
    sessionId: string,
    cardType: CardType,
    content: string,
    cardData: Record<string, unknown>,
  ) =>
    set((state) => {
      const session = state.claudeSessions.get(sessionId);
      if (!session) return {};

      // Finalize any open activity line first
      let sessions = state.claudeSessions;
      if (session.currentActivityMessageId) {
        sessions = updateSession(sessions, sessionId, () => ({
          currentActivityMessageId: null,
        }));
      }

      const newMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        content,
        timestamp: new Date().toISOString(),
        cardType,
        cardData,
      };
      sessions = updateSession(sessions, sessionId, (s) => ({
        chatMessages: [...s.chatMessages, newMsg],
      }));
      const isActive = sessionId === state.activeClaudeSessionId;
      return {
        claudeSessions: sessions,
        ...(isActive
          ? { chatMessages: sessions.get(sessionId)!.chatMessages }
          : {}),
      };
    }),

  // ── Legacy compat methods (delegate to active session) ──

  addChatMessage: (message: ChatMessage) => {
    const { activeClaudeSessionId, addSessionChatMessage } = get();
    if (activeClaudeSessionId) {
      addSessionChatMessage(activeClaudeSessionId, message);
    }
  },

  addAgentEvent: (event: AgentEvent) => {
    const { activeClaudeSessionId, addSessionAgentEvent } = get();
    if (activeClaudeSessionId) {
      addSessionAgentEvent(activeClaudeSessionId, event);
    }
  },

  appendToLastAssistant: (text: string) => {
    const { activeClaudeSessionId, appendToSessionLastAssistant } = get();
    if (activeClaudeSessionId) {
      appendToSessionLastAssistant(activeClaudeSessionId, text);
    }
  },

  setWorking: (working: boolean) => {
    const { activeClaudeSessionId, setSessionWorking } = get();
    if (activeClaudeSessionId) {
      setSessionWorking(activeClaudeSessionId, working);
    } else {
      set({ isWorking: working });
    }
  },

  setConversationId: (id: string | null) => {
    const { activeClaudeSessionId, setSessionConversationId } = get();
    if (activeClaudeSessionId) {
      setSessionConversationId(activeClaudeSessionId, id);
    } else {
      set({ conversationId: id });
    }
  },

  setCurrentInvocationId: (id: string | null) => {
    const { activeClaudeSessionId, setSessionInvocationId } = get();
    if (activeClaudeSessionId) {
      setSessionInvocationId(activeClaudeSessionId, id);
    } else {
      set({ currentInvocationId: id });
    }
  },

  setAgentError: (error: string | null) => {
    const { activeClaudeSessionId, setSessionError } = get();
    if (activeClaudeSessionId) {
      setSessionError(activeClaudeSessionId, error);
    } else {
      set({ agentError: error });
    }
  },

  clearChat: () => {
    const { activeClaudeSessionId, clearSessionChat } = get();
    if (activeClaudeSessionId) {
      clearSessionChat(activeClaudeSessionId);
    } else {
      set({
        chatMessages: [],
        agentEvents: [],
        conversationId: null,
        currentInvocationId: null,
        agentError: null,
      });
    }
  },
});
