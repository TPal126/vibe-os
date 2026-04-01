import { type ReactNode } from "react";
import {
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
  LayoutGrid,
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
  paneId: _paneId,
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
  { id: "resources", label: "Resources", icon: <LayoutGrid size={10} /> },
  { id: "tokens", label: "Tokens", icon: <Gauge size={10} /> },
  { id: "files", label: "Files", icon: <Folder size={10} /> },
];

export const bottomRightTabs: Tab[] = [
  { id: "audit", label: "Audit", icon: <ScrollText size={10} /> },
  { id: "decisions", label: "Decisions", icon: <MessageSquare size={10} /> },
  { id: "console", label: "Console", icon: <Activity size={10} /> },
  { id: "events", label: "Events", icon: <Activity size={10} /> },
];
