import { useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  FolderGit2,
  BookOpen,
  Layers,
  Eye,
  Network,
  Code,
  Activity,
  Diamond,
  ScrollText,
  MessageSquare,
} from "lucide-react";
import { TabStrip, type Tab } from "./TabStrip";
import { PanelHeader } from "./PanelHeader";
import { PlaceholderPanel } from "../panels/PlaceholderPanel";
import { RepoManager } from "../panels/RepoManager";
import { SkillsPanel } from "../panels/SkillsPanel";
import { PromptLayer } from "../panels/PromptLayer";
import { CodeEditor } from "../center/CodeEditor";
import { Console } from "../center/Console";
import { ClaudeChat } from "../panels/ClaudeChat";

/* ── Tab definitions ──────────────────────────────────────────────── */

const leftTabs: Tab[] = [
  { id: "repos", label: "Repos", icon: <FolderGit2 size={10} /> },
  { id: "skills", label: "Skills", icon: <BookOpen size={10} /> },
  { id: "prompt", label: "Prompt Layer", icon: <Layers size={10} /> },
];

const centerTabs: Tab[] = [
  { id: "preview", label: "Preview", icon: <Eye size={10} /> },
  { id: "architecture", label: "Architecture", icon: <Network size={10} /> },
  { id: "editor", label: "Editor", icon: <Code size={10} /> },
];

const rightTabs: Tab[] = [
  { id: "agent-stream", label: "Agent Stream", icon: <Activity size={10} /> },
  { id: "decisions", label: "Decisions", icon: <Diamond size={10} /> },
  { id: "audit", label: "Audit Log", icon: <ScrollText size={10} /> },
];

/* ── Placeholder content per tab ──────────────────────────────────── */

const centerContent: Record<string, { title: string; description: string }> = {
  preview: { title: "Preview", description: "Live preview will appear here" },
  architecture: { title: "Architecture", description: "Architecture graph will appear here" },
  editor: { title: "Editor", description: "Code editor will appear here" },
};

const rightContent: Record<string, { title: string; description: string }> = {
  "agent-stream": { title: "Agent Stream", description: "Agent activity stream will appear here" },
  decisions: { title: "Decisions", description: "Decision log will appear here" },
  audit: { title: "Audit Log", description: "Audit trail will appear here" },
};

/* ── Separator helpers ────────────────────────────────────────────── */

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

/* ── MainLayout ───────────────────────────────────────────────────── */

export function MainLayout() {
  const [leftTab, setLeftTab] = useState("repos");
  const [centerTab, setCenterTab] = useState("editor");
  const [rightTab, setRightTab] = useState("agent-stream");

  return (
    <div className="flex-1 overflow-hidden">
      <Group orientation="horizontal" className="flex-1">
        {/* ── Left Column ─────────────────────────────────────── */}
        <Panel defaultSize={22} minSize={15}>
          <div className="flex flex-col h-full overflow-hidden">
            <Group orientation="vertical">
              {/* Top: Tabbed area */}
              <Panel defaultSize={55} minSize={30}>
                <div className="flex flex-col h-full overflow-hidden">
                  <TabStrip tabs={leftTabs} activeId={leftTab} onChange={setLeftTab} />
                  <div className="flex-1 overflow-hidden">
                    {leftTab === "repos" ? (
                      <RepoManager />
                    ) : leftTab === "skills" ? (
                      <SkillsPanel />
                    ) : leftTab === "prompt" ? (
                      <PromptLayer />
                    ) : null}
                  </div>
                </div>
              </Panel>

              <HorizontalSep />

              {/* Bottom: Claude Chat */}
              <Panel defaultSize={45} minSize={20}>
                <div className="flex flex-col h-full overflow-hidden">
                  <PanelHeader title="CLAUDE CHAT" icon={<MessageSquare size={12} />} />
                  <div className="flex-1 overflow-hidden">
                    <ClaudeChat />
                  </div>
                </div>
              </Panel>
            </Group>
          </div>
        </Panel>

        <VerticalSep />

        {/* ── Center Column ───────────────────────────────────── */}
        <Panel defaultSize={40} minSize={25}>
          <div className="flex flex-col h-full overflow-hidden">
            <Group orientation="vertical">
              {/* Top: Tabbed area */}
              <Panel defaultSize={60} minSize={30}>
                <div className="flex flex-col h-full overflow-hidden">
                  <TabStrip tabs={centerTabs} activeId={centerTab} onChange={setCenterTab} />
                  <div className="flex-1 overflow-hidden">
                    {centerTab === "editor" ? (
                      <CodeEditor />
                    ) : (
                      <PlaceholderPanel
                        title={centerContent[centerTab].title}
                        description={centerContent[centerTab].description}
                      />
                    )}
                  </div>
                </div>
              </Panel>

              <HorizontalSep />

              {/* Bottom: Console */}
              <Panel defaultSize={40} minSize={20}>
                <div className="flex flex-col h-full overflow-hidden">
                  <Console />
                </div>
              </Panel>
            </Group>
          </div>
        </Panel>

        <VerticalSep />

        {/* ── Right Column ────────────────────────────────────── */}
        <Panel defaultSize={38} minSize={20}>
          <div className="flex flex-col h-full overflow-hidden">
            <TabStrip tabs={rightTabs} activeId={rightTab} onChange={setRightTab} />
            <div className="flex-1 overflow-auto">
              <PlaceholderPanel
                title={rightContent[rightTab].title}
                description={rightContent[rightTab].description}
              />
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
