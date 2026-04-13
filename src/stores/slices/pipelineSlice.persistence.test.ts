import { describe, it, expect, beforeEach, vi } from "vitest";
import { create } from "zustand";
import { createPipelineSlice } from "./pipelineSlice";
import type { PipelineSlice } from "../types";

const mockCmds = vi.hoisted(() => {
  const fn = vi.fn;
  return {
    listFrameworks: fn().mockResolvedValue([]),
    startPipeline: fn().mockResolvedValue("run-1"),
    getPipelineRunStatus: fn().mockResolvedValue({
      pipeline_run_id: "run-1",
      status: "running",
      current_phase: {
        phase_run_id: "pr-1", phase_id: "p-1", label: "Ideation",
        status: "running", artifact_path: null, summary: null,
      },
      completed_phases: [],
    }),
    advanceGate: fn().mockResolvedValue(undefined),
    getProjectPipeline: fn().mockResolvedValue({
      id: "pipeline-1", project_id: "proj-1", name: "Default",
    }),
    getPipelinePhases: fn().mockResolvedValue([]),
  };
});

vi.mock("../../lib/tauri", () => ({
  commands: mockCmds,
}));

function createTestStore() {
  return create<PipelineSlice>()((...a) =>
    createPipelineSlice(...(a as Parameters<typeof createPipelineSlice>)),
  );
}

