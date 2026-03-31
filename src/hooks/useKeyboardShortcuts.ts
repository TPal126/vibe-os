import { useEffect } from "react";
import { useAppStore } from "../stores";
import type { PaneId } from "../stores/types";

/**
 * Global keyboard shortcuts for VIBE OS.
 * Ctrl+S is handled by Monaco directly.
 * This hook handles shortcuts that should work outside Monaco.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape: restore maximized pane (takes priority over editor panel close)
      if (e.key === "Escape") {
        const { maximizedPane, setMaximizedPane } = useAppStore.getState();
        if (maximizedPane) {
          e.preventDefault();
          setMaximizedPane(null);
          return;
        }
      }

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      // Ctrl+1-4: maximize/restore quadrant panes
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const paneMap: Record<string, PaneId> = {
          "1": "top-left",
          "2": "top-right",
          "3": "bottom-left",
          "4": "bottom-right",
        };
        const pane = paneMap[e.key];
        if (pane) {
          e.preventDefault();
          const { maximizedPane, setMaximizedPane } = useAppStore.getState();
          setMaximizedPane(maximizedPane === pane ? null : pane);
          return;
        }
      }

      switch (e.key) {
        case "r":
        case "R": {
          // Ctrl+R: Focus console input instead of browser reload
          e.preventDefault();
          const consoleInput = document.querySelector<HTMLInputElement>(
            "[data-console-input]",
          );
          if (consoleInput) {
            consoleInput.focus();
          }
          break;
        }
        case "c":
        case "C": {
          // Ctrl+Shift+C: Toggle editor panel (escape hatch)
          if (e.shiftKey) {
            e.preventDefault();
            useAppStore.getState().toggleEditorPanel();
          }
          break;
        }
        // Ctrl+Enter is handled per-component (chat input, console input)
        // Ctrl+S is handled by Monaco command system
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
