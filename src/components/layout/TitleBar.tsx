import { useState, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, FolderOpen, FolderPlus, Folder, AlertCircle } from "lucide-react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "../shared/Badge";
import { Dot } from "../shared/Dot";
import { CreateWorkspaceModal } from "../panels/CreateWorkspaceModal";

export function TitleBar() {
  const appWindow = getCurrentWindow();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    repos,
    skills,
    composedPrompt,
    activeWorkspace,
    openWorkspace,
    claudeSessions,
    tokenBudgets,
  } = useAppStore(
    useShallow((s) => ({
      repos: s.repos,
      skills: s.skills,
      composedPrompt: s.composedPrompt,
      activeWorkspace: s.activeWorkspace,
      openWorkspace: s.openWorkspace,
      claudeSessions: s.claudeSessions,
      tokenBudgets: s.tokenBudgets,
    })),
  );

  const activeRepoCount = repos.filter((r) => r.active).length;
  const activeSkillCount = skills.filter((s) => s.active).length;
  const totalTokens = composedPrompt?.totalTokens ?? 0;

  // Multi-session aggregation
  const sessionInfo = useMemo(() => {
    const sessions = Array.from(claudeSessions.values());
    const total = sessions.length;
    const working = sessions.filter((s) => s.isWorking).length;
    const needsInput = sessions.filter((s) => s.needsInput).length;
    const active = sessions.filter((s) => s.isWorking || s.conversationId).length;
    return { total, working, needsInput, active };
  }, [claudeSessions]);

  // Token budget: find session-level global budget for display
  const sessionBudget = useMemo(() => {
    return tokenBudgets.find(
      (b) => b.scopeType === "session" && b.scopeId === "global",
    );
  }, [tokenBudgets]);

  // Token budget display with color thresholds
  const tokenBudgetDisplay = useMemo(() => {
    if (!sessionBudget) return null;
    const used = totalTokens;
    const max = sessionBudget.maxTokens;
    const ratio = max > 0 ? used / max : 0;
    const warnThreshold = sessionBudget.warningThreshold;
    const warnRatio = warnThreshold > 0 ? warnThreshold / max : 0.75;

    let color: string;
    let bg: string;
    if (ratio >= 1) {
      color = "text-v-red";
      bg = "bg-v-red/15";
    } else if (ratio >= warnRatio) {
      color = "text-v-orange";
      bg = "bg-v-orange/15";
    } else {
      color = "text-v-dim";
      bg = "bg-v-surface";
    }

    const formatTokens = (n: number) =>
      n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

    return {
      label: `${formatTokens(used)} / ${formatTokens(max)} tokens`,
      color,
      bg,
    };
  }, [sessionBudget, totalTokens]);

  return (
    <div
      data-tauri-drag-region
      className="h-10 bg-v-bgAlt border-b border-v-border flex items-center justify-between px-3 select-none shrink-0"
    >
      {/* Left: Branding + Workspace Name */}
      <div data-tauri-drag-region className="flex items-center gap-3 min-w-0">
        <span
          data-tauri-drag-region
          className="font-brand text-sm font-bold bg-gradient-to-r from-v-accent to-v-cyan bg-clip-text text-transparent shrink-0"
        >
          VIBE OS
        </span>
        {activeWorkspace ? (
          <span
            data-tauri-drag-region
            className="text-[10px] text-v-dim tracking-wide max-w-[180px] truncate"
            title={activeWorkspace.path}
          >
            — {activeWorkspace.name}
          </span>
        ) : (
          <span
            data-tauri-drag-region
            className="text-[10px] text-v-dim tracking-wide"
          >
            Agentic Development System
          </span>
        )}
      </div>

      {/* Center: Status */}
      <div data-tauri-drag-region className="flex items-center gap-2">
        {/* Multi-session status badge */}
        {sessionInfo.total > 0 ? (
          <Badge
            color={sessionInfo.needsInput > 0 ? "text-v-orange" : "text-v-green"}
            bg={sessionInfo.needsInput > 0 ? "bg-v-orange/15" : "bg-v-green/15"}
          >
            <Dot
              color={sessionInfo.needsInput > 0 ? "bg-v-orange" : "bg-v-green"}
              pulse={sessionInfo.working > 0}
            />
            <span className="ml-1.5">
              {sessionInfo.active} Active
            </span>
            {sessionInfo.needsInput > 0 && (
              <AlertCircle size={9} className="ml-1 text-v-orange" />
            )}
          </Badge>
        ) : (
          <Badge color="text-v-dim" bg="bg-v-surface">
            <Dot color="bg-v-dim" />
            <span className="ml-1.5">No Session</span>
          </Badge>
        )}

        {/* Workspace badge/controls */}
        {activeWorkspace ? (
          <Badge color="text-v-accent" bg="bg-v-accent/10">
            <Folder size={10} className="mr-1" />
            {activeWorkspace.name}
          </Badge>
        ) : (
          <span className="text-[10px] text-v-dim">No workspace</span>
        )}

        <button
          onClick={() => setShowCreateModal(true)}
          className="p-1.5 hover:bg-v-surfaceHi rounded transition-colors"
          title="New Workspace"
        >
          <FolderPlus size={12} className="text-v-muted" />
        </button>
        <button
          onClick={() => openWorkspace()}
          className="p-1.5 hover:bg-v-surfaceHi rounded transition-colors"
          title="Open Workspace"
        >
          <FolderOpen size={12} className="text-v-muted" />
        </button>

        {/* Repo count */}
        <Badge color="text-v-accent" bg="bg-v-accent/10">
          {activeRepoCount} repo{activeRepoCount !== 1 ? "s" : ""}
        </Badge>

        {/* Skill count */}
        <Badge color="text-v-cyan" bg="bg-v-cyan/10">
          {activeSkillCount} skill{activeSkillCount !== 1 ? "s" : ""}
        </Badge>

        {/* Token budget display (if session budget set) */}
        {tokenBudgetDisplay ? (
          <Badge color={tokenBudgetDisplay.color} bg={tokenBudgetDisplay.bg}>
            {tokenBudgetDisplay.label}
          </Badge>
        ) : totalTokens > 0 ? (
          <Badge
            color={totalTokens > 20000 ? "text-v-red" : totalTokens > 15000 ? "text-v-orange" : "text-v-dim"}
            bg="bg-v-surface"
          >
            {totalTokens > 1000
              ? `${(totalTokens / 1000).toFixed(1)}k tokens`
              : `${totalTokens} tokens`}
          </Badge>
        ) : null}
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => appWindow.minimize()}
          className="p-2 hover:bg-v-surfaceHi rounded transition-colors"
        >
          <Minus size={12} className="text-v-dim" />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="p-2 hover:bg-v-surfaceHi rounded transition-colors"
        >
          <Square size={11} className="text-v-dim" />
        </button>
        <button
          onClick={() => appWindow.close()}
          className="p-2 hover:bg-v-red/20 rounded transition-colors group"
        >
          <X size={12} className="text-v-dim group-hover:text-v-red" />
        </button>
      </div>

      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
