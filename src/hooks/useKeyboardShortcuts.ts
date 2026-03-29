import { useEffect } from "react";

/**
 * Global keyboard shortcuts for VIBE OS.
 * Ctrl+S is handled by Monaco directly.
 * This hook handles shortcuts that should work outside Monaco.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

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
        // Ctrl+Enter is handled per-component (chat input, console input)
        // Ctrl+S is handled by Monaco command system
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
