import { describe, it, expect, beforeEach, vi } from "vitest";
import { create } from "zustand";
import { createPipelineSlice } from "./pipelineSlice";
import type { PipelineSlice } from "../types";

vi.mock("../../lib/tauri", () => ({
  commands: {
    listFrameworks: vi.fn().mockResolvedValue([
      { id: "superpowers", name: "Superpowers", supported_backends: ["claude"], supported_phases: ["ideation", "planning"], features: { visual_companion: true, interactive_questions: true }, phase_skills: {} },
      { id: "native", name: "Native", supported_backends: ["claude", "codex"], supported_phases: ["ideation", "planning", "execution"], features: { visual_companion: false, interactive_questions: false }, phase_skills: {} },
    ]),
    startPipeline: vi.fn().mockResolvedValue("run-1"),
    getPipelineRunStatus: vi.fn().mockResolvedValue({
      pipeline_run_id: "run-1",
      status: "running",
      current_phase: { phase_run_id: "pr-1", phase_id: "p-1", label: "Ideation", status: "running" },
      completed_phases: [],
    }),
    advanceGate: vi.fn().mockResolvedValue(undefined),
    getProjectPipeline: vi.fn().mockResolvedValue({ id: "pipeline-1", project_id: "proj-1", name: "Default" }),
    getPipelinePhases: vi.fn().mockResolvedValue([
      { id: "p-1", pipeline_id: "pipeline-1", position: 0, label: "Ideation", phase_type: "ideation", backend: "claude", framework: "superpowers", model: "opus", custom_prompt: null, gate_after: "gated" },
      { id: "p-2", pipeline_id: "pipeline-1", position: 1, label: "Execution", phase_type: "execution", backend: "codex", framework: "native", model: "gpt-4.1", custom_prompt: null, gate_after: "auto" },
    ]),
  },
}));

function createTestStore() {
  return create<PipelineSlice>()((...a) => createPipelineSlice(...(a as Parameters<typeof createPipelineSlice>)));
}

describe("pipelineSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe("builder", () => {
    it("adds a phase with defaults", () => {
      store.getState().addPhase("ideation", "Ideation");
      expect(store.getState().builderPhases).toHaveLength(1);
      expect(store.getState().builderPhases[0].backend).toBe("claude");
      expect(store.getState().builderPhases[0].framework).toBe("native");
      expect(store.getState().builderPhases[0].gateAfter).toBe("gated");
    });

    it("auto-selects newly added phase", () => {
      store.getState().addPhase("ideation", "Ideation");
      expect(store.getState().selectedPhaseId).toBe(store.getState().builderPhases[0].id);
    });

    it("removes a phase", () => {
      store.getState().addPhase("ideation", "Ideation");
      const id = store.getState().builderPhases[0].id;
      store.getState().removePhase(id);
      expect(store.getState().builderPhases).toHaveLength(0);
      expect(store.getState().selectedPhaseId).toBeNull();
    });

    it("reorders phases", () => {
      store.getState().addPhase("ideation", "Ideation");
      store.getState().addPhase("execution", "Execution");
      store.getState().reorderPhases(0, 1);
      expect(store.getState().builderPhases[0].phaseType).toBe("execution");
      expect(store.getState().builderPhases[1].phaseType).toBe("ideation");
    });

    it("toggles gate between gated and auto", () => {
      store.getState().addPhase("ideation", "Ideation");
      const id = store.getState().builderPhases[0].id;
      expect(store.getState().builderPhases[0].gateAfter).toBe("gated");
      store.getState().toggleGate(id);
      expect(store.getState().builderPhases[0].gateAfter).toBe("auto");
      store.getState().toggleGate(id);
      expect(store.getState().builderPhases[0].gateAfter).toBe("gated");
    });

    it("resets framework and model when backend changes", () => {
      store.getState().addPhase("ideation", "Ideation");
      const id = store.getState().builderPhases[0].id;
      store.getState().updatePhase(id, { framework: "superpowers", model: "opus" });
      store.getState().updatePhase(id, { backend: "codex" });
      expect(store.getState().builderPhases[0].framework).toBe("native");
      expect(store.getState().builderPhases[0].model).toBe("gpt-4.1");
    });

    it("resetBuilder clears all phases", () => {
      store.getState().addPhase("ideation", "Ideation");
      store.getState().addPhase("execution", "Execution");
      store.getState().resetBuilder();
      expect(store.getState().builderPhases).toHaveLength(0);
      expect(store.getState().selectedPhaseId).toBeNull();
    });
  });

  describe("framework loading", () => {
    it("loads frameworks from Tauri command", async () => {
      await store.getState().loadFrameworks();
      expect(store.getState().frameworks).toHaveLength(2);
      expect(store.getState().frameworks[0].id).toBe("superpowers");
    });
  });

  describe("pipeline hydration", () => {
    it("loads existing pipeline into builder state", async () => {
      await store.getState().loadProjectPipeline("proj-1");
      expect(store.getState().builderPhases).toHaveLength(2);
      expect(store.getState().builderPhases[0].label).toBe("Ideation");
      expect(store.getState().builderPhases[1].backend).toBe("codex");
    });

    it("clears builder when no pipeline exists", async () => {
      const { commands } = await import("../../lib/tauri");
      (commands.getProjectPipeline as any).mockResolvedValueOnce(null);
      store.getState().addPhase("ideation", "Ideation"); // pre-populate
      await store.getState().loadProjectPipeline("no-pipeline-proj");
      expect(store.getState().builderPhases).toHaveLength(0);
    });
  });

  describe("run tracking", () => {
    it("starts run and stores activePipelineRun", async () => {
      await store.getState().startPipelineRun("pipeline-1");
      const run = store.getState().activePipelineRun;
      expect(run).not.toBeNull();
      expect(run!.pipelineRunId).toBe("run-1");
      expect(run!.status).toBe("running");
      expect(run!.currentPhase?.label).toBe("Ideation");
    });

    it("clears run", async () => {
      await store.getState().startPipelineRun("pipeline-1");
      store.getState().clearPipelineRun();
      expect(store.getState().activePipelineRun).toBeNull();
    });
  });
});
