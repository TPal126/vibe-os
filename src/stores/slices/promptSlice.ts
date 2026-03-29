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
      const { systemPrompt, taskContext, skills, repos, tokenBudgets } = get();

      const activeSkillPaths = skills
        .filter((s) => s.active)
        .map((s) => s.filePath);

      const activeRepoSummaries = repos
        .filter((r) => r.active && r.indexSummary)
        .map((r) => r.indexSummary as string);

      // Build skill budgets: [skillPath, maxTokens][]
      const skillBudgets: [string, number][] = [];
      for (const skill of skills.filter((s) => s.active)) {
        const budget = tokenBudgets.find(
          (b) => b.scopeType === "skill" && b.scopeId === skill.id,
        );
        if (budget) {
          skillBudgets.push([skill.filePath, budget.maxTokens]);
        }
      }

      // Build repo budgets: [repoIndex, maxTokens][]
      const activeRepos = repos.filter((r) => r.active && r.indexSummary);
      const repoBudgets: [string, number][] = [];
      for (let i = 0; i < activeRepos.length; i++) {
        const budget = tokenBudgets.find(
          (b) => b.scopeType === "repo" && b.scopeId === activeRepos[i].id,
        );
        if (budget) {
          repoBudgets.push([i.toString(), budget.maxTokens]);
        }
      }

      // Session budget
      const sessionBudgetEntry = tokenBudgets.find(
        (b) => b.scopeType === "session" && b.scopeId === "global",
      );
      const sessionBudget = sessionBudgetEntry?.maxTokens;

      const result = await commands.composePrompt(
        systemPrompt,
        taskContext,
        activeSkillPaths,
        activeRepoSummaries,
        skillBudgets.length > 0 ? skillBudgets : undefined,
        repoBudgets.length > 0 ? repoBudgets : undefined,
        sessionBudget,
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
