import { useRef, useEffect } from "react";
import {
  X,
  FolderGit2,
  BookOpen,
  Gauge,
  Folder,
  ScrollText,
  Activity,
} from "lucide-react";
import { TabStrip, type Tab } from "../layout/TabStrip";
import { RepoManager } from "../panels/RepoManager";
import { SkillsPanel } from "../panels/SkillsPanel";
import { TokenControlPanel } from "../panels/TokenControlPanel";
import { WorkspaceTree } from "../panels/WorkspaceTree";
import { AuditLog } from "../panels/AuditLog";
import { AgentStream } from "../panels/AgentStream";
import { useAppStore } from "../../stores";

const settingsTabs: Tab[] = [
  { id: "repos", label: "Repos", icon: <FolderGit2 size={10} /> },
  { id: "skills", label: "Skills", icon: <BookOpen size={10} /> },
  { id: "tokens", label: "Tokens", icon: <Gauge size={10} /> },
  { id: "files", label: "Files", icon: <Folder size={10} /> },
  { id: "audit", label: "Audit", icon: <ScrollText size={10} /> },
  { id: "events", label: "Events", icon: <Activity size={10} /> },
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
  const isOpen = useAppStore((s) => s.settingsPanelOpen);
  const activeTab = useAppStore((s) => s.settingsPanelTab);
  const setTab = useAppStore((s) => s.setSettingsPanelTab);
  const setOpen = useAppStore((s) => s.setSettingsPanelOpen);
  const close = () => setOpen(false);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={close} />
      )}
      <div
        className={`fixed top-10 bottom-0 right-0 z-50 bg-v-bg border-l border-v-border flex flex-col transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "400px" }}
      >
        <div className="flex items-center shrink-0 border-b border-v-border">
          <div className="flex-1 overflow-hidden">
            <TabStrip tabs={settingsTabs} activeId={activeTab} onChange={setTab} />
          </div>
          <button
            onClick={close}
            className="px-3 py-1.5 text-v-dim hover:text-v-text transition-colors"
            title="Close settings"
          >
            <X size={14} />
          </button>
        </div>
        {isOpen && (
          <div className="flex-1 overflow-hidden">
            {activeTab === "repos" && <RepoManager />}
            {activeTab === "skills" && <SkillsPanel />}
            {activeTab === "tokens" && <TokenControlPanel />}
            {activeTab === "files" && <FilesTabWrapper />}
            {activeTab === "audit" && <AuditLog />}
            {activeTab === "events" && <AgentStream />}
          </div>
        )}
      </div>
    </>
  );
}
