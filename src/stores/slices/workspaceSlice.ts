import type { SliceCreator, WorkspaceSlice } from "../types";
import { commands, showOpenWorkspaceDialog } from "../../lib/tauri";

export const createWorkspaceSlice: SliceCreator<WorkspaceSlice> = (set, get) => ({
  activeWorkspace: null,
  workspaceTree: null,
  workspaceLoading: false,

  createWorkspace: async (name: string) => {
    set({ workspaceLoading: true });
    try {
      const meta = await commands.createWorkspace(name);
      set({
        activeWorkspace: { name: meta.name, path: meta.path },
        workspaceLoading: false,
      });

      await commands.saveSetting("active_workspace_path", meta.path);

      const claudeMd = await commands.readFile(meta.path + "/CLAUDE.md");
      await get().setSystemPrompt(claudeMd);

      await commands.watchWorkspaceClaudeMd(meta.path);
      await get().loadWorkspaceTree();
      await get().loadRepos();
      await get().discoverSkills();

      commands.logAction(
        "WORKSPACE_CREATE",
        `Created workspace: ${name} at ${meta.path}`,
        "user",
      ).catch(() => {});
    } catch (err) {
      set({ workspaceLoading: false });
      throw err;
    }
  },

  openWorkspace: async (path?: string) => {
    set({ workspaceLoading: true });
    try {
      let workspacePath = path;
      if (!workspacePath) {
        const selected = await showOpenWorkspaceDialog();
        if (!selected) {
          set({ workspaceLoading: false });
          return;
        }
        workspacePath = selected;
      }

      await commands.stopWorkspaceWatcher();

      const meta = await commands.openWorkspace(workspacePath);
      set({
        activeWorkspace: { name: meta.name, path: meta.path },
        workspaceLoading: false,
      });

      await commands.saveSetting("active_workspace_path", meta.path);

      const claudeMd = await commands.readFile(meta.path + "/CLAUDE.md");
      await get().setSystemPrompt(claudeMd);

      await commands.watchWorkspaceClaudeMd(meta.path);
      await get().loadWorkspaceTree();
      await get().loadRepos();
      await get().discoverSkills();

      commands.logAction(
        "WORKSPACE_OPEN",
        `Opened workspace: ${meta.name} at ${meta.path}`,
        "user",
      ).catch(() => {});
    } catch (err) {
      set({ workspaceLoading: false });
      throw err;
    }
  },

  loadWorkspaceTree: async () => {
    const ws = get().activeWorkspace;
    if (!ws) {
      set({ workspaceTree: null });
      return;
    }
    try {
      const tree = await commands.readWorkspaceTree(ws.path, 3);
      set({ workspaceTree: tree });
    } catch (err) {
      console.error("Failed to load workspace tree:", err);
    }
  },

  refreshWorkspaceTree: async () => {
    await get().loadWorkspaceTree();
  },

  closeWorkspace: async () => {
    await commands.stopWorkspaceWatcher();
    await commands.deleteSetting("active_workspace_path");
    set({ activeWorkspace: null, workspaceTree: null });
    await get().loadRepos();
    await get().discoverSkills();
  },
});
