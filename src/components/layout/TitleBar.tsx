import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Settings, ArrowLeft } from "lucide-react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "../shared/Badge";

const formatTokens = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

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
  } = useAppStore(
    useShallow((s) => ({
      repos: s.repos,
      skills: s.skills,
      composedPrompt: s.composedPrompt,
      currentView: s.currentView,
      goHome: s.goHome,
      activeProjectId: s.activeProjectId,
      projects: s.projects,
    })),
  );

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeRepoCount = repos.filter((r) => r.active).length;
  const activeSkillCount = skills.filter((s) => s.active).length;
  const totalTokens = composedPrompt?.totalTokens ?? 0;

  const isHome = currentView === "home";

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
          <Badge color="text-v-dim" bg="bg-v-surface">
            {formatTokens(totalTokens)} tokens
          </Badge>
        </div>
      )}

      {/* Right: Settings Gear + Window Controls */}
      <div className="flex items-center gap-1">
        {!isHome && (
          <button
            className="p-2 hover:bg-v-surfaceHi rounded transition-colors"
            title="Settings"
          >
            <Settings size={12} className="text-v-dim" />
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
