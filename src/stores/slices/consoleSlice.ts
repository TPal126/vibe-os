import type { SliceCreator, ConsoleSlice } from "../types";

const MAX_ENTRIES = 1000;

export const createConsoleSlice: SliceCreator<ConsoleSlice> = (set, get) => ({
  entries: [],
  inputHistory: [],
  historyIndex: -1,
  pythonRunning: false,

  addEntry: (entry) => {
    const full = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    set((state) => {
      const next = [...state.entries, full];
      // Trim oldest if exceeding max
      if (next.length > MAX_ENTRIES) {
        return { entries: next.slice(next.length - MAX_ENTRIES) };
      }
      return { entries: next };
    });
  },

  pushHistory: (cmd) => {
    set((state) => {
      // Avoid duplicate of last entry
      if (
        state.inputHistory.length > 0 &&
        state.inputHistory[state.inputHistory.length - 1] === cmd
      ) {
        return { historyIndex: -1 };
      }
      return {
        inputHistory: [...state.inputHistory, cmd],
        historyIndex: -1,
      };
    });
  },

  navigateHistory: (direction) => {
    const { inputHistory, historyIndex } = get();
    if (inputHistory.length === 0) return "";

    let newIndex: number;
    if (direction === "up") {
      // Going backward in history (toward older commands)
      newIndex =
        historyIndex === -1
          ? inputHistory.length - 1
          : Math.max(0, historyIndex - 1);
    } else {
      // Going forward in history (toward newer commands)
      if (historyIndex === -1) return "";
      newIndex = historyIndex + 1;
      if (newIndex >= inputHistory.length) {
        set({ historyIndex: -1 });
        return "";
      }
    }

    set({ historyIndex: newIndex });
    return inputHistory[newIndex] ?? "";
  },

  setPythonRunning: (running) => {
    set({ pythonRunning: running });
  },

  clearEntries: () => {
    set({ entries: [] });
  },
});
