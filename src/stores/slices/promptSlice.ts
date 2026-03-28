import type { SliceCreator, PromptSlice } from "../types";
import { commands } from "../../lib/tauri";

export const createPromptSlice: SliceCreator<PromptSlice> = (set, get) => ({
  systemPrompt: "",
  taskContext: "",
  composedPrompt: null,

  setSystemPrompt: async (text: string) => {
    set({ systemPrompt: text });
    try {
      // Persist to SQLite via session
      await commands.updateSessionPrompt(text);
      // Recompose with updated system prompt
      await get().recompose();
    } catch (err) {
      console.error("Failed to save system prompt:", err);
    }
  },

  setTaskContext: (text: string) => {
    set({ taskContext: text });
    // Recompose will be called explicitly if needed
  },

  recompose: async () => {
    try {
      const { systemPrompt, taskContext, skills, repos } = get();

      const activeSkillPaths = skills
        .filter((s) => s.active)
        .map((s) => s.filePath);

      const activeRepoSummaries = repos
        .filter((r) => r.active && r.indexSummary)
        .map((r) => r.indexSummary as string);

      const result = await commands.composePrompt(
        systemPrompt,
        taskContext,
        activeSkillPaths,
        activeRepoSummaries,
      );

      set({
        composedPrompt: {
          system: result.system,
          task: result.task,
          skills: result.skills,
          repo: result.repo,
          full: result.full,
          totalTokens: result.total_tokens,
        },
      });
    } catch (err) {
      console.error("Failed to compose prompt:", err);
    }
  },
});
