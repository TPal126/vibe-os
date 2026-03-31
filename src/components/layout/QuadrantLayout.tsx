import { useRef, useEffect } from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { useAppStore } from "../../stores";
import { ClaudeChat } from "../panels/ClaudeChat";
import { ResourcesTab } from "../panels/ResourcesTab";
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
  if (tab === "resources") return <ResourcesTab />;
  if (tab === "tokens") return <TokenControlPanel />;
  if (tab === "files") return <FilesTabWrapper />;
  return <ResourcesTab />;
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
    <PanelGroup orientation="vertical">
      {/* Top row */}
      <Panel defaultSize={60} minSize={30}>
        <PanelGroup orientation="horizontal">
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
        <PanelGroup orientation="horizontal">
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
