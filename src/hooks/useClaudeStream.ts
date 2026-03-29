import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "../stores";
import { commands } from "../lib/tauri";
import {
  isStatusEvent,
  isAgentEvent,
  isAssistantText,
  isInputRequest,
  getSessionId,
} from "../lib/eventParser";
import type { AgentEvent } from "../stores/types";

/**
 * Hook that listens to 'claude-stream' Tauri events and dispatches
 * parsed events to the Zustand agentSlice, routed by claude_session_id.
 *
 * Mount this once at the app level (e.g., in App.tsx or the ClaudeChat panel).
 * It handles:
 * - Status events (working/done/cancelled) -> setSessionWorking, setSessionConversationId
 * - Agent events (think/file_create/etc.) -> addSessionAgentEvent
 * - Assistant text -> appendToSessionLastAssistant for streaming chat display
 * - Input-request detection -> setSessionNeedsInput on non-active sessions
 * - Auto-creates sessions in store if events arrive for unknown session id
 */
export function useClaudeStream() {
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    let mounted = true;

    async function setup() {
      const unlisten = await listen<unknown>(
        "claude-stream",
        async (tauriEvent) => {
          if (!mounted) return;

          const payload = tauriEvent.payload;
          const store = useAppStore.getState();

          // Extract session ID from payload, fall back to active session
          const sessionId =
            getSessionId(payload) ?? store.activeClaudeSessionId;

          // Auto-create session in store if events arrive for unknown session
          if (sessionId && !store.claudeSessions.has(sessionId)) {
            store.createClaudeSessionLocal(sessionId, "Session");
          }

          if (isStatusEvent(payload)) {
            const sid = sessionId;
            switch (payload.status) {
              case "working":
                if (sid) {
                  store.setSessionWorking(sid, true);
                  store.setSessionInvocationId(sid, payload.invocation_id);
                }
                // Legacy dual-write
                store.setWorking(true);
                store.setCurrentInvocationId(payload.invocation_id);
                break;
              case "done":
                if (sid) {
                  store.finalizeActivityLine(sid);
                  store.setSessionWorking(sid, false);
                  store.setSessionInvocationId(sid, null);
                }
                store.setWorking(false);
                store.setCurrentInvocationId(null);
                break;
              case "cancelled":
                if (sid) {
                  store.finalizeActivityLine(sid);
                  store.setSessionWorking(sid, false);
                  store.setSessionInvocationId(sid, null);
                }
                store.setWorking(false);
                store.setCurrentInvocationId(null);
                break;
            }
            return;
          }

          if (isAgentEvent(payload)) {
            const event = payload as AgentEvent;
            const sid = sessionId;

            // Route to session-scoped methods
            if (sid) {
              store.addSessionAgentEvent(sid, event);
            }
            // Legacy dual-write
            store.addAgentEvent(event);

            // Rich card routing: tool events produce inline activity lines
            if (event.metadata?.tool && sid) {
              store.upsertActivityLine(sid, event);
            }

            // Handle result events -- extract conversation_id for multi-turn
            if (
              event.event_type === "result" &&
              event.metadata?.session_id
            ) {
              const convId = event.metadata.session_id as string;
              if (sid) {
                store.setSessionConversationId(sid, convId);
              }
              store.setConversationId(convId);

              // Create outcome card from accumulated agent events
              if (sid) {
                const session = useAppStore.getState().claudeSessions.get(sid);
                if (session) {
                  const filesCreated = session.agentEvents
                    .filter((e) => e.event_type === "file_create")
                    .map((e) => (e.metadata?.path as string) || e.content);
                  const filesEdited = session.agentEvents
                    .filter((e) => e.event_type === "file_modify")
                    .map((e) => (e.metadata?.path as string) || e.content);
                  const testEvents = session.agentEvents.filter(
                    (e) => e.event_type === "test_run",
                  );
                  const testsRun = testEvents.length;
                  const testsPassed =
                    testsRun > 0
                      ? testEvents.every(
                          (e) => (e.metadata?.result as string) === "pass",
                        )
                      : null;

                  const fileCount = filesCreated.length + filesEdited.length;
                  if (fileCount > 0 || testsRun > 0) {
                    const testText =
                      testsRun > 0
                        ? testsPassed
                          ? ", all tests passing"
                          : ", tests failed"
                        : "";
                    useAppStore
                      .getState()
                      .insertRichCard(
                        sid,
                        "outcome",
                        `Changed ${fileCount} file${fileCount !== 1 ? "s" : ""}${testText}`,
                        {
                          filesCreated,
                          filesEdited,
                          testsRun,
                          testsPassed,
                          costUsd:
                            (event.metadata?.cost_usd as number) ?? null,
                          durationMs:
                            (event.metadata?.duration_ms as number) ?? null,
                        },
                      );
                  }
                }
              }
            }

            // Accumulate assistant text into chat messages
            // Finalize activity line before appending assistant text
            if (isAssistantText(event) && event.content) {
              if (sid) {
                store.finalizeActivityLine(sid);
                store.appendToSessionLastAssistant(sid, event.content);
              } else {
                store.appendToLastAssistant(event.content);
              }
            }

            // Set error state for error events
            if (event.event_type === "error") {
              if (sid) {
                // Insert error card into chat before setting error state
                const lines = event.content.split("\n");
                const errorMessage = lines[0] || "An error occurred";
                useAppStore.getState().insertRichCard(sid, "error", errorMessage, {
                  errorMessage,
                  fullError: event.content,
                  sessionId: sid,
                });

                store.setSessionError(sid, event.content);
              }
              store.setAgentError(event.content);
            }

            // Detect input-request events; set needsInput on non-active sessions
            if (isInputRequest(payload) && sid) {
              if (sid !== store.activeClaudeSessionId) {
                store.setSessionNeedsInput(sid, true);
              }
            }

            // Wire file_modify/file_create events to pendingDiffs (keep existing logic)
            if (
              event.event_type === "file_modify" ||
              event.event_type === "file_create"
            ) {
              const filePath =
                (event.metadata?.file_path as string) || "";
              const proposedContent =
                (event.metadata?.content as string) || event.content;

              if (filePath && proposedContent) {
                const originalContent =
                  event.event_type === "file_modify"
                    ? await commands
                        .readFile(filePath)
                        .catch(() => "")
                    : "";

                useAppStore.getState().addPendingDiff({
                  filePath,
                  originalContent,
                  proposedContent,
                  timestamp: event.timestamp,
                });
              }
            }
          }
        },
      );

      if (mounted) {
        unlistenRef.current = unlisten;
      } else {
        unlisten();
      }
    }

    setup();

    return () => {
      mounted = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);
}
