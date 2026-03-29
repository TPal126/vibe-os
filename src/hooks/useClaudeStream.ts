import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "../stores";
import {
  isStatusEvent,
  isAgentEvent,
  isAssistantText,
} from "../lib/eventParser";
import type { AgentEvent } from "../stores/types";

/**
 * Hook that listens to 'claude-stream' Tauri events and dispatches
 * parsed events to the Zustand agentSlice.
 *
 * Mount this once at the app level (e.g., in App.tsx or the ClaudeChat panel).
 * It handles:
 * - Status events (working/done/cancelled) -> setWorking, setConversationId
 * - Agent events (think/file_create/etc.) -> addAgentEvent
 * - Assistant text -> appendToLastAssistant for streaming chat display
 */
export function useClaudeStream() {
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    let mounted = true;

    async function setup() {
      const unlisten = await listen<unknown>(
        "claude-stream",
        (tauriEvent) => {
          if (!mounted) return;

          const payload = tauriEvent.payload;
          const store = useAppStore.getState();

          if (isStatusEvent(payload)) {
            switch (payload.status) {
              case "working":
                store.setWorking(true);
                store.setCurrentInvocationId(payload.invocation_id);
                break;
              case "done":
                store.setWorking(false);
                store.setCurrentInvocationId(null);
                break;
              case "cancelled":
                store.setWorking(false);
                store.setCurrentInvocationId(null);
                break;
            }
            return;
          }

          if (isAgentEvent(payload)) {
            const event = payload as AgentEvent;

            // Always add to agent events stream
            store.addAgentEvent(event);

            // Handle result events -- extract conversation_id for multi-turn
            if (
              event.event_type === "result" &&
              event.metadata?.session_id
            ) {
              store.setConversationId(
                event.metadata.session_id as string,
              );
            }

            // Accumulate assistant text into chat messages
            if (isAssistantText(event) && event.content) {
              store.appendToLastAssistant(event.content);
            }

            // Set error state for error events
            if (event.event_type === "error") {
              store.setAgentError(event.content);
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
