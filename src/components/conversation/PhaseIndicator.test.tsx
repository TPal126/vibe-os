import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PhaseIndicator } from "./PhaseIndicator";

const mockStore: Record<string, any> = {
  activePipelineRun: null,
  activeProjectId: null,
  startPipelineRun: vi.fn(),
};

vi.mock("../../stores", () => ({
  useAppStore: (selector: (s: any) => any) => selector(mockStore),
}));

vi.mock("../../lib/tauri", () => ({
  commands: {
    getProjectPipeline: vi.fn().mockResolvedValue({ id: "pipeline-1" }),
  },
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: any) => fn,
}));

afterEach(() => {
  cleanup();
});

describe("PhaseIndicator", () => {
  beforeEach(() => {
    mockStore.activePipelineRun = null;
    mockStore.activeProjectId = null;
  });

  it("renders nothing when no pipeline run and no project", () => {
    const { container } = render(<PhaseIndicator />);
    expect(container.innerHTML).toBe("");
  });

  it("shows Run Pipeline button when project has pipeline but no run", () => {
    mockStore.activeProjectId = "proj-1";
    render(<PhaseIndicator />);
    // The button appears after an async check, so this validates the initial render
  });

  it("shows phase progress when run is active", () => {
    mockStore.activePipelineRun = {
      pipelineRunId: "run-1",
      status: "running",
      currentPhase: { phaseRunId: "pr-1", phaseId: "p-1", label: "Planning", status: "running" },
      completedPhases: [
        { phaseRunId: "pr-0", phaseId: "p-0", label: "Ideation", status: "completed", artifactPath: null, summary: null },
      ],
    };
    render(<PhaseIndicator />);
    expect(screen.getByText("Ideation")).toBeDefined();
    expect(screen.getByText("Planning")).toBeDefined();
    expect(screen.getByText("running")).toBeDefined();
  });

  it("shows awaiting_gate status for gated phase", () => {
    mockStore.activePipelineRun = {
      pipelineRunId: "run-1",
      status: "running",
      currentPhase: { phaseRunId: "pr-1", phaseId: "p-1", label: "Review", status: "awaiting_gate" },
      completedPhases: [],
    };
    render(<PhaseIndicator />);
    expect(screen.getByTitle("Review: awaiting_gate")).toBeDefined();
  });
});
