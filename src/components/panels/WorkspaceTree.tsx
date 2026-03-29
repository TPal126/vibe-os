import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  File as FileIcon,
  RefreshCw,
} from "lucide-react";
import { useAppStore } from "../../stores";
import type { FileTreeEntry } from "../../stores/types";
import { PanelHeader } from "../layout/PanelHeader";
import { commands } from "../../lib/tauri";

/* ── Helper: icon by file extension ──────────────────────────────── */

function getFileIcon(entry: FileTreeEntry) {
  const ext = entry.extension;
  switch (ext) {
    case "md":
      return <FileText size={14} className="text-v-muted" />;
    case "py":
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "rs":
      return <FileCode size={14} className="text-v-accent" />;
    case "json":
    case "toml":
    case "yaml":
    case "yml":
      return <FileCode size={14} className="text-v-cyan" />;
    default:
      return <FileIcon size={14} className="text-v-muted" />;
  }
}

/* ── TreeNode (recursive) ────────────────────────────────────────── */

function TreeNode({ entry, depth }: { entry: FileTreeEntry; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [children, setChildren] = useState<FileTreeEntry[] | null>(
    entry.children,
  );
  const openFile = useAppStore((s) => s.openFile);

  async function handleClick() {
    if (entry.is_dir) {
      const next = !expanded;
      setExpanded(next);
      // Lazy-load children if expanding and children is empty array
      if (next && Array.isArray(children) && children.length === 0) {
        try {
          const loaded = await commands.readWorkspaceTree(entry.path, 2);
          setChildren(loaded);
        } catch (err) {
          console.error("Failed to load children:", err);
        }
      }
    } else {
      openFile(entry.path);
    }
  }

  const isClaudeMd = entry.name === "CLAUDE.md";

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-1 py-[3px] text-[11px] font-mono hover:bg-v-surfaceHi transition-colors text-left"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {entry.is_dir ? (
          <>
            {expanded ? (
              <ChevronDown size={12} className="text-v-dim shrink-0" />
            ) : (
              <ChevronRight size={12} className="text-v-dim shrink-0" />
            )}
            {expanded ? (
              <FolderOpen size={14} className="text-v-accent shrink-0" />
            ) : (
              <Folder size={14} className="text-v-accent shrink-0" />
            )}
          </>
        ) : (
          <>
            {/* Spacer to align with dir chevrons */}
            <span className="w-3 shrink-0" />
            {getFileIcon(entry)}
          </>
        )}
        <span
          className={`truncate ${
            isClaudeMd ? "text-v-accent font-medium" : "text-v-text"
          }`}
        >
          {entry.name}
        </span>
      </button>

      {entry.is_dir && expanded && children && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode key={child.path} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

/* ── WorkspaceTree (exported) ────────────────────────────────────── */

export function WorkspaceTree() {
  const workspaceTree = useAppStore((s) => s.workspaceTree);
  const activeWorkspace = useAppStore((s) => s.activeWorkspace);
  const refreshWorkspaceTree = useAppStore((s) => s.refreshWorkspaceTree);

  // No workspace open
  if (!activeWorkspace) {
    return (
      <div className="flex flex-col h-full">
        <PanelHeader title="WORKSPACE" icon={<Folder size={12} />} />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-v-dim">
          <Folder size={24} className="opacity-40" />
          <span className="text-[11px]">No workspace open</span>
          <span className="text-[10px] opacity-60">
            Use the title bar to create or open one
          </span>
        </div>
      </div>
    );
  }

  // Loading state
  if (!workspaceTree) {
    return (
      <div className="flex flex-col h-full">
        <PanelHeader title="WORKSPACE" icon={<Folder size={12} />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[11px] text-v-dim">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        title="WORKSPACE"
        icon={<Folder size={12} />}
        actions={
          <button
            onClick={() => refreshWorkspaceTree()}
            className="p-1 hover:bg-v-surfaceHi rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw size={11} className="text-v-dim" />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto py-1">
        {workspaceTree.map((entry) => (
          <TreeNode key={entry.path} entry={entry} depth={0} />
        ))}
      </div>
    </div>
  );
}
