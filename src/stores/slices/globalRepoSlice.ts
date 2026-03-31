import type { SliceCreator, GlobalRepoSlice, GlobalRepo } from "../types";
import { commands } from "../../lib/tauri";

const GLOBAL_REPOS_KEY = "global_repos";

export const createGlobalRepoSlice: SliceCreator<GlobalRepoSlice> = (set, get) => ({
  globalRepos: [],
  globalReposLoading: false,

  loadGlobalRepos: async () => {
    set({ globalReposLoading: true });
    try {
      const raw = await commands.getSetting(GLOBAL_REPOS_KEY);
      if (raw) {
        const repos: GlobalRepo[] = JSON.parse(raw);
        set({ globalRepos: repos });
      }
    } catch {
      console.warn("[vibe-os] Failed to load global repos");
    } finally {
      set({ globalReposLoading: false });
    }
  },

  addGlobalRepos: async (repos) => {
    const existing = get().globalRepos;
    const existingIds = new Set(existing.map((r) => r.id));
    const newRepos = repos.filter((r) => !existingIds.has(r.id));
    if (newRepos.length === 0) return;

    const next = [...existing, ...newRepos];
    set({ globalRepos: next });
    commands.saveSetting(GLOBAL_REPOS_KEY, JSON.stringify(next)).catch(() => {});
  },

  removeGlobalRepo: async (id) => {
    const next = get().globalRepos.filter((r) => r.id !== id);
    set({ globalRepos: next });
    commands.saveSetting(GLOBAL_REPOS_KEY, JSON.stringify(next)).catch(() => {});
  },
});
