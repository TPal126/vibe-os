import type { SliceCreator, RepoSlice, Repo } from "../types";
import { commands, type RepoRow } from "../../lib/tauri";

function repoRowToRepo(row: RepoRow): Repo {
  return {
    id: row.id,
    name: row.name,
    source: row.source as "local" | "github",
    branch: row.branch,
    active: row.active,
    fileCount: row.file_count,
    language: row.language,
    localPath: row.path,
    gitUrl: row.git_url,
    parentId: row.parent_id,
    createdAt: row.created_at,
    indexSummary: null,
  };
}

function generateRepoId(path: string): string {
  return `repo:${path.replace(/[/\\:]/g, "-")}`;
}

export const createRepoSlice: SliceCreator<RepoSlice> = (set, get) => ({
  repos: [],
  repoLoading: false,

  loadRepos: async () => {
    try {
      const rows = await commands.getAllRepos();
      const repos = rows.map(repoRowToRepo);
      set({ repos });
    } catch (err) {
      console.error("Failed to load repos:", err);
    }
  },

  addRepoLocal: async (path: string) => {
    set({ repoLoading: true });
    try {
      const name = path.split(/[\\/]/).pop() || path;
      const id = generateRepoId(path);
      const now = new Date().toISOString();

      const row: RepoRow = {
        id,
        name,
        source: "local",
        path,
        git_url: null,
        branch: "main",
        language: "",
        file_count: 0,
        active: false,
        parent_id: null,
        created_at: now,
      };

      const saved = await commands.saveRepo(row);
      const repo = repoRowToRepo(saved);
      set((state) => ({
        repos: state.repos.some((r) => r.id === repo.id)
          ? state.repos
          : [...state.repos, repo],
        repoLoading: false,
      }));
    } catch (err) {
      set({ repoLoading: false });
      console.error("Failed to add local repo:", err);
    }
  },

  addRepoGithub: async (gitUrl: string) => {
    set({ repoLoading: true });
    try {
      const row = await commands.cloneRepo(gitUrl);
      const repo = repoRowToRepo(row);
      set((state) => ({
        repos: state.repos.some((r) => r.id === repo.id)
          ? state.repos
          : [...state.repos, repo],
        repoLoading: false,
      }));
    } catch (err) {
      set({ repoLoading: false });
      throw err;
    }
  },

  removeRepo: async (id: string) => {
    try {
      await commands.deleteRepo(id);
      set((state) => ({
        repos: state.repos.filter((r) => r.id !== id && r.parentId !== id),
      }));
    } catch (err) {
      console.error("Failed to remove repo:", err);
    }
  },

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
      await commands.setRepoActive(id, newActive);

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
      const activeIds = get()
        .repos.filter((r) => r.active)
        .map((r) => r.id);
      await commands.updateSessionRepos(activeIds);

      // Log toggle (fire-and-forget)
      commands
        .logAction(
          "REPO_TOGGLE",
          `${newActive ? "Activated" : "Deactivated"} repo: ${repo.name}`,
          "user",
          JSON.stringify({ repoId: repo.id, active: newActive }),
        )
        .catch(() => {});

      // Recompose prompt
      const recompose = (get() as any).recompose;
      if (typeof recompose === "function") {
        await recompose();
      }
    } catch (err) {
      console.error("Failed to toggle repo:", err);
      // Rollback
      set((state) => ({
        repos: state.repos.map((r) =>
          r.id === id ? { ...r, active: !newActive } : r,
        ),
      }));
    }
  },

  listRemoteBranches: async (repoId: string) => {
    return commands.listRemoteBranches(repoId);
  },

  addBranch: async (repoId: string, branch: string) => {
    set({ repoLoading: true });
    try {
      const row = await commands.addBranchWorktree(repoId, branch);
      const repo = repoRowToRepo(row);
      set((state) => ({
        repos: [...state.repos, repo],
        repoLoading: false,
      }));
    } catch (err) {
      set({ repoLoading: false });
      throw err;
    }
  },

  removeBranch: async (repoId: string) => {
    try {
      await commands.removeBranchWorktree(repoId);
      set((state) => ({
        repos: state.repos.filter((r) => r.id !== repoId),
      }));
    } catch (err) {
      console.error("Failed to remove branch worktree:", err);
    }
  },

  refreshRepoBranch: async (repoId: string) => {
    try {
      const newBranch = await commands.refreshRepoBranch(repoId);
      set((state) => ({
        repos: state.repos.map((r) =>
          r.id === repoId ? { ...r, branch: newBranch } : r,
        ),
      }));
    } catch (err) {
      console.error("Failed to refresh branch:", err);
    }
  },
});
