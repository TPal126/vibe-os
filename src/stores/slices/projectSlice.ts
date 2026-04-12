import type { SliceCreator, ProjectSlice, Project } from "../types";
import { commands } from "../../lib/tauri";

const MAX_PROJECTS = 20;

export const createProjectSlice: SliceCreator<ProjectSlice> = (set, get) => ({
  projects: [],
  activeProjectId: null,
  currentView: "home",

  addProject: (name, workspacePath, _sessionId) => {
    const { projects } = get();
    if (projects.length >= MAX_PROJECTS) return;

    // Persist async (fire-and-forget), then update state from DB row
    commands.createProject(name, workspacePath).then((row) => {
      const project: Project = {
        id: row.id,
        name: row.name,
        workspacePath: row.workspace_path,
        activeSessionId: "",
        summary: row.summary,
        createdAt: row.created_at,
        linkedRepoIds: [],
        linkedSkillIds: [],
        linkedAgentNames: [],
      };
      set((state) => ({
        projects: [...state.projects, project],
        activeProjectId: project.id,
        currentView: "conversation",
      }));
    }).catch((err) => {
      console.error("[vibe-os] Failed to create project:", err);
    });
  },

  removeProject: (id) => {
    // Update state immediately, then persist deletion
    set((state) => {
      const next = state.projects.filter((p) => p.id !== id);
      const wasActive = state.activeProjectId === id;
      return {
        projects: next,
        ...(wasActive ? { activeProjectId: null, currentView: "home" as const } : {}),
      };
    });
    commands.deleteProject(id).catch((err) => {
      console.error("[vibe-os] Failed to delete project:", err);
    });
  },

  clearAllProjects: () => {
    const { projects } = get();
    set({ projects: [], activeProjectId: null, currentView: "home" });
    // Delete each project from DB (fire-and-forget)
    for (const p of projects) {
      commands.deleteProject(p.id).catch(() => {});
    }
  },

  updateProjectSummary: (id, summary) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, summary } : p,
      ),
    }));
    commands.updateProject(id, undefined, summary).catch((err) => {
      console.error("[vibe-os] Failed to update project summary:", err);
    });
  },

  openProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;

    // Deactivate all repos, then reactivate this project's linked repos
    const repos: any[] = (get() as any).repos ?? [];
    const linkedSet = new Set(project.linkedRepoIds);

    // Batch update: deactivate all, activate linked
    const updatedRepos = repos.map((r) => ({
      ...r,
      active: linkedSet.has(r.id),
    }));
    set({ repos: updatedRepos, activeProjectId: id, currentView: "conversation" });

    // Persist active states to DB + recompose prompt
    (async () => {
      try {
        for (const repo of updatedRepos) {
          await commands.setRepoActive(repo.id, repo.active);
        }
        const recompose = (get() as any).recompose;
        if (typeof recompose === "function") {
          await recompose();
        }
      } catch (err) {
        console.error("Failed to update repos on project switch:", err);
      }
    })();
  },

  goHome: () => {
    set({ currentView: "home" });
  },

  goToSetup: () => {
    set({ currentView: "project-setup" });
  },

  loadProjects: async () => {
    try {
      const rows = await commands.listProjects();
      const projects: Project[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        workspacePath: row.workspace_path,
        activeSessionId: "",
        summary: row.summary,
        createdAt: row.created_at,
        linkedRepoIds: [],
        linkedSkillIds: [],
        linkedAgentNames: [],
      }));
      set({ projects });
    } catch {
      console.warn("[vibe-os] Failed to load projects");
    }
  },

  // No-op: projects are now persisted on each mutation
  saveProjects: async () => {},
});
