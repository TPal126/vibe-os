import { describe, it, expect, beforeEach, vi } from "vitest";
import { create } from "zustand";
import { createRepoSlice } from "./repoSlice";
import type { RepoSlice } from "../types";

const mockRepos = vi.hoisted(() => [
  {
    id: "repo-c--users-thoma-projects-my-app",
    name: "my-app",
    source: "local",
    path: "C:\\Users\\Thoma\\projects\\my-app",
    git_url: null,
    branch: "main",
    language: "TypeScript",
    file_count: 42,
    active: false,
    parent_id: null,
    created_at: "2026-04-04T00:00:00Z",
  },
]);

vi.mock("../../lib/tauri", () => ({
  commands: {
    getAllRepos: vi.fn().mockResolvedValue(mockRepos),
    saveRepo: vi.fn().mockImplementation((repo) => Promise.resolve(repo)),
    deleteRepo: vi.fn().mockResolvedValue(undefined),
    setRepoActive: vi.fn().mockResolvedValue(undefined),
    indexRepo: vi.fn().mockResolvedValue("Indexed 42 files"),
    cloneRepo: vi.fn().mockResolvedValue({
      id: "repo-c--clone-test",
      name: "cloned",
      source: "github",
      path: "C:\\clone\\test",
      git_url: "https://github.com/org/cloned",
      branch: "main",
      language: "Rust",
      file_count: 10,
      active: false,
      parent_id: null,
      created_at: "2026-04-04T00:00:00Z",
    }),
    refreshRepoBranch: vi.fn().mockResolvedValue("develop"),
    listRemoteBranches: vi.fn().mockResolvedValue(["main", "develop", "feature-x"]),
    addBranchWorktree: vi.fn().mockResolvedValue({
      id: "repo-c--clone-test-feature-x",
      name: "cloned",
      source: "github",
      path: "C:\\clone\\test-feature-x",
      git_url: "https://github.com/org/cloned",
      branch: "feature-x",
      language: "Rust",
      file_count: 10,
      active: false,
      parent_id: "repo-c--clone-test",
      created_at: "2026-04-04T00:00:00Z",
    }),
    removeBranchWorktree: vi.fn().mockResolvedValue(undefined),
    updateSessionRepos: vi.fn().mockResolvedValue(undefined),
    logAction: vi.fn().mockResolvedValue(undefined),
  },
}));

function createTestStore() {
  return create<RepoSlice>()(
    (...a) => ({
      ...createRepoSlice(...(a as Parameters<typeof createRepoSlice>)),
    }),
  );
}

describe("repoSlice (unified)", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    vi.clearAllMocks();
  });

  it("starts with empty repos", () => {
    expect(store.getState().repos).toHaveLength(0);
    expect(store.getState().repoLoading).toBe(false);
  });

  it("loadRepos populates from backend", async () => {
    await store.getState().loadRepos();
    expect(store.getState().repos).toHaveLength(1);
    expect(store.getState().repos[0].name).toBe("my-app");
    expect(store.getState().repos[0].source).toBe("local");
  });

  it("addRepoLocal adds a local repo", async () => {
    await store.getState().addRepoLocal("C:\\Users\\Thoma\\projects\\new-app");
    const repos = store.getState().repos;
    expect(repos).toHaveLength(1);
    expect(repos[0].source).toBe("local");
    expect(repos[0].localPath).toBe("C:\\Users\\Thoma\\projects\\new-app");
  });

  it("addRepoGithub clones and adds", async () => {
    await store.getState().addRepoGithub("https://github.com/org/cloned");
    const repos = store.getState().repos;
    expect(repos).toHaveLength(1);
    expect(repos[0].source).toBe("github");
    expect(repos[0].name).toBe("cloned");
  });

  it("removeRepo deletes from state", async () => {
    await store.getState().loadRepos();
    expect(store.getState().repos).toHaveLength(1);
    await store.getState().removeRepo("repo-c--users-thoma-projects-my-app");
    expect(store.getState().repos).toHaveLength(0);
  });

  it("toggleRepo flips active and triggers recompose-like flow", async () => {
    await store.getState().loadRepos();
    await store.getState().toggleRepo("repo-c--users-thoma-projects-my-app");
    const repo = store.getState().repos.find((r) => r.id === "repo-c--users-thoma-projects-my-app");
    expect(repo?.active).toBe(true);
  });
});
