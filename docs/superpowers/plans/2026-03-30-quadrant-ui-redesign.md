# Quadrant UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-column layout with an RStudio-inspired quadrant layout featuring live architecture diagrams, context controls, independent multi-session support, and cost tracking.

**Architecture:** The current `MainLayout` (chat + right sidebar) becomes a `QuadrantLayout` using nested `react-resizable-panels` for a 2x2 grid. Existing panel components (SkillsPanel, RepoManager, AuditLog, etc.) are redistributed across quadrants with no internal changes. The `layoutSlice` gains quadrant-specific state. A new `ArchitectureDiagram` component renders repo topology and module detail views using D3.js, powered by existing SurrealDB graph data.

**Tech Stack:** React 18, TypeScript 5.5, Zustand 5, react-resizable-panels 4.8, D3.js 7.9, Tailwind CSS 4, Tauri 2, rusqlite, SurrealDB 3.0

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/layout/QuadrantLayout.tsx` | 2x2 resizable grid using PanelGroup/Panel, routes panes to content |
| `src/components/layout/PaneContainer.tsx` | Single pane wrapper: tab strip + content + maximize/pin controls |
| `src/components/layout/QuadrantLayout.test.tsx` | Tests for quadrant layout rendering and pane content routing |
| `src/components/architecture/ArchitectureDiagram.tsx` | D3 SVG renderer for repo topology (Level 1) and module detail (Level 2) |
| `src/components/architecture/ArchitectureBreadcrumb.tsx` | Breadcrumb nav for zoom level transitions |
| `src/components/architecture/ArchitectureDiagram.test.tsx` | Tests for architecture data transformation and rendering |
| `src/components/home/EnhancedProjectCard.tsx` | Extended ProjectCard with session list, cost, direct session launch |
| `src/components/home/EnhancedProjectCard.test.tsx` | Tests for enhanced project card rendering |
| `src/stores/slices/layoutSlice.test.ts` | Extended (already exists, add quadrant tests) |

### Modified Files
| File | Changes |
|------|---------|
| `src/stores/types.ts` | Add quadrant pane types to `LayoutSlice`, add `ArchitectureData` types |
| `src/stores/slices/layoutSlice.ts` | Add quadrant pane state (active tabs, pinned, maximized per pane) |
| `src/components/layout/MainLayout.tsx` | Replace body with `QuadrantLayout` for conversation view |
| `src/components/home/HomeScreen.tsx` | Swap `ProjectCard` for `EnhancedProjectCard` |
| `src/components/settings/SettingsPanel.tsx` | Remove (content distributed to quadrants) |
| `src/lib/tauri.ts` | Add `graphGetTopology` wrapper for architecture data |
| `src-tauri/src/commands/graph_commands.rs` | Add `graph_get_topology` command |
| `src-tauri/src/graph/queries.rs` | Add `get_topology()` query function |
| `src-tauri/src/lib.rs` | Register `graph_get_topology` in `generate_handler![]` |

---

## Task 1: Extend Layout Slice with Quadrant State

**Files:**
- Modify: `src/stores/types.ts:375-396`
- Modify: `src/stores/slices/layoutSlice.ts`
- Modify: `src/stores/slices/layoutSlice.test.ts`

- [ ] **Step 1: Write failing tests for quadrant state**

Add to `src/stores/slices/layoutSlice.test.ts`:

```typescript
describe("quadrant panes", () => {
  it("defaults to correct active tabs per pane", () => {
    const state = store.getState();
    expect(state.topRightTab).toBe("architecture");
    expect(state.bottomLeftTab).toBe("skills");
    expect(state.bottomRightTab).toBe("audit");
  });

  it("setTopRightTab changes tab", () => {
    store.getState().setTopRightTab("graph");
    expect(store.getState().topRightTab).toBe("graph");
  });

  it("setBottomLeftTab changes tab", () => {
    store.getState().setBottomLeftTab("repos");
    expect(store.getState().bottomLeftTab).toBe("repos");
  });

  it("setBottomRightTab changes tab", () => {
    store.getState().setBottomRightTab("decisions");
    expect(store.getState().bottomRightTab).toBe("decisions");
  });

  it("maximized pane defaults to null", () => {
    expect(store.getState().maximizedPane).toBeNull();
  });

  it("setMaximizedPane sets and clears", () => {
    store.getState().setMaximizedPane("top-right");
    expect(store.getState().maximizedPane).toBe("top-right");
    store.getState().setMaximizedPane(null);
    expect(store.getState().maximizedPane).toBeNull();
  });

  it("pinnedPanes defaults to empty set", () => {
    expect(store.getState().pinnedPanes.size).toBe(0);
  });

  it("togglePinnedPane adds and removes", () => {
    store.getState().togglePinnedPane("bottom-left");
    expect(store.getState().pinnedPanes.has("bottom-left")).toBe(true);
    store.getState().togglePinnedPane("bottom-left");
    expect(store.getState().pinnedPanes.has("bottom-left")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/stores/slices/layoutSlice.test.ts`
Expected: FAIL — properties `topRightTab`, `bottomLeftTab`, etc. not found on state

- [ ] **Step 3: Add quadrant types to LayoutSlice**

In `src/stores/types.ts`, replace the `LayoutSlice` interface (lines 377-396):

```typescript
export type PaneId = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface LayoutSlice {
  drawerOpen: boolean;
  activeDrawerTab: string;
  toggleDrawer: () => void;
  setDrawerOpen: (open: boolean) => void;
  setActiveDrawerTab: (tab: string) => void;
  openDrawerToTab: (tab: string) => void;

  // Editor panel (bottom slide-in)
  editorPanelOpen: boolean;
  toggleEditorPanel: () => void;
  setEditorPanelOpen: (open: boolean) => void;

  // Quadrant pane tabs
  topRightTab: string;
  bottomLeftTab: string;
  bottomRightTab: string;
  setTopRightTab: (tab: string) => void;
  setBottomLeftTab: (tab: string) => void;
  setBottomRightTab: (tab: string) => void;

  // Quadrant pane state
  maximizedPane: PaneId | null;
  setMaximizedPane: (pane: PaneId | null) => void;
  pinnedPanes: Set<PaneId>;
  togglePinnedPane: (pane: PaneId) => void;
}
```

- [ ] **Step 4: Implement quadrant state in layoutSlice**

Replace `src/stores/slices/layoutSlice.ts`:

```typescript
import type { SliceCreator, LayoutSlice, PaneId } from "../types";

export const createLayoutSlice: SliceCreator<LayoutSlice> = (set) => ({
  drawerOpen: false,
  activeDrawerTab: "editor",
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  setDrawerOpen: (open: boolean) => set({ drawerOpen: open }),
  setActiveDrawerTab: (tab: string) => set({ activeDrawerTab: tab }),
  openDrawerToTab: (tab: string) =>
    set({ drawerOpen: true, activeDrawerTab: tab }),

  // Editor panel
  editorPanelOpen: false,
  toggleEditorPanel: () =>
    set((s) => ({ editorPanelOpen: !s.editorPanelOpen })),
  setEditorPanelOpen: (open) => set({ editorPanelOpen: open }),

  // Quadrant pane tabs
  topRightTab: "architecture",
  bottomLeftTab: "skills",
  bottomRightTab: "audit",
  setTopRightTab: (tab) => set({ topRightTab: tab }),
  setBottomLeftTab: (tab) => set({ bottomLeftTab: tab }),
  setBottomRightTab: (tab) => set({ bottomRightTab: tab }),

  // Quadrant pane state
  maximizedPane: null,
  setMaximizedPane: (pane) => set({ maximizedPane: pane }),
  pinnedPanes: new Set<PaneId>(),
  togglePinnedPane: (pane) =>
    set((s) => {
      const next = new Set(s.pinnedPanes);
      if (next.has(pane)) next.delete(pane);
      else next.add(pane);
      return { pinnedPanes: next };
    }),
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- src/stores/slices/layoutSlice.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/stores/types.ts src/stores/slices/layoutSlice.ts src/stores/slices/layoutSlice.test.ts
git commit -m "feat(layout): add quadrant pane state to layoutSlice"
```

---

## Task 2: Create PaneContainer Component

**Files:**
- Create: `src/components/layout/PaneContainer.tsx`

- [ ] **Step 1: Create PaneContainer component**

This is a pure presentational wrapper — a tab strip on top, content below, with maximize/pin affordances. No complex logic to unit test; it will be integration tested via QuadrantLayout.

Create `src/components/layout/PaneContainer.tsx`:

```tsx
import { type ReactNode } from "react";
import {
  FolderGit2,
  BookOpen,
  Gauge,
  Folder,
  ScrollText,
  Activity,
  Share2,
  Network,
  Eye,
  MessageSquare,
  Maximize2,
  Minimize2,
  Pin,
} from "lucide-react";
import { TabStrip, type Tab } from "./TabStrip";
import { IconButton } from "../shared/IconButton";
import type { PaneId } from "../../stores/types";

interface PaneContainerProps {
  paneId: PaneId;
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  maximized: boolean;
  pinned: boolean;
  onToggleMaximize: () => void;
  onTogglePin: () => void;
  children: ReactNode;
}

export function PaneContainer({
  paneId,
  tabs,
  activeTab,
  onTabChange,
  maximized,
  pinned,
  onToggleMaximize,
  onTogglePin,
  children,
}: PaneContainerProps) {
  return (
    <div className="w-full h-full bg-v-bg flex flex-col overflow-hidden">
      <div className="shrink-0 border-b border-v-border flex items-center">
        <div className="flex-1 overflow-hidden">
          <TabStrip tabs={tabs} activeId={activeTab} onChange={onTabChange} />
        </div>
        <div className="flex items-center gap-0.5 px-1 shrink-0">
          <IconButton
            icon={<Pin size={9} />}
            title={pinned ? "Unpin pane" : "Pin pane"}
            active={pinned}
            onClick={onTogglePin}
          />
          <IconButton
            icon={maximized ? <Minimize2 size={9} /> : <Maximize2 size={9} />}
            title={maximized ? "Restore pane" : "Maximize pane"}
            onClick={onToggleMaximize}
          />
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// Tab definitions for each pane
export const topRightTabs: Tab[] = [
  { id: "architecture", label: "Architecture", icon: <Network size={10} /> },
  { id: "graph", label: "Graph", icon: <Share2 size={10} /> },
  { id: "preview", label: "Preview", icon: <Eye size={10} /> },
];

export const bottomLeftTabs: Tab[] = [
  { id: "skills", label: "Skills", icon: <BookOpen size={10} /> },
  { id: "repos", label: "Repos", icon: <FolderGit2 size={10} /> },
  { id: "tokens", label: "Tokens", icon: <Gauge size={10} /> },
  { id: "files", label: "Files", icon: <Folder size={10} /> },
];

export const bottomRightTabs: Tab[] = [
  { id: "audit", label: "Audit", icon: <ScrollText size={10} /> },
  { id: "decisions", label: "Decisions", icon: <MessageSquare size={10} /> },
  { id: "console", label: "Console", icon: <Activity size={10} /> },
  { id: "events", label: "Events", icon: <Activity size={10} /> },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/PaneContainer.tsx
git commit -m "feat(layout): add PaneContainer wrapper with tabs, pin, maximize"
```

---

## Task 3: Create QuadrantLayout Component

**Files:**
- Create: `src/components/layout/QuadrantLayout.tsx`
- Create: `src/components/layout/QuadrantLayout.test.tsx`

- [ ] **Step 1: Write failing test for QuadrantLayout rendering**

Create `src/components/layout/QuadrantLayout.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuadrantLayout } from "./QuadrantLayout";

// Mock all panel components to simple divs with test IDs
vi.mock("../panels/ClaudeChat", () => ({
  ClaudeChat: () => <div data-testid="claude-chat">Chat</div>,
}));
vi.mock("../panels/SkillsPanel", () => ({
  SkillsPanel: () => <div data-testid="skills-panel">Skills</div>,
}));
vi.mock("../panels/RepoManager", () => ({
  RepoManager: () => <div data-testid="repo-manager">Repos</div>,
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

// Mock react-resizable-panels — render children in a simple div
vi.mock("react-resizable-panels", () => ({
  PanelGroup: ({ children, ...props }: any) => (
    <div data-testid={`panel-group-${props.direction}`}>{children}</div>
  ),
  Panel: ({ children }: any) => <div data-testid="panel">{children}</div>,
  PanelResizeHandle: () => <div data-testid="resize-handle" />,
}));

// Mock the store
const mockState = {
  topRightTab: "architecture",
  bottomLeftTab: "skills",
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
  it("renders chat pane in top-left", () => {
    render(<QuadrantLayout />);
    expect(screen.getByTestId("claude-chat")).toBeDefined();
  });

  it("renders architecture diagram when topRightTab is architecture", () => {
    render(<QuadrantLayout />);
    expect(screen.getByTestId("arch-diagram")).toBeDefined();
  });

  it("renders skills panel when bottomLeftTab is skills", () => {
    render(<QuadrantLayout />);
    expect(screen.getByTestId("skills-panel")).toBeDefined();
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/components/layout/QuadrantLayout.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create QuadrantLayout component**

Create `src/components/layout/QuadrantLayout.tsx`:

```tsx
import { useRef, useEffect } from "react";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
} from "react-resizable-panels";
import { useAppStore } from "../../stores";
import { ClaudeChat } from "../panels/ClaudeChat";
import { SkillsPanel } from "../panels/SkillsPanel";
import { RepoManager } from "../panels/RepoManager";
import { TokenControlPanel } from "../panels/TokenControlPanel";
import { WorkspaceTree } from "../panels/WorkspaceTree";
import { AuditLog } from "../panels/AuditLog";
import { AgentStream } from "../panels/AgentStream";
import { KnowledgeGraph } from "../center/KnowledgeGraph";
import { ArchitectureDiagram } from "../architecture/ArchitectureDiagram";
import {
  PaneContainer,
  topRightTabs,
  bottomLeftTabs,
  bottomRightTabs,
} from "./PaneContainer";
import type { PaneId } from "../../stores/types";

function FilesTabWrapper() {
  const activeFilePath = useAppStore((s) => s.activeFilePath);
  const setEditorPanelOpen = useAppStore((s) => s.setEditorPanelOpen);
  const prevPathRef = useRef(activeFilePath);

  useEffect(() => {
    if (activeFilePath && activeFilePath !== prevPathRef.current) {
      setEditorPanelOpen(true);
    }
    prevPathRef.current = activeFilePath;
  }, [activeFilePath, setEditorPanelOpen]);

  return <WorkspaceTree />;
}

function TopRightContent({ tab }: { tab: string }) {
  if (tab === "graph") return <KnowledgeGraph />;
  if (tab === "preview") return <div className="h-full flex items-center justify-center text-v-dim text-xs">No preview active</div>;
  return <ArchitectureDiagram />;
}

function BottomLeftContent({ tab }: { tab: string }) {
  if (tab === "repos") return <RepoManager />;
  if (tab === "tokens") return <TokenControlPanel />;
  if (tab === "files") return <FilesTabWrapper />;
  return <SkillsPanel />;
}

function BottomRightContent({ tab }: { tab: string }) {
  if (tab === "decisions") return <div className="h-full"><AuditLog /></div>;
  if (tab === "console") return <div className="h-full flex items-center justify-center text-v-dim text-xs">Console</div>;
  if (tab === "events") return <AgentStream />;
  return <AuditLog />;
}

export function QuadrantLayout() {
  const topRightTab = useAppStore((s) => s.topRightTab);
  const bottomLeftTab = useAppStore((s) => s.bottomLeftTab);
  const bottomRightTab = useAppStore((s) => s.bottomRightTab);
  const setTopRightTab = useAppStore((s) => s.setTopRightTab);
  const setBottomLeftTab = useAppStore((s) => s.setBottomLeftTab);
  const setBottomRightTab = useAppStore((s) => s.setBottomRightTab);
  const maximizedPane = useAppStore((s) => s.maximizedPane);
  const setMaximizedPane = useAppStore((s) => s.setMaximizedPane);
  const pinnedPanes = useAppStore((s) => s.pinnedPanes);
  const togglePinnedPane = useAppStore((s) => s.togglePinnedPane);

  const handleMaximize = (pane: PaneId) => {
    setMaximizedPane(maximizedPane === pane ? null : pane);
  };

  // If a pane is maximized, render only that pane
  if (maximizedPane) {
    return (
      <div className="w-full h-full">
        {maximizedPane === "top-left" && <ClaudeChat />}
        {maximizedPane === "top-right" && (
          <PaneContainer
            paneId="top-right"
            tabs={topRightTabs}
            activeTab={topRightTab}
            onTabChange={setTopRightTab}
            maximized={true}
            pinned={pinnedPanes.has("top-right")}
            onToggleMaximize={() => handleMaximize("top-right")}
            onTogglePin={() => togglePinnedPane("top-right")}
          >
            <TopRightContent tab={topRightTab} />
          </PaneContainer>
        )}
        {maximizedPane === "bottom-left" && (
          <PaneContainer
            paneId="bottom-left"
            tabs={bottomLeftTabs}
            activeTab={bottomLeftTab}
            onTabChange={setBottomLeftTab}
            maximized={true}
            pinned={pinnedPanes.has("bottom-left")}
            onToggleMaximize={() => handleMaximize("bottom-left")}
            onTogglePin={() => togglePinnedPane("bottom-left")}
          >
            <BottomLeftContent tab={bottomLeftTab} />
          </PaneContainer>
        )}
        {maximizedPane === "bottom-right" && (
          <PaneContainer
            paneId="bottom-right"
            tabs={bottomRightTabs}
            activeTab={bottomRightTab}
            onTabChange={setBottomRightTab}
            maximized={true}
            pinned={pinnedPanes.has("bottom-right")}
            onToggleMaximize={() => handleMaximize("bottom-right")}
            onTogglePin={() => togglePinnedPane("bottom-right")}
          >
            <BottomRightContent tab={bottomRightTab} />
          </PaneContainer>
        )}
      </div>
    );
  }

  return (
    <PanelGroup direction="vertical">
      {/* Top row */}
      <Panel defaultSize={60} minSize={30}>
        <PanelGroup direction="horizontal">
          {/* Top-left: Chat */}
          <Panel defaultSize={55} minSize={25}>
            <ClaudeChat />
          </Panel>

          <PanelResizeHandle className="w-[3px] bg-v-border hover:bg-v-accent/50 transition-colors cursor-col-resize" />

          {/* Top-right: Architecture / Graph / Preview */}
          <Panel defaultSize={45} minSize={20}>
            <PaneContainer
              paneId="top-right"
              tabs={topRightTabs}
              activeTab={topRightTab}
              onTabChange={setTopRightTab}
              maximized={false}
              pinned={pinnedPanes.has("top-right")}
              onToggleMaximize={() => handleMaximize("top-right")}
              onTogglePin={() => togglePinnedPane("top-right")}
            >
              <TopRightContent tab={topRightTab} />
            </PaneContainer>
          </Panel>
        </PanelGroup>
      </Panel>

      <PanelResizeHandle className="h-[3px] bg-v-border hover:bg-v-accent/50 transition-colors cursor-row-resize" />

      {/* Bottom row */}
      <Panel defaultSize={40} minSize={20}>
        <PanelGroup direction="horizontal">
          {/* Bottom-left: Context controls */}
          <Panel defaultSize={55} minSize={20}>
            <PaneContainer
              paneId="bottom-left"
              tabs={bottomLeftTabs}
              activeTab={bottomLeftTab}
              onTabChange={setBottomLeftTab}
              maximized={false}
              pinned={pinnedPanes.has("bottom-left")}
              onToggleMaximize={() => handleMaximize("bottom-left")}
              onTogglePin={() => togglePinnedPane("bottom-left")}
            >
              <BottomLeftContent tab={bottomLeftTab} />
            </PaneContainer>
          </Panel>

          <PanelResizeHandle className="w-[3px] bg-v-border hover:bg-v-accent/50 transition-colors cursor-col-resize" />

          {/* Bottom-right: Activity / Deep dive */}
          <Panel defaultSize={45} minSize={20}>
            <PaneContainer
              paneId="bottom-right"
              tabs={bottomRightTabs}
              activeTab={bottomRightTab}
              onTabChange={setBottomRightTab}
              maximized={false}
              pinned={pinnedPanes.has("bottom-right")}
              onToggleMaximize={() => handleMaximize("bottom-right")}
              onTogglePin={() => togglePinnedPane("bottom-right")}
            >
              <BottomRightContent tab={bottomRightTab} />
            </PaneContainer>
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/components/layout/QuadrantLayout.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/QuadrantLayout.tsx src/components/layout/QuadrantLayout.test.tsx
git commit -m "feat(layout): add QuadrantLayout with 4-pane resizable grid"
```

---

## Task 4: Create Architecture Diagram Placeholder

**Files:**
- Create: `src/components/architecture/ArchitectureDiagram.tsx`
- Create: `src/components/architecture/ArchitectureBreadcrumb.tsx`

- [ ] **Step 1: Create ArchitectureBreadcrumb component**

Create `src/components/architecture/ArchitectureBreadcrumb.tsx`:

```tsx
import { ChevronRight } from "lucide-react";

interface ArchitectureBreadcrumbProps {
  path: string[];  // e.g., ["All Repos"] or ["All Repos", "api-server"]
  onNavigate: (depth: number) => void;
}

export function ArchitectureBreadcrumb({ path, onNavigate }: ArchitectureBreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 text-[9px] shrink-0">
      {path.map((segment, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={8} className="text-v-dim" />}
          {i < path.length - 1 ? (
            <button
              onClick={() => onNavigate(i)}
              className="text-v-accent hover:text-v-accentHi"
            >
              {segment}
            </button>
          ) : (
            <span className="text-v-textHi font-semibold">{segment}</span>
          )}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create ArchitectureDiagram placeholder component**

Create `src/components/architecture/ArchitectureDiagram.tsx`:

```tsx
import { useState, useEffect, useCallback, memo } from "react";
import { RefreshCw } from "lucide-react";
import { ArchitectureBreadcrumb } from "./ArchitectureBreadcrumb";
import { IconButton } from "../shared/IconButton";

interface RepoNode {
  id: string;
  label: string;
  framework: string;
  stats: string;
  active: boolean;
}

interface RepoEdge {
  source: string;
  target: string;
  edgeType: string;
}

interface TopologyData {
  repos: RepoNode[];
  edges: RepoEdge[];
}

export const ArchitectureDiagram = memo(function ArchitectureDiagram() {
  const [zoomLevel, setZoomLevel] = useState<"repo" | "module">("repo");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [topology, setTopology] = useState<TopologyData>({ repos: [], edges: [] });
  const [loading, setLoading] = useState(false);

  const breadcrumbPath = zoomLevel === "repo"
    ? ["All Repos"]
    : ["All Repos", selectedRepo ?? ""];

  const handleBreadcrumbNavigate = useCallback((depth: number) => {
    if (depth === 0) {
      setZoomLevel("repo");
      setSelectedRepo(null);
    }
  }, []);

  const handleRepoClick = useCallback((repoId: string) => {
    setSelectedRepo(repoId);
    setZoomLevel("module");
  }, []);

  // Placeholder: will be replaced with real data fetching in Task 7
  return (
    <div className="flex flex-col h-full bg-v-bg">
      <div className="shrink-0 border-b border-v-border flex items-center justify-between">
        <ArchitectureBreadcrumb
          path={breadcrumbPath}
          onNavigate={handleBreadcrumbNavigate}
        />
        <div className="px-2">
          <IconButton
            icon={<RefreshCw size={10} className={loading ? "animate-spin" : ""} />}
            title="Refresh architecture"
            onClick={() => {}}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {zoomLevel === "repo" ? (
          <div className="text-center">
            <p className="text-v-dim text-xs">Architecture Diagram</p>
            <p className="text-v-dim text-[10px] mt-1">
              Repo topology will render here.
            </p>
            <p className="text-v-dim text-[10px]">
              Index a repo to see nodes.
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-v-dim text-xs">Module Detail: {selectedRepo}</p>
            <p className="text-v-dim text-[10px] mt-1">
              Module structure will render here.
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 px-2 py-1 border-t border-v-border flex items-center gap-3 text-[8px] text-v-dim">
        <span><span className="text-v-accent">●</span> active session</span>
        <span><span className="text-v-green">●</span> changed</span>
        <span><span className="text-v-dim">●</span> idle</span>
      </div>
    </div>
  );
});
```

- [ ] **Step 3: Commit**

```bash
git add src/components/architecture/ArchitectureDiagram.tsx src/components/architecture/ArchitectureBreadcrumb.tsx
git commit -m "feat(arch): add ArchitectureDiagram placeholder with breadcrumb nav"
```

---

## Task 5: Wire QuadrantLayout into MainLayout

**Files:**
- Modify: `src/components/layout/MainLayout.tsx`

- [ ] **Step 1: Replace MainLayout conversation view with QuadrantLayout**

Replace the contents of `src/components/layout/MainLayout.tsx`:

```tsx
import { HomeScreen } from "../home/HomeScreen";
import { EditorPanel } from "../editor/EditorPanel";
import { QuadrantLayout } from "./QuadrantLayout";
import { useAppStore } from "../../stores";

export function MainLayout() {
  const currentView = useAppStore((s) => s.currentView);

  if (currentView === "home") {
    return (
      <div className="flex-1 overflow-hidden relative">
        <HomeScreen />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden relative">
      <QuadrantLayout />
      <EditorPanel />
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite to verify nothing is broken**

Run: `npm run test`
Expected: All existing tests PASS (panel components are unchanged, only their parent container changed)

- [ ] **Step 3: Run the dev server to visually verify the layout**

Run: `npm run dev`
Expected: The app renders with four resizable quadrants — chat top-left, architecture placeholder top-right, skills bottom-left, audit bottom-right. Resize handles work. Tabs switch content within each pane.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/MainLayout.tsx
git commit -m "feat(layout): wire QuadrantLayout into MainLayout, replace two-column view"
```

---

## Task 6: Remove SettingsPanel

**Files:**
- Delete: `src/components/settings/SettingsPanel.tsx`
- Modify: `src/stores/types.ts` (remove settingsPanel state)
- Modify: `src/stores/slices/layoutSlice.ts` (remove settingsPanel state)
- Modify: `src/stores/slices/layoutSlice.test.ts` (remove settingsPanel tests)

- [ ] **Step 1: Remove settingsPanel state from types**

In `src/stores/types.ts`, the `LayoutSlice` interface was already rewritten in Task 1 without `settingsPanelOpen`, `settingsPanelTab`, `toggleSettingsPanel`, `setSettingsPanelOpen`, `setSettingsPanelTab`. Verify they are gone.

- [ ] **Step 2: Remove settings panel tests from layoutSlice.test.ts**

In `src/stores/slices/layoutSlice.test.ts`, remove the `describe("settings panel", ...)` block:

```typescript
// DELETE this entire block:
describe("settings panel", () => {
  it("defaults to closed with repos tab", () => {
    ...
  });
  it("toggleSettingsPanel toggles", () => {
    ...
  });
  it("setSettingsPanelTab changes tab", () => {
    ...
  });
});
```

- [ ] **Step 3: Delete SettingsPanel.tsx**

```bash
rm src/components/settings/SettingsPanel.tsx
```

- [ ] **Step 4: Verify no remaining imports of SettingsPanel**

Run: `grep -r "SettingsPanel" src/ --include="*.ts" --include="*.tsx"`
Expected: No results (MainLayout was already updated in Task 5)

- [ ] **Step 5: Run tests**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "refactor(layout): remove SettingsPanel, content now in quadrant panes"
```

---

## Task 7: Add Architecture Topology Backend Query

**Files:**
- Modify: `src-tauri/src/graph/queries.rs`
- Modify: `src-tauri/src/commands/graph_commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add TopologyData structs to queries.rs**

Add to `src-tauri/src/graph/queries.rs`:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct TopologyNode {
    pub id: String,
    pub label: String,
    pub node_type: String,
    pub framework: String,
    pub stats: String,
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TopologyEdge {
    pub source: String,
    pub target: String,
    pub edge_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TopologyData {
    pub repos: Vec<TopologyNode>,
    pub modules: Vec<TopologyNode>,
    pub edges: Vec<TopologyEdge>,
}

pub async fn get_topology(db: &Surreal<Db>) -> Result<TopologyData, String> {
    // Get all repo nodes
    let repos: Vec<serde_json::Value> = db
        .query("SELECT * FROM repo")
        .await
        .map_err(|e| e.to_string())?
        .take(0)
        .map_err(|e| e.to_string())?;

    let repo_nodes: Vec<TopologyNode> = repos
        .into_iter()
        .map(|r| {
            let id = r.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let label = r.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let framework = r.get("framework").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let stats = r.get("stats").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let active = r.get("active").and_then(|v| v.as_bool()).unwrap_or(false);
            TopologyNode { id, label, node_type: "repo".into(), framework, stats, active }
        })
        .collect();

    // Get all module nodes
    let modules: Vec<serde_json::Value> = db
        .query("SELECT * FROM module")
        .await
        .map_err(|e| e.to_string())?
        .take(0)
        .map_err(|e| e.to_string())?;

    let module_nodes: Vec<TopologyNode> = modules
        .into_iter()
        .map(|m| {
            let id = m.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let label = m.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let framework = "".to_string();
            let stats = m.get("stats").and_then(|v| v.as_str()).unwrap_or("").to_string();
            TopologyNode { id, label, node_type: "module".into(), framework, stats, active: false }
        })
        .collect();

    // Get structural edges (imports, calls, depends_on, belongs_to)
    let edge_tables = ["imports", "calls", "depends_on", "belongs_to"];
    let mut all_edges = Vec::new();

    for table in edge_tables {
        let query = format!("SELECT in, out FROM {}", table);
        let edges: Vec<serde_json::Value> = db
            .query(&query)
            .await
            .map_err(|e| e.to_string())?
            .take(0)
            .map_err(|e| e.to_string())?;

        for e in edges {
            let source = e.get("in").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let target = e.get("out").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if !source.is_empty() && !target.is_empty() {
                all_edges.push(TopologyEdge {
                    source,
                    target,
                    edge_type: table.to_string(),
                });
            }
        }
    }

    Ok(TopologyData {
        repos: repo_nodes,
        modules: module_nodes,
        edges: all_edges,
    })
}
```

- [ ] **Step 2: Add graph_get_topology command**

Add to `src-tauri/src/commands/graph_commands.rs`:

```rust
#[tauri::command]
pub async fn graph_get_topology(
    db: tauri::State<'_, Surreal<Db>>,
) -> Result<queries::TopologyData, String> {
    queries::get_topology(&db).await
}
```

- [ ] **Step 3: Register command in lib.rs**

In `src-tauri/src/lib.rs`, add `graph_commands::graph_get_topology` to the `generate_handler![]` macro.

- [ ] **Step 4: Add TypeScript wrapper**

Add to `src/lib/tauri.ts` in the `commands` object:

```typescript
graphGetTopology: () =>
  invoke<{
    repos: { id: string; label: string; node_type: string; framework: string; stats: string; active: boolean }[];
    modules: { id: string; label: string; node_type: string; framework: string; stats: string; active: boolean }[];
    edges: { source: string; target: string; edge_type: string }[];
  }>("graph_get_topology"),
```

- [ ] **Step 5: Run Rust tests**

Run: `npm run test:rust`
Expected: All Rust tests PASS (new function is a query, no breaking changes)

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/graph/queries.rs src-tauri/src/commands/graph_commands.rs src-tauri/src/lib.rs src/lib/tauri.ts
git commit -m "feat(graph): add graph_get_topology query for architecture diagram"
```

---

## Task 8: Implement Architecture Diagram D3 Rendering

**Files:**
- Modify: `src/components/architecture/ArchitectureDiagram.tsx`
- Create: `src/components/architecture/ArchitectureDiagram.test.tsx`

- [ ] **Step 1: Write test for topology data transformation**

Create `src/components/architecture/ArchitectureDiagram.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { buildRepoSimulation } from "./ArchitectureDiagram";

describe("buildRepoSimulation", () => {
  it("returns empty arrays for empty topology", () => {
    const result = buildRepoSimulation({ repos: [], modules: [], edges: [] });
    expect(result.nodes).toEqual([]);
    expect(result.links).toEqual([]);
  });

  it("converts repos to D3 nodes", () => {
    const result = buildRepoSimulation({
      repos: [
        { id: "repo:api", label: "api-server", node_type: "repo", framework: "Express", stats: "24 routes", active: true },
        { id: "repo:web", label: "web-client", node_type: "repo", framework: "React", stats: "18 components", active: false },
      ],
      modules: [],
      edges: [],
    });
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toMatchObject({ id: "repo:api", label: "api-server", active: true });
    expect(result.nodes[1]).toMatchObject({ id: "repo:web", label: "web-client", active: false });
  });

  it("converts edges to D3 links", () => {
    const result = buildRepoSimulation({
      repos: [
        { id: "repo:api", label: "api", node_type: "repo", framework: "", stats: "", active: false },
        { id: "repo:shared", label: "shared", node_type: "repo", framework: "", stats: "", active: false },
      ],
      modules: [],
      edges: [
        { source: "repo:api", target: "repo:shared", edge_type: "depends_on" },
      ],
    });
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toMatchObject({ source: "repo:api", target: "repo:shared" });
  });

  it("filters edges to only include repo-to-repo at repo level", () => {
    const result = buildRepoSimulation({
      repos: [
        { id: "repo:api", label: "api", node_type: "repo", framework: "", stats: "", active: false },
      ],
      modules: [
        { id: "module:auth", label: "auth", node_type: "module", framework: "", stats: "", active: false },
      ],
      edges: [
        { source: "repo:api", target: "module:auth", edge_type: "belongs_to" },
      ],
    });
    expect(result.links).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/architecture/ArchitectureDiagram.test.tsx`
Expected: FAIL — `buildRepoSimulation` not exported

- [ ] **Step 3: Implement the full ArchitectureDiagram with D3**

Replace `src/components/architecture/ArchitectureDiagram.tsx`:

```tsx
import { useState, useEffect, useCallback, useRef, memo } from "react";
import * as d3 from "d3";
import { RefreshCw } from "lucide-react";
import { ArchitectureBreadcrumb } from "./ArchitectureBreadcrumb";
import { IconButton } from "../shared/IconButton";
import { commands } from "../../lib/tauri";

// ── Types ──

interface TopologyNode {
  id: string;
  label: string;
  node_type: string;
  framework: string;
  stats: string;
  active: boolean;
}

interface TopologyEdge {
  source: string;
  target: string;
  edge_type: string;
}

interface TopologyData {
  repos: TopologyNode[];
  modules: TopologyNode[];
  edges: TopologyEdge[];
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  framework: string;
  stats: string;
  active: boolean;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string;
  target: string;
  edgeType: string;
}

// ── Data Transformation (exported for testing) ──

export function buildRepoSimulation(data: TopologyData): { nodes: D3Node[]; links: D3Link[] } {
  const repoIds = new Set(data.repos.map((r) => r.id));

  const nodes: D3Node[] = data.repos.map((r) => ({
    id: r.id,
    label: r.label,
    framework: r.framework,
    stats: r.stats,
    active: r.active,
  }));

  const links: D3Link[] = data.edges
    .filter((e) => repoIds.has(e.source) && repoIds.has(e.target))
    .map((e) => ({ source: e.source, target: e.target, edgeType: e.edge_type }));

  return { nodes, links };
}

// ── Colors ──

const NODE_COLORS = {
  active: "#5b7cfa",
  changed: "#34d399",
  idle: "#5a6080",
  border: "#232738",
};

// ── Component ──

export const ArchitectureDiagram = memo(function ArchitectureDiagram() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<"repo" | "module">("repo");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [topology, setTopology] = useState<TopologyData>({ repos: [], modules: [], edges: [] });
  const [loading, setLoading] = useState(false);

  const fetchTopology = useCallback(async () => {
    setLoading(true);
    try {
      const data = await commands.graphGetTopology();
      setTopology(data);
    } catch {
      // Silently handle — diagram shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopology();
  }, [fetchTopology]);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (topology.repos.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    svg.attr("width", width).attr("height", height);

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const { nodes, links } = buildRepoSimulation(topology);

    // Force simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(160))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(60));

    // Edges
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", NODE_COLORS.border)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", (d) => d.edgeType === "depends_on" ? "none" : "4,2");

    // Edge labels
    const linkLabel = g.append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("font-size", 7)
      .attr("fill", NODE_COLORS.idle)
      .attr("text-anchor", "middle")
      .text((d) => d.edgeType);

    // Node groups
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        setSelectedRepo(d.id);
        setZoomLevel("module");
      })
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on("start", (event, d: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d: any) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d: any) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      );

    // Node rectangles
    node.append("rect")
      .attr("x", -50)
      .attr("y", -22)
      .attr("width", 100)
      .attr("height", 44)
      .attr("rx", 6)
      .attr("fill", "#12141c")
      .attr("stroke", (d) => d.active ? NODE_COLORS.active : NODE_COLORS.idle)
      .attr("stroke-width", 1.5);

    // Node label
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -4)
      .attr("fill", (d) => d.active ? "#7d9bff" : "#b8bdd4")
      .attr("font-size", 10)
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-weight", "bold")
      .text((d) => d.label.length > 12 ? d.label.slice(0, 11) + "…" : d.label);

    // Node stats
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("y", 12)
      .attr("fill", NODE_COLORS.idle)
      .attr("font-size", 8)
      .text((d) => [d.framework, d.stats].filter(Boolean).join(" · ").slice(0, 20));

    // Active pulse
    node.filter((d) => d.active)
      .append("circle")
      .attr("cx", 45)
      .attr("cy", -18)
      .attr("r", 3)
      .attr("fill", NODE_COLORS.active)
      .append("animate")
      .attr("attributeName", "opacity")
      .attr("values", "1;0.3;1")
      .attr("dur", "2s")
      .attr("repeatCount", "indefinite");

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkLabel
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2 - 4);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [topology, zoomLevel]);

  const breadcrumbPath = zoomLevel === "repo"
    ? ["All Repos"]
    : ["All Repos", selectedRepo?.replace("repo:", "") ?? ""];

  const handleBreadcrumbNavigate = useCallback((depth: number) => {
    if (depth === 0) {
      setZoomLevel("repo");
      setSelectedRepo(null);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-v-bg">
      <div className="shrink-0 border-b border-v-border flex items-center justify-between">
        <ArchitectureBreadcrumb
          path={breadcrumbPath}
          onNavigate={handleBreadcrumbNavigate}
        />
        <div className="px-2">
          <IconButton
            icon={<RefreshCw size={10} className={loading ? "animate-spin" : ""} />}
            title="Refresh architecture"
            onClick={fetchTopology}
          />
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden">
        {topology.repos.length === 0 && !loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-v-dim text-xs">No repos indexed yet</p>
              <p className="text-v-dim text-[10px] mt-1">
                Index a repo from the Context Controls pane to see the architecture.
              </p>
            </div>
          </div>
        ) : (
          <svg ref={svgRef} className="w-full h-full" />
        )}
      </div>

      <div className="shrink-0 px-2 py-1 border-t border-v-border flex items-center gap-3 text-[8px] text-v-dim">
        <span><span className="text-v-accent">●</span> active session</span>
        <span><span className="text-v-green">●</span> changed</span>
        <span><span className="text-v-dim">●</span> idle</span>
      </div>
    </div>
  );
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/components/architecture/ArchitectureDiagram.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/architecture/ArchitectureDiagram.tsx src/components/architecture/ArchitectureDiagram.test.tsx
git commit -m "feat(arch): implement D3 repo topology rendering with force simulation"
```

---

## Task 9: Create EnhancedProjectCard

**Files:**
- Create: `src/components/home/EnhancedProjectCard.tsx`
- Create: `src/components/home/EnhancedProjectCard.test.tsx`
- Modify: `src/components/home/HomeScreen.tsx`

- [ ] **Step 1: Write test for EnhancedProjectCard rendering**

Create `src/components/home/EnhancedProjectCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EnhancedProjectCard } from "./EnhancedProjectCard";
import type { Project, ClaudeSessionState } from "../../stores/types";

const mockProject: Project = {
  id: "proj-1",
  name: "my-saas-app",
  workspacePath: "/tmp/test",
  claudeSessionId: "cs-1",
  summary: "A test project",
  createdAt: "2026-03-30T00:00:00Z",
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/components/home/EnhancedProjectCard.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create EnhancedProjectCard component**

Create `src/components/home/EnhancedProjectCard.tsx`:

```tsx
import { Plus } from "lucide-react";
import type { Project, ClaudeSessionState } from "../../stores/types";

interface EnhancedProjectCardProps {
  project: Project;
  sessions: Map<string, ClaudeSessionState>;
  onOpen: () => void;
  onOpenSession: (sessionId: string) => void;
}

const statusDotColor: Record<ClaudeSessionState["status"], string> = {
  working: "bg-v-green",
  "needs-input": "bg-v-orange",
  error: "bg-v-red",
  idle: "bg-v-dim",
};

export function EnhancedProjectCard({
  project,
  sessions,
  onOpen,
  onOpenSession,
}: EnhancedProjectCardProps) {
  const sessionList = Array.from(sessions.values());
  const activeCount = sessionList.filter((s) => s.status === "working" || s.status === "needs-input").length;
  const hasActive = activeCount > 0;

  return (
    <div
      className={`bg-v-surface border rounded-lg p-3.5 flex flex-col ${
        hasActive ? "border-v-accent" : "border-v-border"
      } hover:border-v-borderHi transition-colors`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-2.5">
        <button
          onClick={onOpen}
          className="text-xs font-semibold text-v-textHi hover:text-v-accentHi transition-colors text-left"
        >
          {project.name}
        </button>
        {hasActive ? (
          <span className="text-[8px] text-v-green bg-v-greenDim px-1.5 py-0.5 rounded">
            {activeCount} active
          </span>
        ) : (
          <span className="text-[8px] text-v-dim bg-v-surfaceHi px-1.5 py-0.5 rounded">
            idle
          </span>
        )}
      </div>

      {/* Summary */}
      <p className="text-[9px] text-v-dim mb-2.5 line-clamp-1">
        {project.summary || "No description"}
      </p>

      {/* Session list */}
      {sessionList.length > 0 && (
        <div className="border-t border-v-border pt-2 flex flex-col gap-1">
          {sessionList.slice(0, 4).map((session) => (
            <button
              key={session.id}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSession(session.id);
              }}
              className="flex items-center gap-1.5 px-1.5 py-1 bg-v-surfaceHi rounded hover:bg-v-borderHi/30 transition-colors text-left"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotColor[session.status]}`} />
              <span className="text-[9px] text-v-text truncate flex-1">
                {session.name}
              </span>
            </button>
          ))}
          {sessionList.length > 4 && (
            <span className="text-[8px] text-v-dim px-1.5">
              +{sessionList.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* New session link */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="mt-2 text-[8px] text-v-accent hover:text-v-accentHi flex items-center gap-1"
      >
        <Plus size={8} />
        New session
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/components/home/EnhancedProjectCard.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Wire EnhancedProjectCard into HomeScreen**

In `src/components/home/HomeScreen.tsx`, replace the `ProjectCard` import and usage:

Replace the import:
```tsx
import { ProjectCard } from "./ProjectCard";
```
with:
```tsx
import { EnhancedProjectCard } from "./EnhancedProjectCard";
```

Then replace each `<ProjectCard ... />` usage with `<EnhancedProjectCard />`, passing `sessions` (filtered from `claudeSessions` Map) and `onOpenSession` handler. The exact changes depend on the existing HomeScreen render — the key change is:

```tsx
// Before:
<ProjectCard
  project={project}
  session={claudeSessions.get(project.claudeSessionId)}
  onClick={() => openProject(project.id)}
/>

// After:
<EnhancedProjectCard
  project={project}
  sessions={new Map(
    Array.from(claudeSessions.entries()).filter(
      ([_, s]) => s.id === project.claudeSessionId || project.id === activeProjectId
    )
  )}
  onOpen={() => openProject(project.id)}
  onOpenSession={(sessionId) => {
    setActiveClaudeSessionId(sessionId);
    openProject(project.id);
  }}
/>
```

- [ ] **Step 6: Run all tests**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/home/EnhancedProjectCard.tsx src/components/home/EnhancedProjectCard.test.tsx src/components/home/HomeScreen.tsx
git commit -m "feat(home): add EnhancedProjectCard with session list and status badges"
```

---

## Task 10: Add Cost Display to Title Bar and Status Bar

**Files:**
- Modify: `src/components/layout/TitleBar.tsx`
- Modify: `src/components/layout/StatusBar.tsx`

- [ ] **Step 1: Read current TitleBar and StatusBar**

Read `src/components/layout/TitleBar.tsx` and `src/components/layout/StatusBar.tsx` to understand their current structure before modifying.

- [ ] **Step 2: Update TitleBar to show cost**

In `src/components/layout/TitleBar.tsx`, find the existing token display (likely showing something like `42k tokens`) and replace it with the cost-first format:

```tsx
// Find the existing token/context display and replace with:
<span className="text-[9px] text-v-dim">
  {composedPrompt
    ? `$${((composedPrompt.totalTokens / 1000) * 0.003).toFixed(2)} (${(composedPrompt.totalTokens / 1000).toFixed(1)}k tokens)`
    : ""}
</span>
```

Note: The cost calculation uses $0.003/1k tokens as a placeholder rate. This should be refined when real API cost data is available.

- [ ] **Step 3: Update StatusBar to show cost with elapsed time**

In `src/components/layout/StatusBar.tsx`, update the display format to include cost:

```tsx
// Replace existing token display with:
<span className="text-[8px] text-v-dim">
  {elapsed} · ${((totalTokens / 1000) * 0.003).toFixed(2)} ({(totalTokens / 1000).toFixed(1)}k tokens)
</span>
```

- [ ] **Step 4: Run the dev server to verify visual changes**

Run: `npm run dev`
Expected: Title bar and status bar show cost in the format `$X.XX (Xk tokens)`

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/TitleBar.tsx src/components/layout/StatusBar.tsx
git commit -m "feat(ui): show cost before token count in title bar and status bar"
```

---

## Task 11: Add Keyboard Shortcuts for Quadrant Focus

**Files:**
- Modify: `src/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1: Read current keyboard shortcuts**

Read `src/hooks/useKeyboardShortcuts.ts` to understand the existing pattern.

- [ ] **Step 2: Add Ctrl+1-4 quadrant focus and Escape to restore**

Add to the existing keyboard handler:

```typescript
// Quadrant focus shortcuts
if (e.ctrlKey && !e.shiftKey && !e.altKey) {
  const paneMap: Record<string, PaneId> = {
    "1": "top-left",
    "2": "top-right",
    "3": "bottom-left",
    "4": "bottom-right",
  };
  const pane = paneMap[e.key];
  if (pane) {
    e.preventDefault();
    const { maximizedPane, setMaximizedPane } = useAppStore.getState();
    setMaximizedPane(maximizedPane === pane ? null : pane);
    return;
  }
}

// Escape to restore maximized pane
if (e.key === "Escape") {
  const { maximizedPane, setMaximizedPane } = useAppStore.getState();
  if (maximizedPane) {
    e.preventDefault();
    setMaximizedPane(null);
    return;
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts
git commit -m "feat(shortcuts): add Ctrl+1-4 quadrant focus and Escape to restore"
```

---

## Task 12: Final Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm run test:all`
Expected: All frontend and Rust tests PASS

- [ ] **Step 2: Run TypeScript type check**

Run: `npm run build`
Expected: No type errors, build succeeds

- [ ] **Step 3: Manual verification checklist**

Run `npm run tauri dev` and verify:

1. Home screen shows EnhancedProjectCards with session list and status badges
2. Clicking a project enters the quadrant view
3. Four panes are visible: Chat (top-left), Architecture (top-right), Skills (bottom-left), Audit (bottom-right)
4. Drag handles resize panes horizontally and vertically
5. Tab strips in each pane switch content (e.g., Skills → Repos → Tokens → Files)
6. Pin and maximize buttons work on each pane
7. Ctrl+1-4 maximizes each quadrant, Escape restores
8. Ctrl+Shift+C still opens editor overlay on top
9. Architecture pane shows placeholder or repo nodes if indexed
10. Cost format shows in title bar and status bar

- [ ] **Step 4: Commit any fixes found during verification**

```bash
git add -u
git commit -m "fix: integration fixes from quadrant layout verification"
```
