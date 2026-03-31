import type { SliceCreator, ProjectSlice, Project } from "../types";
import { commands } from "../../lib/tauri";

const MAX_PROJECTS = 5;
const PROJECTS_SETTING_KEY = "projects_list";

export const createProjectSlice: SliceCreator<ProjectSlice> = (set, get) => ({
  projects: [],
  activeProjectId: null,
  currentView: "home",

  addProject: (name, workspacePath, claudeSessionId) => {
    const { projects } = get();
    if (projects.length >= MAX_PROJECTS) return;

    const project: Project = {
      id: crypto.randomUUID(),
      name,
      workspacePath,
      claudeSessionId,
      summary: "",
      createdAt: new Date().toISOString(),
      linkedRepoIds: [],
      linkedSkillIds: [],
      linkedAgentNames: [],
    };

    const next = [...projects, project];
    set({ projects: next, activeProjectId: project.id, currentView: "conversation" });

    // Persist async (fire-and-forget)
    commands.saveSetting(PROJECTS_SETTING_KEY, JSON.stringify(next)).catch(() => {});
  },

  removeProject: (id) => {
    const next = get().projects.filter((p) => p.id !== id);
    set({ projects: next });
    if (get().activeProjectId === id) {
      set({ activeProjectId: null, currentView: "home" });
    }
    commands.saveSetting(PROJECTS_SETTING_KEY, JSON.stringify(next)).catch(() => {});
  },

  updateProjectSummary: (id, summary) => {
    const next = get().projects.map((p) =>
      p.id === id ? { ...p, summary } : p,
    );
    set({ projects: next });
    commands.saveSetting(PROJECTS_SETTING_KEY, JSON.stringify(next)).catch(() => {});
  },

  openProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    set({ activeProjectId: id, currentView: "conversation" });
  },

  goHome: () => {
    set({ currentView: "home" });
  },

  goToSetup: () => {
    set({ currentView: "project-setup" });
  },

  loadProjects: async () => {
    try {
      const raw = await commands.getSetting(PROJECTS_SETTING_KEY);
      if (raw) {
        const projects: Project[] = JSON.parse(raw);
        set({ projects });
      }
    } catch {
      console.warn("[vibe-os] Failed to load projects");
    }
  },

  saveProjects: async () => {
    const { projects } = get();
    await commands.saveSetting(PROJECTS_SETTING_KEY, JSON.stringify(projects));
  },
});
