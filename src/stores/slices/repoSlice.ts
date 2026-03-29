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

      // Log repo toggle to audit trail (fire-and-forget)
      commands
        .logAction(
          "REPO_TOGGLE",
          `${newActive ? "Activated" : "Deactivated"} repo: ${repo.name}`,
          "user",
          JSON.stringify({ repoId: repo.id, active: newActive }),
        )
        .catch(() => {});

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
      const workspacePath = get().activeWorkspace?.path ?? undefined;
      const meta = await commands.cloneRepo(gitUrl, workspacePath);
      const repo = repoMetaToRepo(meta);
      set((state) => ({ repos: [...state.repos, repo], repoLoading: false }));

      // Log repo add to audit trail (fire-and-forget)
      commands
        .logAction(
          "REPO_ADD",
          `Cloned repo: ${repo.name} (${gitUrl})`,
          "user",
          JSON.stringify({ repoId: repo.id, gitUrl }),
        )
        .catch(() => {});
    } catch (err) {
      set({ repoLoading: false });
      throw err; // Re-throw so the modal can display the error
    }
  },

  loadRepos: async () => {
    try {
      // Snapshot currently active repo IDs before reload
      const activeIds = new Set(
        get().repos.filter((r) => r.active).map((r) => r.id),
      );

      const workspacePath = get().activeWorkspace?.path ?? undefined;
      const metas = await commands.getRepos(workspacePath);
      const repos = metas.map((meta) => {
        const repo = repoMetaToRepo(meta);
        // Restore active state for repos that were previously toggled on
        if (activeIds.has(repo.id)) {
          return { ...repo, active: true };
        }
        return repo;
      });
      set({ repos });
    } catch (err) {
      console.error("Failed to load repos:", err);
    }
  },
});