describe("pipelineSlice persistence edge cases", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    // Reset all mock implementations to defaults
    mockCmds.startPipeline.mockReset().mockResolvedValue("run-1");
    mockCmds.getPipelineRunStatus.mockReset().mockResolvedValue({
      pipeline_run_id: "run-1",
      status: "running",
      current_phase: {
        phase_run_id: "pr-1",
        phase_id: "p-1",
        label: "Ideation",
        status: "running",
        artifact_path: null,
        summary: null,
      },
      completed_phases: [],
    });
    mockCmds.advanceGate.mockReset().mockResolvedValue(undefined);
    mockCmds.getProjectPipeline.mockReset().mockResolvedValue({
      id: "pipeline-1",
      project_id: "proj-1",
      name: "Default",
    });
    mockCmds.getPipelinePhases.mockReset().mockResolvedValue([
      {
        id: "p-1",
        pipeline_id: "pipeline-1",
        position: 0,
        label: "Ideation",
        phase_type: "ideation",
        backend: "claude",
        framework: "superpowers",
        model: "opus",
        custom_prompt: null,
        gate_after: "gated",
      },
    ]);
    mockCmds.listFrameworks.mockReset().mockResolvedValue([
      {
        id: "superpowers",
        name: "Superpowers",
        supported_backends: ["claude"],
        supported_phases: ["ideation", "planning"],
        features: { visual_companion: true, interactive_questions: true },
        phase_skills: {},
      },
    ]);
  });

  describe("refresh after command failure recovers gracefully", () => {
    it("refreshPipelineRun handles failure and keeps activePipelineRun unchanged", async () => {
      // First, start a pipeline to populate activePipelineRun
      await store.getState().startPipelineRun("pipeline-1");
      expect(store.getState().activePipelineRun).not.toBeNull();
      const runBefore = store.getState().activePipelineRun;

      // Now make getPipelineRunStatus reject
      mockCmds.getPipelineRunStatus.mockRejectedValueOnce(
        new Error("Network timeout"),
      );

      // refreshPipelineRun should not throw
      await store.getState().refreshPipelineRun("run-1");

      // activePipelineRun should remain from before (not cleared)
      expect(store.getState().activePipelineRun).toEqual(runBefore);
    });

    it("startPipelineRun handles startPipeline failure and keeps activePipelineRun null", async () => {
      mockCmds.startPipeline.mockRejectedValueOnce(
        new Error("Backend unavailable"),
      );

      await store.getState().startPipelineRun("pipeline-1");

      // Should not have set activePipelineRun
      expect(store.getState().activePipelineRun).toBeNull();
    });
  });

  describe("loadFrameworks handles failure silently", () => {
    it("does not throw and leaves frameworks empty on rejection", async () => {
      mockCmds.listFrameworks.mockRejectedValueOnce(
        new Error("Failed to list frameworks"),
      );

      // Should not throw
      await store.getState().loadFrameworks();

      // Frameworks should remain empty
      expect(store.getState().frameworks).toHaveLength(0);
    });

    it("retains previous frameworks if a reload fails", async () => {
      // First successful load
      await store.getState().loadFrameworks();
      expect(store.getState().frameworks).toHaveLength(1);

      // Second load fails
      mockCmds.listFrameworks.mockRejectedValueOnce(
        new Error("Transient error"),
      );

      await store.getState().loadFrameworks();

      // Should still have the frameworks from the first load
      expect(store.getState().frameworks).toHaveLength(1);
      expect(store.getState().frameworks[0].id).toBe("superpowers");
    });
  });

  describe("loadProjectPipeline handles phases query failure", () => {
    it("does not throw when getProjectPipeline rejects", async () => {
      mockCmds.getProjectPipeline.mockRejectedValueOnce(
        new Error("DB read error"),
      );

      // Pre-populate builder to verify it's not corrupted
      store.getState().addPhase("ideation", "Existing Phase");
      expect(store.getState().builderPhases).toHaveLength(1);

      await store.getState().loadProjectPipeline("proj-1");

      // Builder phases should be unchanged (failure path doesn't clear)
      expect(store.getState().builderPhases).toHaveLength(1);
    });

    it("does not throw when getPipelinePhases rejects", async () => {
      // getProjectPipeline succeeds, but getPipelinePhases fails
      mockCmds.getPipelinePhases.mockRejectedValueOnce(
        new Error("Phase query error"),
      );

      store.getState().addPhase("execution", "Existing Exec Phase");

      await store.getState().loadProjectPipeline("proj-1");

      // Builder phases should be unchanged (failure path doesn't overwrite)
      expect(store.getState().builderPhases).toHaveLength(1);
      expect(store.getState().builderPhases[0].label).toBe("Existing Exec Phase");
    });
  });

  describe("multiple rapid gate advances don't corrupt state", () => {
    it("handles rapid sequential advancePipelineGate calls without corruption", async () => {
      // Start a pipeline run first
      await store.getState().startPipelineRun("pipeline-1");
      expect(store.getState().activePipelineRun).not.toBeNull();

      // Set up advancing status responses (each refresh returns progressively updated state)
      let callCount = 0;
      mockCmds.getPipelineRunStatus.mockImplementation(async () => {
        callCount++;
        return {
          pipeline_run_id: "run-1",
          status: "running",
          current_phase: {
            phase_run_id: `pr-${callCount}`,
            phase_id: `p-${callCount}`,
            label: `Phase ${callCount}`,
            status: "running",
            artifact_path: null,
            summary: null,
          },
          completed_phases: Array.from({ length: callCount - 1 }, (_, i) => ({
            phase_run_id: `pr-${i + 1}`,
            phase_id: `p-${i + 1}`,
            label: `Phase ${i + 1}`,
            status: "completed",
            artifact_path: null,
            summary: `Phase ${i + 1} done`,
          })),
        };
      });

      // Fire 3 rapid gate advances concurrently
      await Promise.all([
        store.getState().advancePipelineGate("run-1"),
        store.getState().advancePipelineGate("run-1"),
        store.getState().advancePipelineGate("run-1"),
      ]);

      // advanceGate should have been called 3 times
      expect(mockCmds.advanceGate).toHaveBeenCalledTimes(3);

      // The run state should not be null or corrupted
      const run = store.getState().activePipelineRun;
      expect(run).not.toBeNull();
      expect(run!.pipelineRunId).toBe("run-1");
      expect(run!.status).toBe("running");
      // The currentPhase should be valid (from the last refresh)
      expect(run!.currentPhase).not.toBeNull();
      expect(run!.currentPhase!.label).toMatch(/^Phase \d+$/);
    });

    it("handles mixed advance success and failure without corruption", async () => {
      await store.getState().startPipelineRun("pipeline-1");

      // First advance succeeds, second fails, third succeeds
      mockCmds.advanceGate
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Gate locked"))
        .mockResolvedValueOnce(undefined);

      await store.getState().advancePipelineGate("run-1");
      await store.getState().advancePipelineGate("run-1");
      await store.getState().advancePipelineGate("run-1");

      // State should still be valid (not null or corrupted)
      const run = store.getState().activePipelineRun;
      expect(run).not.toBeNull();
      expect(run!.pipelineRunId).toBe("run-1");
    });
  });
});
