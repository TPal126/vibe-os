import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GatePromptCard } from "./GatePromptCard";
import type { ChatMessage } from "../../stores/types";

const mockAdvance = vi.fn();
vi.mock("../../stores", () => ({
  useAppStore: (selector: (s: any) => any) =>
    selector({
      activePipelineRun: { pipelineRunId: "run-1" },
      advancePipelineGate: mockAdvance,
    }),
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: any) => fn,
}));

afterEach(() => {
  cleanup();
});

describe("GatePromptCard", () => {
  const gateMessage: ChatMessage = {
    id: "msg-1",
    role: "system",
    content: "Phase 'Planning' complete. Review and continue.",
    timestamp: "2026-04-12T00:00:00Z",
    cardType: "gate-prompt",
    cardData: { gate: "awaiting", next_phase_id: "p-3" },
  };

  it("renders gate message content", () => {
    render(<GatePromptCard message={gateMessage} />);
    expect(screen.getByText(/Planning.*complete/)).toBeDefined();
  });

  it("shows continue button when gate is awaiting", () => {
    render(<GatePromptCard message={gateMessage} />);
    expect(screen.getByText("Continue to next phase")).toBeDefined();
  });

  it("calls advancePipelineGate on continue click", () => {
    render(<GatePromptCard message={gateMessage} />);
    fireEvent.click(screen.getByText("Continue to next phase"));
    expect(mockAdvance).toHaveBeenCalledWith("run-1");
  });
});
