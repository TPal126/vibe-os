import {
  X,
  Code,
  Terminal,
  Eye,
  FileDiff,
  FileCode,
  Layers,
  Monitor,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { TabStrip, type Tab } from "./TabStrip";
import { CodeEditor } from "../center/CodeEditor";
import { Console } from "../center/Console";
import { LivePreview } from "../panels/LivePreview";
import { DiffView } from "../panels/DiffView";
import { ScriptsTracker } from "../panels/ScriptsTracker";
import { PromptLayer } from "../panels/PromptLayer";
import { SessionBrowser } from "../panels/SessionBrowser";
import { useAppStore } from "../../stores";

const drawerTabs: Tab[] = [
  { id: "editor", label: "Editor", icon: <Code size={10} /> },
  { id: "console", label: "Console", icon: <Terminal size={10} /> },
  { id: "preview", label: "Preview", icon: <Eye size={10} /> },
  { id: "diff", label: "Diff", icon: <FileDiff size={10} /> },
  { id: "scripts", label: "Scripts", icon: <FileCode size={10} /> },
  { id: "prompt", label: "Prompt", icon: <Layers size={10} /> },
  { id: "sessions", label: "Sessions", icon: <Monitor size={10} /> },
];

export function SecondaryDrawer() {
  const { isOpen, activeTab, setActiveTab, setOpen } = useAppStore(
    useShallow((s) => ({
      isOpen: s.drawerOpen,
      activeTab: s.activeDrawerTab,
      setActiveTab: s.setActiveDrawerTab,
      setOpen: s.setDrawerOpen,
    })),
  );

  const close = () => setOpen(false);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={close}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-v-bg border-t border-v-border flex flex-col transition-transform duration-200 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "60vh" }}
      >
        {/* Header */}
        <div className="flex items-center shrink-0 border-b border-v-border">
          <div className="flex-1 overflow-hidden">
            <TabStrip
              tabs={drawerTabs}
              activeId={activeTab}
              onChange={setActiveTab}
            />
          </div>
          <button
            onClick={close}
            className="px-3 py-1.5 text-v-dim hover:text-v-text transition-colors shrink-0"
            title="Close drawer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content area */}
        {isOpen && (
          <div className="flex-1 overflow-hidden">
            {/* Editor and Console use CSS display toggling to preserve state */}
            <div
              className="h-full"
              style={{ display: activeTab === "editor" ? "block" : "none" }}
            >
              <CodeEditor />
            </div>
            <div
              className="h-full"
              style={{ display: activeTab === "console" ? "block" : "none" }}
            >
              <Console />
            </div>

            {/* Other tabs use conditional rendering */}
            {activeTab === "preview" && <LivePreview />}
            {activeTab === "diff" && <DiffView />}
            {activeTab === "scripts" && <ScriptsTracker />}
            {activeTab === "prompt" && <PromptLayer />}
            {activeTab === "sessions" && <SessionBrowser />}
          </div>
        )}
      </div>
    </>
  );
}
