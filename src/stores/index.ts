import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSessionSlice } from "./slices/sessionSlice";
import { createRepoSlice } from "./slices/repoSlice";
import { createSkillSlice } from "./slices/skillSlice";
import { createPromptSlice } from "./slices/promptSlice";
import { createEditorSlice } from "./slices/editorSlice";
import { tauriSqliteStorage } from "./storage";
import type { AppState } from "./types";

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createSessionSlice(...a),
      ...createRepoSlice(...a),
      ...createSkillSlice(...a),
      ...createPromptSlice(...a),
      ...createEditorSlice(...a),
    }),
    {
      name: "vibe-os-store",
      storage: createJSONStorage(() => tauriSqliteStorage),
      // Only persist user-editable state, not computed values
      // Editor state NOT persisted -- files are on disk
      partialize: (state) => ({
        systemPrompt: state.systemPrompt,
        activeSession: state.activeSession,
      }),
    },
  ),
);

// Re-export types for convenience
export type { AppState, Repo, Skill } from "./types";
