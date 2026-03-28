import type { SliceCreator, RepoSlice, Repo } from "../types";
import { commands, type RepoMeta } from "../../lib/tauri";

function repoMetaToRepo(meta: RepoMeta): Repo {
  return {
    id: meta.id,
    name: meta.name,
    org: meta.org,
    branch: meta.branch,
    active: false,
    fileCount: meta.file_count,
    language: meta.language,
    localPath: meta.local_path,
    indexSummary: null,
  };
}

export const createRepoSlice: SliceCreator<RepoSlice> = (set, get) => ({
  repos: [],
  repoLoading: false,

  toggleRepo: async (id: string) => {
    const repo = get().repos.find((r) => r.id === id);
    if (!repo) return;

    const newActive = !repo.active;

    // Optimistic update
    set((state) => ({
      repos: state.repos.map((r) =>
        r.id === id ? { ...r, active: newActive } : r,
      ),
    }));

    try {
      // If activating, trigger indexing
      if (newActive) {
        const summary = await commands.indexRepo(repo.localPath);
        set((state) => ({
          repos: state.repos.map((r) =>
            r.id === id ? { ...r, indexSummary: summary } : r,
          ),
        }));
      }

      // Update session-linked repos
      const session = get().activeSession;
      if (session) {
        const activeIds = get()
          .repos.filter((r) => r.active)
          .map((r) => r.id);
        await commands.updateSessionRepos(activeIds);
      }

      // Recompose prompt with updated repo context
      await get().recompose();
    } catch (err) {
      console.error("Failed to toggle repo:", err);
      // Rollback on error
      set((state) => ({
        repos: state.repos.map((r) =>
          r.id === id ? { ...r, active: !newActive } : r,
        ),
      }));
    }
  },

  addRepo: async (gitUrl: string) => {
    set({ repoLoading: true });
    try {
      const meta = await commands.cloneRepo(gitUrl);
      const repo = repoMetaToRepo(meta);
      set((state) => ({ repos: [...state.repos, repo], repoLoading: false }));
    } catch (err) {
      set({ repoLoading: false });
      throw err; // Re-throw so the modal can display the error
    }
  },

  loadRepos: async () => {
    try {
      const metas = await commands.getRepos();
      const repos = metas.map(repoMetaToRepo);
      set({ repos });
    } catch (err) {
      console.error("Failed to load repos:", err);
    }
  },
});
