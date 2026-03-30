import { useRef, useEffect } from "react";
import {
  FolderGit2,
  BookOpen,
  Gauge,
  Folder,
  ScrollText,
  Activity,
  Share2,
} from "lucide-react";
import { TabStrip, type Tab } from "../layout/TabStrip";
import { RepoManager } from "../panels/RepoManager";
import { SkillsPanel } from "../panels/SkillsPanel";
import { TokenControlPanel } from "../panels/TokenControlPanel";
import { WorkspaceTree } from "../panels/WorkspaceTree";
import { AuditLog } from "../panels/AuditLog";
import { AgentStream } from "../panels/AgentStream";
import { KnowledgeGraph } from "../center/KnowledgeGraph";
import { useAppStore } from "../../stores";

const settingsTabs: Tab[] = [
  { id: "repos", label: "Repos", icon: <FolderGit2 size={10} /> },
  { id: "skills", label: "Skills", icon: <BookOpen size={10} /> },
  { id: "tokens", label: "Tokens", icon: <Gauge size={10} /> },
  { id: "files", label: "Files", icon: <Folder size={10} /> },
  { id: "audit", label: "Audit", icon: <ScrollText size={10} /> },
  { id: "events", label: "Events", icon: <Activity size={10} /> },
  { id: "graph", label: "Graph", icon: <Share2 size={10} /> },
];

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

export function SettingsPanel() {
  const activeTab = useAppStore((s) => s.settingsPanelTab);
  const setTab = useAppStore((s) => s.setSettingsPanelTab);

  return (
    <div className="w-[320px] shrink-0 border-l border-v-border bg-v-bg flex flex-col overflow-hidden">
      <div className="shrink-0 border-b border-v-border">
        <TabStrip tabs={settingsTabs} activeId={activeTab} onChange={setTab} />
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === "repos" && <RepoManager />}
        {activeTab === "skills" && <SkillsPanel />}
        {activeTab === "tokens" && <TokenControlPanel />}
        {activeTab === "files" && <FilesTabWrapper />}
        {activeTab === "audit" && <AuditLog />}
        {activeTab === "events" && <AgentStream />}
        {activeTab === "graph" && <KnowledgeGraph />}
      </div>
    </div>
  );
}
