import { describe, it, expect, beforeEach, vi } from "vitest";
import { create } from "zustand";
import { createProjectSlice } from "./projectSlice";
import type { ProjectSlice } from "../types";

vi.mock("../../lib/tauri", () => ({
  commands: {
    saveSetting: vi.fn().mockResolvedValue(undefined),
    getSetting: vi.fn().mockResolvedValue(null),
  },
}));

function createTestStore() {
  return create<ProjectSlice>()(
    (...a) => createProjectSlice(...(a as Parameters<typeof createProjectSlice>))
  );
}

describe("projectSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe("CRUD", () => {
    it("adds a project and auto-activates it", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      const state = store.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].name).toBe("my-api");
      expect(state.activeProjectId).toBe(state.projects[0].id);
      expect(state.currentView).toBe("conversation");
    });

    it("removes a project", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      const id = store.getState().projects[0].id;
      store.getState().removeProject(id);
      expect(store.getState().projects).toHaveLength(0);
      expect(store.getState().activeProjectId).toBeNull();
      expect(store.getState().currentView).toBe("home");
    });

    it("updates project summary", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      const id = store.getState().projects[0].id;
      store.getState().updateProjectSummary(id, "REST API project");
      expect(store.getState().projects[0].summary).toBe("REST API project");
    });
  });

  describe("max 5 project enforcement", () => {
    it("allows up to 5 projects", () => {
      for (let i = 0; i < 5; i++) {
        store.getState().addProject(`proj-${i}`, `/path/${i}`, `cs-${i}`);
      }
      expect(store.getState().projects).toHaveLength(5);
    });

    it("rejects 6th project", () => {
      for (let i = 0; i < 5; i++) {
        store.getState().addProject(`proj-${i}`, `/path/${i}`, `cs-${i}`);
      }
      store.getState().addProject("proj-5", "/path/5", "cs-5");
      expect(store.getState().projects).toHaveLength(5);
    });
  });

  describe("navigation", () => {
    it("openProject sets active and switches to conversation view", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      const id = store.getState().projects[0].id;
      store.getState().goHome();
      expect(store.getState().currentView).toBe("home");
      store.getState().openProject(id);
      expect(store.getState().activeProjectId).toBe(id);
      expect(store.getState().currentView).toBe("conversation");
    });

    it("goHome switches to home view", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      store.getState().goHome();
      expect(store.getState().currentView).toBe("home");
    });

    it("openProject ignores non-existent id", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      const prevActive = store.getState().activeProjectId;
      store.getState().openProject("nonexistent");
      expect(store.getState().activeProjectId).toBe(prevActive);
    });
  });
});
