import { useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  FolderGit2,
  BookOpen,
  Gauge,
  Activity,
  Diamond,
  ScrollText,
  MessageSquare,
  ChevronUp,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { TabStrip, type Tab } from "./TabStrip";
import { PanelHeader } from "./PanelHeader";
import { SecondaryDrawer } from "./SecondaryDrawer";
import { RepoManager } from "../panels/RepoManager";
import { SkillsPanel } from "../panels/SkillsPanel";
import { WorkspaceTree } from "../panels/WorkspaceTree";
import { ClaudeChat } from "../panels/ClaudeChat";
import { AgentStream } from "../panels/AgentStream";
import { DecisionLog } from "../panels/DecisionLog";
import { AuditLog } from "../panels/AuditLog";
import { SessionDashboard } from "../panels/SessionDashboard";
import { MermaidDiagram } from "../panels/MermaidDiagram";
import { PlaceholderPanel } from "../panels/PlaceholderPanel";
import { useAppStore } from "../../stores";

/* -- Tab definitions ------------------------------------------------- */

const leftTabs: Tab[] = [
  { id: "repos", label: "Repos", icon: <FolderGit2 size={10} /> },
  { id: "skills", label: "Skills", icon: <BookOpen size={10} /> },
  { id: "token-control", label: "Token Control", icon: <Gauge size={10} /> },
];

const rightTabs: Tab[] = [
  { id: "decisions", label: "Decisions", icon: <Diamond size={10} /> },
  { id: "agent-stream", label: "Agent Stream", icon: <Activity size={10} /> },
  { id: "audit", label: "Audit Log", icon: <ScrollText size={10} /> },
];

/* -- Separator helpers ----------------------------------------------- */

function VerticalSep() {
  return (
    <Separator>
      <div className="w-[2px] h-full bg-v-border hover:bg-v-accent transition-colors" />
    </Separator>
  );
}

function HorizontalSep() {
  return (
    <Separator>
      <div className="h-[2px] w-full bg-v-border hover:bg-v-accent transition-colors" />
    </Separator>
  );
}

/* -- MainLayout ------------------------------------------------------ */

export function MainLayout() {
  const [leftTab, setLeftTab] = useState("repos");
  const [rightTab, setRightTab] = useState("decisions");

  const { drawerOpen, toggleDrawer } = useAppStore(
    useShallow((s) => ({
      drawerOpen: s.drawerOpen,
      toggleDrawer: s.toggleDrawer,
    })),
  );

  return (
    <div className="flex-1 overflow-hidden relative">
      <Group orientation="horizontal" className="flex-1">
        {/* -- Left Column ------------------------------------------- */}
        <Panel defaultSize={20} minSize={15}>
          <div className="flex flex-col h-full overflow-hidden">
            <Group orientation="vertical">
              {/* Top: Tabbed area (Repos, Skills, Token Control) */}
              <Panel defaultSize={55} minSize={25}>
                <div className="flex flex-col h-full overflow-hidden">
                  <TabStrip
                    tabs={leftTabs}
                    activeId={leftTab}
                    onChange={setLeftTab}
                  />
                  <div className="flex-1 overflow-hidden">
                    {leftTab === "repos" ? (
                      <RepoManager />
                    ) : leftTab === "skills" ? (
                      <SkillsPanel />
                    ) : leftTab === "token-control" ? (
                      <PlaceholderPanel
                        title="Token Control"
                        icon={<Gauge size={24} />}
                        description="Coming in Phase 10"
                      />
                    ) : null}
                  </div>
                </div>
              </Panel>

              <HorizontalSep />

              {/* Bottom: Workspace Files */}
              <Panel defaultSize={45} minSize={20}>
                <div className="flex flex-col h-full overflow-hidden">
                  <PanelHeader title="WORKSPACE FILES" />
                  <div className="flex-1 overflow-hidden">
                    <WorkspaceTree />
                  </div>
                </div>
              </Panel>
            </Group>
          </div>
        </Panel>

        <VerticalSep />

        {/* -- Center Column ----------------------------------------- */}
        <Panel defaultSize={45} minSize={25}>
          <div className="flex flex-col h-full overflow-hidden">
            <Group orientation="vertical">
              {/* Top: Claude Chat */}
              <Panel defaultSize={65} minSize={35}>
                <div className="flex flex-col h-full overflow-hidden">
                  <PanelHeader
                    title="CLAUDE CHAT"
                    icon={<MessageSquare size={12} />}
                    actions={
                      <button
                        onClick={toggleDrawer}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${
                          drawerOpen
                            ? "text-v-accent bg-v-accent/10"
                            : "text-v-dim hover:text-v-text hover:bg-v-surface"
                        }`}
                        title="Toggle secondary panels (Editor, Console, Preview, Diff)"
                      >
                        <ChevronUp size={10} />
                        Panels
                      </button>
                    }
                  />
                  <div className="flex-1 overflow-hidden">
                    <ClaudeChat />
                  </div>
                </div>
              </Panel>

              <HorizontalSep />

              {/* Bottom: Session Dashboard */}
              <Panel defaultSize={35} minSize={15}>
                <SessionDashboard />
              </Panel>
            </Group>
          </div>
        </Panel>

        <VerticalSep />

        {/* -- Right Column ------------------------------------------ */}
        <Panel defaultSize={35} minSize={20}>
          <div className="flex flex-col h-full overflow-hidden">
            <Group orientation="vertical">
              {/* Top: Tabbed area (Decisions, Agent Stream, Audit) */}
              <Panel defaultSize={60} minSize={30}>
                <div className="flex flex-col h-full overflow-hidden">
                  <TabStrip
                    tabs={rightTabs}
                    activeId={rightTab}
                    onChange={setRightTab}
                  />
                  <div className="flex-1 overflow-hidden">
                    {rightTab === "decisions" ? (
                      <DecisionLog />
                    ) : rightTab === "agent-stream" ? (
                      <AgentStream />
                    ) : rightTab === "audit" ? (
                      <AuditLog />
                    ) : null}
                  </div>
                </div>
              </Panel>

              <HorizontalSep />

              {/* Bottom: Mermaid Architecture Diagram */}
              <Panel defaultSize={40} minSize={20}>
                <MermaidDiagram />
              </Panel>
            </Group>
          </div>
        </Panel>
      </Group>

      {/* Secondary drawer overlay */}
      <SecondaryDrawer />
    </div>
  );
}
