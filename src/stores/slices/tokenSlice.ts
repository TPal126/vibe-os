import type { SliceCreator, TokenSlice, TokenBudget } from "../types";
import { commands } from "../../lib/tauri";

export const createTokenSlice: SliceCreator<TokenSlice> = (set, get) => ({
  tokenBudgets: [],
  tokenBudgetsLoading: false,

  loadTokenBudgets: async () => {
    set({ tokenBudgetsLoading: true });
    try {
      const raw = await commands.getTokenBudgets();
      const budgets: TokenBudget[] = raw.map((r) => ({
        id: r.id,
        scopeType: r.scope_type as "skill" | "repo" | "session",
        scopeId: r.scope_id,
        maxTokens: r.max_tokens,
        warningThreshold: r.warning_threshold,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      set({ tokenBudgets: budgets });
    } catch (err) {
      console.error("Failed to load token budgets:", err);
    } finally {
      set({ tokenBudgetsLoading: false });
    }
  },

  setTokenBudget: async (scopeType, scopeId, maxTokens, warningThreshold) => {
    try {
      const raw = await commands.setTokenBudget(
        scopeType,
        scopeId,
        maxTokens,
        warningThreshold,
      );
      const budget: TokenBudget = {
        id: raw.id,
        scopeType: raw.scope_type as "skill" | "repo" | "session",
        scopeId: raw.scope_id,
        maxTokens: raw.max_tokens,
        warningThreshold: raw.warning_threshold,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      };
      // Update or insert in local state
      set((state) => {
        const existing = state.tokenBudgets.findIndex(
          (b) => b.scopeType === scopeType && b.scopeId === scopeId,
        );
        const updated = [...state.tokenBudgets];
        if (existing >= 0) {
          updated[existing] = budget;
        } else {
          updated.push(budget);
        }
        return { tokenBudgets: updated };
      });
      // Recompose prompt to apply new budget
      await get().recompose();
    } catch (err) {
      console.error("Failed to set token budget:", err);
    }
  },

  deleteTokenBudget: async (id) => {
    try {
      await commands.deleteTokenBudget(id);
      set((state) => ({
        tokenBudgets: state.tokenBudgets.filter((b) => b.id !== id),
      }));
      // Recompose prompt to remove budget enforcement
      await get().recompose();
    } catch (err) {
      console.error("Failed to delete token budget:", err);
    }
  },

  getSkillBudget: (skillId) => {
    return get().tokenBudgets.find(
      (b) => b.scopeType === "skill" && b.scopeId === skillId,
    );
  },

  getRepoBudget: (repoId) => {
    return get().tokenBudgets.find(
      (b) => b.scopeType === "repo" && b.scopeId === repoId,
    );
  },

  getSessionBudget: () => {
    return get().tokenBudgets.find(
      (b) => b.scopeType === "session" && b.scopeId === "global",
    );
  },
});
