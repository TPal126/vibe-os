import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QuadrantLayout } from "./QuadrantLayout";

// Mock all panel components to simple divs with test IDs
vi.mock("../panels/ClaudeChat", () => ({
  ClaudeChat: () => <div data-testid="claude-chat">Chat</div>,
}));
vi.mock("../panels/ResourcesTab", () => ({
  ResourcesTab: () => <div data-testid="resources-tab">Resources</div>,
}));
vi.mock("../panels/TokenControlPanel", () => ({
  TokenControlPanel: () => <div data-testid="token-control">Tokens</div>,
}));
vi.mock("../panels/WorkspaceTree", () => ({
  WorkspaceTree: () => <div data-testid="workspace-tree">Files</div>,
}));
vi.mock("../panels/AuditLog", () => ({
  AuditLog: () => <div data-testid="audit-log">Audit</div>,
}));
vi.mock("../panels/AgentStream", () => ({
  AgentStream: () => <div data-testid="agent-stream">Events</div>,
}));
vi.mock("../center/KnowledgeGraph", () => ({
  KnowledgeGraph: () => <div data-testid="knowledge-graph">Graph</div>,
}));
vi.mock("../architecture/ArchitectureDiagram", () => ({
  ArchitectureDiagram: () => <div data-testid="arch-diagram">Architecture</div>,
}));

// Mock PaneContainer to just render children with a wrapper
vi.mock("./PaneContainer", () => ({
  PaneContainer: ({ children }: any) => <div data-testid="pane-container">{children}</div>,
  topRightTabs: [],
  bottomLeftTabs: [],
  bottomRightTabs: [],
}));

// Mock react-resizable-panels (v4.8 exports Group, Panel, Separator)
vi.mock("react-resizable-panels", () => ({
  Group: ({ children, ...props }: any) => (
    <div data-testid={`panel-group-${props.orientation}`}>{children}</div>
  ),
  Panel: ({ children }: any) => <div data-testid="panel">{children}</div>,
  Separator: () => <div data-testid="resize-handle" />,
}));

// Mock the store
const mockState = {
  topRightTab: "architecture",
  bottomLeftTab: "resources",
  bottomRightTab: "audit",
  setTopRightTab: vi.fn(),
  setBottomLeftTab: vi.fn(),
  setBottomRightTab: vi.fn(),
  maximizedPane: null,
  setMaximizedPane: vi.fn(),
  pinnedPanes: new Set(),
  togglePinnedPane: vi.fn(),
  activeFilePath: null,
  setEditorPanelOpen: vi.fn(),
};

vi.mock("../../stores", () => ({
  useAppStore: (selector: any) => selector(mockState),
}));

describe("QuadrantLayout", () => {
  afterEach(cleanup);
  it("renders chat pane in top-left", () => {
    render(<QuadrantLayout />);
    expect(screen.getByTestId("claude-chat")).toBeDefined();
  });

  it("renders architecture diagram when topRightTab is architecture", () => {
    render(<QuadrantLayout />);
    expect(screen.getByTestId("arch-diagram")).toBeDefined();
  });

  it("renders resources tab when bottomLeftTab is resources", () => {
    render(<QuadrantLayout />);
    expect(screen.getByTestId("resources-tab")).toBeDefined();
  });

  it("renders audit log when bottomRightTab is audit", () => {
    render(<QuadrantLayout />);
    expect(screen.getByTestId("audit-log")).toBeDefined();
  });

  it("renders resize handles between panes", () => {
    render(<QuadrantLayout />);
    const handles = screen.getAllByTestId("resize-handle");
    expect(handles.length).toBeGreaterThanOrEqual(2);
  });
});
