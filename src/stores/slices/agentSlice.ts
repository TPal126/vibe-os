import type {
  SliceCreator,
  AgentSlice,
  ChatMessage,
  AgentEvent,
  AgentSessionState,
  AgentTask,
  ActivityEvent,
  CardType,
  TestSummary,
  BuildStatus,
  ApiMetrics,
} from "../types";
import { commands } from "../../lib/tauri";

// ── Helpers ──

function createDefaultSession(id: string, name: string, backend: "claude" | "codex" | "sidecar" = "sidecar"): AgentSessionState {
  return {
    id,
    name,
    backend,
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
    previewUrl: null,
    testSummary: null,
    buildStatus: "idle" as const,
    buildStatusText: null,
    apiMetrics: null,
    tasks: [],
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
  sessions: Map<string, AgentSessionState>,
  sessionId: string,
  updater: (s: AgentSessionState) => Partial<AgentSessionState>,
): Map<string, AgentSessionState> {
  const existing = sessions.get(sessionId);
  if (!existing) return sessions;
  const next = new Map(sessions);
  const updated = { ...existing, ...updater(existing) };
  updated.status = deriveStatus(updated);
  next.set(sessionId, updated);
  return next;
}

function deriveStatus(
  s: AgentSessionState,
): AgentSessionState["status"] {
  if (s.agentError) return "error";
  if (s.needsInput) return "needs-input";
  if (s.isWorking) return "working";
  return "idle";
}

// ── Slice ──

export const createAgentSlice: SliceCreator<AgentSlice> = (set, get) => ({
  // CLI availability
  cliAvailable: {},
  cliError: {},

  validateCli: async (backend = "claude") => {
    try {
      const version = await commands.validateClaudeCli();
      set((state) => ({
        cliAvailable: { ...state.cliAvailable, [backend]: true },
        cliError: { ...state.cliError, [backend]: null },
      }));
      console.log("[vibe-os] CLI validated:", version);
    } catch (err) {
      const message =
        typeof err === "string" ? err : (err as Error)?.message ?? String(err);
      set((state) => ({
        cliAvailable: { ...state.cliAvailable, [backend]: false },
        cliError: { ...state.cliError, [backend]: message },
      }));
      console.warn("[vibe-os] CLI validation failed:", message);
    }
  },

  // Per-session state
  agentSessions: new Map<string, AgentSessionState>(),
  activeSessionId: null,

  // Legacy compat defaults
  chatMessages: [],
  agentEvents: [],
  isWorking: false,
  conversationId: null,
  currentInvocationId: null,
  agentError: null,

  // ── Session lifecycle ──

  createSessionLocal: (id: string, name: string, backend: "claude" | "codex" | "sidecar" = "sidecar") =>
    set((state) => {
      const next = new Map(state.agentSessions);
      next.set(id, createDefaultSession(id, name, backend));
      // Auto-activate if first session
      const activeId =
        state.activeSessionId ?? id;
      return { agentSessions: next, activeSessionId: activeId };
    }),

  removeSession: (id: string) =>
    set((state) => {
      const next = new Map(state.agentSessions);
      next.delete(id);
      let activeId = state.activeSessionId;
      if (activeId === id) {
        // Activate another session, or null
        const remaining = Array.from(next.keys());
        activeId = remaining.length > 0 ? remaining[0] : null;
      }
      // Derive legacy state from new active
      const activeSession = activeId ? next.get(activeId) : undefined;
      return {
        agentSessions: next,
        activeSessionId: activeId,
        chatMessages: activeSession?.chatMessages ?? [],
        agentEvents: activeSession?.agentEvents ?? [],
        isWorking: activeSession?.isWorking ?? false,
        conversationId: activeSession?.conversationId ?? null,
        currentInvocationId: activeSession?.currentInvocationId ?? null,
        agentError: activeSession?.agentError ?? null,
      };
    }),

  setActiveSessionId: (id: string | null) =>
    set((state) => {
      // Clear needsInput and attention on target session when switching to it
      let sessions = state.agentSessions;
      if (id) {
        sessions = updateSession(sessions, id, () => ({
          needsInput: false,
          attentionPreview: null,
          attentionMessageId: null,
        }));
      }
      const activeSession = id ? sessions.get(id) : undefined;
      return {
        agentSessions: sessions,
        activeSessionId: id,
        chatMessages: activeSession?.chatMessages ?? [],
        agentEvents: activeSession?.agentEvents ?? [],
        isWorking: activeSession?.isWorking ?? false,
        conversationId: activeSession?.conversationId ?? null,
        currentInvocationId: activeSession?.currentInvocationId ?? null,
        agentError: activeSession?.agentError ?? null,
      };
    }),

  renameSession: (id: string, name: string) =>
    set((state) => ({
      agentSessions: updateSession(state.agentSessions, id, () => ({
        name,
      })),
    })),

  // ── Session-scoped mutations ──

  addSessionChatMessage: (sessionId: string, message: ChatMessage) =>
    set((state) => {
      const sessions = updateSession(
        state.agentSessions,
        sessionId,
        (s) => ({ chatMessages: [...s.chatMessages, message] }),
      );
      const isActive = sessionId === state.activeSessionId;
      return {
        agentSessions: sessions,
        ...(isActive
          ? { chatMessages: sessions.get(sessionId)!.chatMessages }
          : {}),
      };
    }),

  addSessionAgentEvent: (sessionId: string, event: AgentEvent) =>
    set((state) => {
      const sessions = updateSession(
        state.agentSessions,
        sessionId,
        (s) => ({ agentEvents: [...s.agentEvents, event] }),
      );
      const isActive = sessionId === state.activeSessionId;
      return {
        agentSessions: sessions,
        ...(isActive
          ? { agentEvents: sessions.get(sessionId)!.agentEvents }
          : {}),
      };
    }),

  appendToSessionLastAssistant: (sessionId: string, text: string) =>
    set((state) => {
      const sessions = updateSession(
        state.agentSessions,
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
      const isActive = sessionId === state.activeSessionId;
      return {
        agentSessions: sessions,
        ...(isActive
          ? { chatMessages: sessions.get(sessionId)!.chatMessages }
          : {}),
      };
    }),

  setSessionWorking: (sessionId: string, working: boolean) =>
    set((state) => {
      const sessions = updateSession(
        state.agentSessions,
        sessionId,
        () => ({ isWorking: working }),
      );
      const isActive = sessionId === state.activeSessionId;
      return {
        agentSessions: sessions,
        ...(isActive ? { isWorking: working } : {}),
      };
    }),

  setSessionConversationId: (sessionId: string, id: string | null) =>
    set((state) => {
      const sessions = updateSession(
        state.agentSessions,
        sessionId,
        () => ({ conversationId: id }),
      );
      const isActive = sessionId === state.activeSessionId;
      return {
        agentSessions: sessions,
        ...(isActive ? { conversationId: id } : {}),
      };
    }),

  setSessionInvocationId: (sessionId: string, id: string | null) =>
    set((state) => {
      const sessions = updateSession(
        state.agentSessions,
        sessionId,
        () => ({ currentInvocationId: id }),
      );
      const isActive = sessionId === state.activeSessionId;
      return {
        agentSessions: sessions,
        ...(isActive ? { currentInvocationId: id } : {}),
      };
    }),

  setSessionError: (sessionId: string, error: string | null) =>
    set((state) => {
      const sessions = updateSession(
        state.agentSessions,
        sessionId,
        () => ({ agentError: error }),
      );
      const isActive = sessionId === state.activeSessionId;
      return {
        agentSessions: sessions,
        ...(isActive ? { agentError: error } : {}),
      };
    }),

  setSessionNeedsInput: (sessionId: string, needsInput: boolean) =>
    set((state) => ({
      agentSessions: updateSession(
        state.agentSessions,
        sessionId,
        () => ({ needsInput }),
      ),
    })),

  clearSessionChat: (sessionId: string) =>
    set((state) => {
      const sessions = updateSession(
        state.agentSessions,
        sessionId,
        () => ({
          chatMessages: [],
          agentEvents: [],
          conversationId: null,
          currentInvocationId: null,
          agentError: null,
          needsInput: false,
          currentActivityMessageId: null,
          previewUrl: null,
          testSummary: null,
          buildStatus: "idle" as const,
          buildStatusText: null,
          apiMetrics: null,
          tasks: [],
        }),
      );
      const isActive = sessionId === state.activeSessionId;
      return {
        agentSessions: sessions,
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
      agentSessions: updateSession(state.agentSessions, sessionId, () => ({
        attentionPreview: preview,
        attentionMessageId: messageId,
      })),
    })),

  clearSessionAttention: (sessionId: string) =>
    set((state) => ({
      agentSessions: updateSession(state.agentSessions, sessionId, () => ({
        attentionPreview: null,
        attentionMessageId: null,
        needsInput: false,
      })),
    })),

  // ── Rich card methods ──

  upsertActivityLine: (sessionId: string, event: AgentEvent) =>
    set((state) => {
      const session = state.agentSessions.get(sessionId);
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
          state.agentSessions,
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
        const isActive = sessionId === state.activeSessionId;
        return {
          agentSessions: sessions,
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
          state.agentSessions,
          sessionId,
          (s) => ({
            chatMessages: [...s.chatMessages, newMsg],
            currentActivityMessageId: newId,
          }),
        );
        const isActive = sessionId === state.activeSessionId;
        return {
          agentSessions: sessions,
          ...(isActive
            ? { chatMessages: sessions.get(sessionId)!.chatMessages }
            : {}),
        };
      }
    }),

  finalizeActivityLine: (sessionId: string) =>
    set((state) => {
      const session = state.agentSessions.get(sessionId);
      if (!session || !session.currentActivityMessageId) return {};
      const sessions = updateSession(
        state.agentSessions,
        sessionId,
        () => ({ currentActivityMessageId: null }),
      );
      return { agentSessions: sessions };
    }),

  insertRichCard: (
    sessionId: string,
    cardType: CardType,
    content: string,
    cardData: Record<string, unknown>,
  ) =>
    set((state) => {
      const session = state.agentSessions.get(sessionId);
      if (!session) return {};

      // Finalize any open activity line first
      let sessions = state.agentSessions;
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
      const isActive = sessionId === state.activeSessionId;
      return {
        agentSessions: sessions,
        ...(isActive
          ? { chatMessages: sessions.get(sessionId)!.chatMessages }
          : {}),
      };
    }),

  // ── Outcome state methods ──

  setSessionPreviewUrl: (sessionId: string, url: string | null) =>
    set((state) => ({
      agentSessions: updateSession(state.agentSessions, sessionId, () => ({
        previewUrl: url,
      })),
    })),

  setSessionTestSummary: (sessionId: string, summary: TestSummary | null) =>
    set((state) => ({
      agentSessions: updateSession(state.agentSessions, sessionId, () => ({
        testSummary: summary,
      })),
    })),

  setSessionBuildStatus: (sessionId: string, status: BuildStatus, text: string | null) =>
    set((state) => ({
      agentSessions: updateSession(state.agentSessions, sessionId, () => ({
        buildStatus: status,
        buildStatusText: text,
      })),
    })),

  setSessionApiMetrics: (sessionId: string, metrics: ApiMetrics) =>
    set((state) => ({
      agentSessions: updateSession(state.agentSessions, sessionId, (s) => {
        // Accumulate metrics across turns within the same session
        const prev = s.apiMetrics;
        if (!prev) return { apiMetrics: metrics };
        return {
          apiMetrics: {
            inputTokens: prev.inputTokens + metrics.inputTokens,
            outputTokens: prev.outputTokens + metrics.outputTokens,
            cacheCreationInputTokens: prev.cacheCreationInputTokens + metrics.cacheCreationInputTokens,
            cacheReadInputTokens: prev.cacheReadInputTokens + metrics.cacheReadInputTokens,
            cost: prev.cost + metrics.cost,
            durationMs: prev.durationMs + metrics.durationMs,
            durationApiMs: prev.durationApiMs + metrics.durationApiMs,
          },
        };
      }),
    })),

  // ── Task tracking ──

  upsertSessionTask: (sessionId: string, task: AgentTask) =>
    set((state) => ({
      agentSessions: updateSession(state.agentSessions, sessionId, (s) => {
        const idx = s.tasks.findIndex((t) => t.id === task.id);
        if (idx >= 0) {
          const tasks = [...s.tasks];
          tasks[idx] = task;
          return { tasks };
        }
        return { tasks: [...s.tasks, task] };
      }),
    })),

  updateSessionTaskStatus: (sessionId: string, taskId: string, status: AgentTask["status"]) =>
    set((state) => ({
      agentSessions: updateSession(state.agentSessions, sessionId, (s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, status } : t,
        ),
      })),
    })),

  // ── Legacy compat methods (delegate to active session) ──

  addChatMessage: (message: ChatMessage) => {
    const { activeSessionId, addSessionChatMessage } = get();
    if (activeSessionId) {
      addSessionChatMessage(activeSessionId, message);
    }
  },

  addAgentEvent: (event: AgentEvent) => {
    const { activeSessionId, addSessionAgentEvent } = get();
    if (activeSessionId) {
      addSessionAgentEvent(activeSessionId, event);
    }
  },

  appendToLastAssistant: (text: string) => {
    const { activeSessionId, appendToSessionLastAssistant } = get();
    if (activeSessionId) {
      appendToSessionLastAssistant(activeSessionId, text);
    }
  },

  setWorking: (working: boolean) => {
    const { activeSessionId, setSessionWorking } = get();
    if (activeSessionId) {
      setSessionWorking(activeSessionId, working);
    } else {
      set({ isWorking: working });
    }
  },

  setConversationId: (id: string | null) => {
    const { activeSessionId, setSessionConversationId } = get();
    if (activeSessionId) {
      setSessionConversationId(activeSessionId, id);
    } else {
      set({ conversationId: id });
    }
  },

  setCurrentInvocationId: (id: string | null) => {
    const { activeSessionId, setSessionInvocationId } = get();
    if (activeSessionId) {
      setSessionInvocationId(activeSessionId, id);
    } else {
      set({ currentInvocationId: id });
    }
  },

  setAgentError: (error: string | null) => {
    const { activeSessionId, setSessionError } = get();
    if (activeSessionId) {
      setSessionError(activeSessionId, error);
    } else {
      set({ agentError: error });
    }
  },

  clearChat: () => {
    const { activeSessionId, clearSessionChat } = get();
    if (activeSessionId) {
      clearSessionChat(activeSessionId);
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
