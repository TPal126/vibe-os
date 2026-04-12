import type { SliceCreator, PipelineSlice, PipelinePhaseConfig } from "../types";
import { commands } from "../../lib/tauri";

const DEFAULT_MODELS: Record<string, string> = {
  claude: "sonnet",
  codex: "gpt-4.1",
};

export const createPipelineSlice: SliceCreator<PipelineSlice> = (set, get) => ({
  // Builder state
  builderPhases: [],
  selectedPhaseId: null,
  frameworks: [],

  addPhase: (phaseType, label) => {
    const phase: PipelinePhaseConfig = {
      id: crypto.randomUUID(),
      label,
      phaseType,
      backend: "claude",
      framework: "native",
      model: "sonnet",
      customPrompt: null,
      gateAfter: "gated",
    };
    set((state) => ({
      builderPhases: [...state.builderPhases, phase],
      selectedPhaseId: phase.id,
    }));
  },

  removePhase: (id) =>
    set((state) => ({
      builderPhases: state.builderPhases.filter((p) => p.id !== id),
      selectedPhaseId: state.selectedPhaseId === id ? null : state.selectedPhaseId,
    })),

  reorderPhases: (fromIndex, toIndex) =>
    set((state) => {
      const phases = [...state.builderPhases];
      const [moved] = phases.splice(fromIndex, 1);
      phases.splice(toIndex, 0, moved);
      return { builderPhases: phases };
    }),

  updatePhase: (id, updates) =>
    set((state) => ({
      builderPhases: state.builderPhases.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, ...updates };
        // When backend changes, reset framework and model to compatible defaults
        if (updates.backend && updates.backend !== p.backend) {
          updated.framework = "native";
          updated.model = DEFAULT_MODELS[updates.backend] || "sonnet";
        }
        return updated;
      }),
    })),

  selectPhase: (id) => set({ selectedPhaseId: id }),

  toggleGate: (id) =>
    set((state) => ({
      builderPhases: state.builderPhases.map((p) =>
        p.id === id ? { ...p, gateAfter: p.gateAfter === "gated" ? "auto" : "gated" } : p,
      ),
    })),

  resetBuilder: () => set({ builderPhases: [], selectedPhaseId: null }),

  loadFrameworks: async () => {
    try {
      const frameworks = await commands.listFrameworks();
      set({ frameworks });
    } catch (err) {
      console.warn("[vibe-os] Failed to load frameworks:", err);
    }
  },

  // Active run tracking
  activePipelineRun: null,

  startPipelineRun: async (pipelineId) => {
    try {
      const runId = await commands.startPipeline(pipelineId);
      const status = await commands.getPipelineRunStatus(runId);
      set({
        activePipelineRun: {
          pipelineRunId: status.pipeline_run_id,
          status: status.status,
          currentPhase: status.current_phase
            ? {
                phaseRunId: status.current_phase.phase_run_id,
                phaseId: status.current_phase.phase_id,
                label: status.current_phase.label,
                status: status.current_phase.status,
              }
            : null,
          completedPhases: status.completed_phases.map((p) => ({
            phaseRunId: p.phase_run_id,
            phaseId: p.phase_id,
            label: p.label,
            status: p.status,
            artifactPath: p.artifact_path,
            summary: p.summary,
          })),
        },
      });
    } catch (err) {
      console.error("[vibe-os] Failed to start pipeline:", err);
    }
  },

  advancePipelineGate: async (pipelineRunId) => {
    try {
      await commands.advanceGate(pipelineRunId);
      get().refreshPipelineRun(pipelineRunId);
    } catch (err) {
      console.error("[vibe-os] Failed to advance gate:", err);
    }
  },

  refreshPipelineRun: async (pipelineRunId) => {
    try {
      const status = await commands.getPipelineRunStatus(pipelineRunId);
      set({
        activePipelineRun: {
          pipelineRunId: status.pipeline_run_id,
          status: status.status,
          currentPhase: status.current_phase
            ? {
                phaseRunId: status.current_phase.phase_run_id,
                phaseId: status.current_phase.phase_id,
                label: status.current_phase.label,
                status: status.current_phase.status,
              }
            : null,
          completedPhases: status.completed_phases.map((p) => ({
            phaseRunId: p.phase_run_id,
            phaseId: p.phase_id,
            label: p.label,
            status: p.status,
            artifactPath: p.artifact_path,
            summary: p.summary,
          })),
        },
      });
    } catch (err) {
      console.error("[vibe-os] Failed to refresh pipeline run:", err);
    }
  },

  clearPipelineRun: () => set({ activePipelineRun: null }),

  // Pipeline hydration — loads existing pipeline for a project into builder state
  loadProjectPipeline: async (projectId) => {
    try {
      const pipeline = await commands.getProjectPipeline(projectId);
      if (!pipeline) {
        set({ builderPhases: [], selectedPhaseId: null });
        return;
      }
      const phases = await commands.getPipelinePhases(pipeline.id);
      const builderPhases: PipelinePhaseConfig[] = phases.map((p) => ({
        id: p.id,
        label: p.label,
        phaseType: p.phase_type,
        backend: p.backend as "claude" | "codex",
        framework: p.framework,
        model: p.model,
        customPrompt: p.custom_prompt,
        gateAfter: p.gate_after as "gated" | "auto",
      }));
      set({ builderPhases, selectedPhaseId: null });
    } catch (err) {
      console.warn("[vibe-os] Failed to load project pipeline:", err);
    }
  },
});
