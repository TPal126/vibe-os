import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "../stores";

export function useWorkspaceWatcher() {
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);

  useEffect(() => {
    if (!activeWorkspace) {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      return;
    }

    let mounted = true;

    async function setup() {
      const unlisten = await listen<string>(
        "workspace-claude-md-changed",
        (event) => {
          if (!mounted) return;
          const content = event.payload;
          const currentPrompt = useAppStore.getState().systemPrompt;
          if (content !== currentPrompt) {
            useAppStore.getState().setSystemPrompt(content);
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
  }, [activeWorkspace?.path]);
}
