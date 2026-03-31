import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { EnhancedProjectCard } from "./EnhancedProjectCard";
import type { Project, ClaudeSessionState } from "../../stores/types";

afterEach(cleanup);

const mockProject: Project = {
  id: "proj-1",
  name: "my-saas-app",
  workspacePath: "/tmp/test",
  claudeSessionId: "cs-1",
  summary: "A test project",
  createdAt: "2026-03-30T00:00:00Z",
  linkedRepoIds: [],
  linkedSkillIds: [],
  linkedAgentNames: [],
};

const mockSessions: Map<string, ClaudeSessionState> = new Map([
  ["cs-1", {
    id: "cs-1", name: "Auth refactor", chatMessages: [], agentEvents: [],
    isWorking: true, conversationId: null, currentInvocationId: null,
    agentError: null, needsInput: false, attentionPreview: null,
    attentionMessageId: null, status: "working", createdAt: "2026-03-30T00:00:00Z",
    currentActivityMessageId: null, previewUrl: null, testSummary: null,
    buildStatus: "idle", buildStatusText: null,
  }],
  ["cs-2", {
    id: "cs-2", name: "Dashboard UI", chatMessages: [], agentEvents: [],
    isWorking: false, conversationId: null, currentInvocationId: null,
    agentError: null, needsInput: false, attentionPreview: null,
    attentionMessageId: null, status: "idle", createdAt: "2026-03-30T00:00:00Z",
    currentActivityMessageId: null, previewUrl: null, testSummary: null,
    buildStatus: "idle", buildStatusText: null,
  }],
]);

describe("EnhancedProjectCard", () => {
  it("renders project name", () => {
    render(
      <EnhancedProjectCard
        project={mockProject}
        sessions={mockSessions}
        onOpen={vi.fn()}
        onOpenSession={vi.fn()}
      />
    );
    expect(screen.getByText("my-saas-app")).toBeDefined();
  });

  it("shows active session count", () => {
    render(
      <EnhancedProjectCard
        project={mockProject}
        sessions={mockSessions}
        onOpen={vi.fn()}
        onOpenSession={vi.fn()}
      />
    );
    expect(screen.getByText("1 active")).toBeDefined();
  });

  it("lists session names", () => {
    render(
      <EnhancedProjectCard
        project={mockProject}
        sessions={mockSessions}
        onOpen={vi.fn()}
        onOpenSession={vi.fn()}
      />
    );
    expect(screen.getByText("Auth refactor")).toBeDefined();
    expect(screen.getByText("Dashboard UI")).toBeDefined();
  });
});
