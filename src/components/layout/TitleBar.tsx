import { useState, useEffect, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, ArrowLeft, Bell, Terminal } from "lucide-react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "../shared/Badge";
import { getAttentionItems } from "../../lib/attention";
import { ThemeToggle } from "../shared/ThemeToggle";
import { commands, type CliInfo } from "../../lib/tauri";

const formatTokens = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

const formatCost = (tokens: number) =>
  `$${((tokens / 1000) * 0.003).toFixed(2)}`;

export function TitleBar() {
  const appWindow = getCurrentWindow();

  const {
    repos,
    skills,
    composedPrompt,
    currentView,
    goHome,
    activeProjectId,
    projects,
    claudeSessions,
    openProject,
    setActiveClaudeSessionId,
    openWorkspace,
  } = useAppStore(
    useShallow((s) => ({
      repos: s.repos,
      skills: s.skills,
      composedPrompt: s.composedPrompt,
      currentView: s.currentView,
      goHome: s.goHome,
      activeProjectId: s.activeProjectId,
      projects: s.projects,
      claudeSessions: s.claudeSessions,
      openProject: s.openProject,
      setActiveClaudeSessionId: s.setActiveClaudeSessionId,
      openWorkspace: s.openWorkspace,
    })),
  );

  // CLI detection — call once on mount and cache
  const [detectedClis, setDetectedClis] = useState<CliInfo[]>([]);
  useEffect(() => {
    commands.detectAvailableClis().then(setDetectedClis).catch(() => {});
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeRepoCount = repos.filter((r) => r.active).length;
  const activeSkillCount = skills.filter((s) => s.active).length;
  const totalTokens = composedPrompt?.totalTokens ?? 0;

  const isHome = currentView === "home";

  // Attention badge
  const attentionItems = getAttentionItems(projects, claudeSessions);
  const attentionCount = attentionItems.length;
  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    setCycleIndex(0);
  }, [attentionCount]);

  const handleAttentionClick = useCallback(() => {
    if (attentionItems.length === 0) return;
    const idx = cycleIndex % attentionItems.length;
    const item = attentionItems[idx];

    // Navigate to the flagged project
    openProject(item.projectId);
    setActiveClaudeSessionId(item.sessionId);

    // Load workspace in background
    const project = projects.find((p) => p.id === item.projectId);
    if (project) {
      openWorkspace(project.workspacePath).catch(() => {});
    }

    setCycleIndex(idx + 1);
  }, [attentionItems, cycleIndex, openProject, setActiveClaudeSessionId, projects, openWorkspace]);

  return (
    <div
      data-tauri-drag-region
      className="h-10 bg-v-bgAlt border-b border-v-border flex items-center justify-between px-3 select-none shrink-0"
    >
      {/* Left: Back + Branding + Project Name */}
      <div data-tauri-drag-region className="flex items-center gap-3 min-w-0">
        {!isHome && (
          <button
            onClick={goHome}
            className="p-1.5 hover:bg-v-surfaceHi rounded transition-colors"
            title="Back to projects"
          >
            <ArrowLeft size={14} className="text-v-dim" />
          </button>
        )}
        <span
          data-tauri-drag-region
          className="font-brand text-sm font-bold bg-gradient-to-r from-v-accent to-v-cyan bg-clip-text text-transparent shrink-0"
        >
          VIBE OS
        </span>
        {!isHome && activeProject && (
          <span className="text-[11px] text-v-text truncate max-w-[160px]">
            {activeProject.name}
          </span>
        )}
      </div>

      {/* Center: Context Badges (conversation mode only) */}
      {!isHome && (
        <div data-tauri-drag-region className="flex items-center gap-2">
          <Badge color="text-v-accent" bg="bg-v-accent/10">
            {activeRepoCount} repo{activeRepoCount !== 1 ? "s" : ""}
          </Badge>
          <span data-tauri-drag-region className="text-v-dim text-[10px]">
            ·
          </span>
          <Badge color="text-v-cyan" bg="bg-v-cyan/10">
            {activeSkillCount} skill{activeSkillCount !== 1 ? "s" : ""}
          </Badge>
          <span data-tauri-drag-region className="text-v-dim text-[10px]">
            ·
          </span>
          {detectedClis.length > 0 && (
            <>
              <Badge color="text-v-green" bg="bg-v-green/10">
                <span
                  title={detectedClis
                    .map((c) => `${c.name} (${c.version})`)
                    .join(", ")}
                  className="inline-flex items-center gap-1 cursor-default"
                >
                  <Terminal size={10} />
                  {detectedClis.length} CLI{detectedClis.length !== 1 ? "s" : ""}
                </span>
              </Badge>
              <span data-tauri-drag-region className="text-v-dim text-[10px]">
                ·
              </span>
            </>
          )}
          <Badge color="text-v-dim" bg="bg-v-surface">
            {totalTokens > 0
              ? `${formatCost(totalTokens)} (${formatTokens(totalTokens)} tokens)`
              : "—"}
          </Badge>
        </div>
      )}

      {/* Right: Attention Badge + Settings Gear + Window Controls */}
      <div className="flex items-center gap-1">
        <ThemeToggle />
        {attentionCount > 0 && (
          <button
            onClick={handleAttentionClick}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-v-orange/10 hover:bg-v-orange/20 transition-colors animate-pulse"
            title={`${attentionCount} project${attentionCount !== 1 ? "s" : ""} need${attentionCount === 1 ? "s" : ""} attention`}
          >
            <Bell size={12} className="text-v-orange" />
            <span className="text-[11px] font-medium text-v-orange">
              {attentionCount} need{attentionCount === 1 ? "s" : ""} you
            </span>
          </button>
        )}
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
    </div>
  );
}
