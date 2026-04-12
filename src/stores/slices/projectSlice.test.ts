import { describe, it, expect, beforeEach, vi } from "vitest";
import { create } from "zustand";
import { createProjectSlice } from "./projectSlice";
import type { ProjectSlice } from "../types";

let projectCounter = 0;

vi.mock("../../lib/tauri", () => ({
  commands: {
    createProject: vi.fn().mockImplementation((name: string, workspacePath: string) => {
      projectCounter++;
      return Promise.resolve({
        id: `proj-${projectCounter}`,
        name,
        workspace_path: workspacePath,
        summary: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }),
    listProjects: vi.fn().mockResolvedValue([]),
    updateProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    setRepoActive: vi.fn().mockResolvedValue(undefined),
  },
}));

function createTestStore() {
  return create<ProjectSlice>()(
    (...a) => createProjectSlice(...(a as Parameters<typeof createProjectSlice>))
  );
}

/** Helper: add a project and wait for the async DB round-trip to update state */
async function addProjectAndWait(store: ReturnType<typeof createTestStore>, name: string, path: string, sessionId: string) {
  store.getState().addProject(name, path, sessionId);
  // Wait for the fire-and-forget .then() to resolve
  await vi.waitFor(() => {
    expect(store.getState().projects.length).toBeGreaterThan(0);
  });
}

describe("projectSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    projectCounter = 0;
    store = createTestStore();
  });

  describe("CRUD", () => {
    it("adds a project and auto-activates it", async () => {
      await addProjectAndWait(store, "my-api", "/path/ws", "cs-1");
      const state = store.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].name).toBe("my-api");
      expect(state.activeProjectId).toBe(state.projects[0].id);
      expect(state.currentView).toBe("conversation");
    });

    it("removes a project", async () => {
      await addProjectAndWait(store, "my-api", "/path/ws", "cs-1");
      const id = store.getState().projects[0].id;
      store.getState().removeProject(id);
      expect(store.getState().projects).toHaveLength(0);
      expect(store.getState().activeProjectId).toBeNull();
      expect(store.getState().currentView).toBe("home");
    });

    it("updates project summary", async () => {
      await addProjectAndWait(store, "my-api", "/path/ws", "cs-1");
      const id = store.getState().projects[0].id;
      store.getState().updateProjectSummary(id, "REST API project");
      expect(store.getState().projects[0].summary).toBe("REST API project");
    });
  });

  describe("max 20 project enforcement", () => {
    it("allows up to 20 projects", async () => {
      for (let i = 0; i < 20; i++) {
        await addProjectAndWait(store, `proj-${i}`, `/path/${i}`, `cs-${i}`);
      }
      expect(store.getState().projects).toHaveLength(20);
    });

    it("rejects 21st project", async () => {
      for (let i = 0; i < 20; i++) {
        await addProjectAndWait(store, `proj-${i}`, `/path/${i}`, `cs-${i}`);
      }
      store.getState().addProject("proj-20", "/path/20", "cs-20");
      // Give time for potential async resolution
      await new Promise((r) => setTimeout(r, 10));
      expect(store.getState().projects).toHaveLength(20);
    });
  });

  describe("navigation", () => {
    it("openProject sets active and switches to conversation view", async () => {
      await addProjectAndWait(store, "my-api", "/path/ws", "cs-1");
      const id = store.getState().projects[0].id;
      store.getState().goHome();
      expect(store.getState().currentView).toBe("home");
      store.getState().openProject(id);
      expect(store.getState().activeProjectId).toBe(id);
      expect(store.getState().currentView).toBe("conversation");
    });

    it("goHome switches to home view", async () => {
      await addProjectAndWait(store, "my-api", "/path/ws", "cs-1");
      store.getState().goHome();
      expect(store.getState().currentView).toBe("home");
    });

    it("openProject ignores non-existent id", async () => {
      await addProjectAndWait(store, "my-api", "/path/ws", "cs-1");
      const prevActive = store.getState().activeProjectId;
      store.getState().openProject("nonexistent");
      expect(store.getState().activeProjectId).toBe(prevActive);
    });
  });
});
