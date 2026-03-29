import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "../shared/Badge";
import { Dot } from "../shared/Dot";

export function TitleBar() {
  const appWindow = getCurrentWindow();

  const { activeSession, repos, skills, composedPrompt } = useAppStore(
    useShallow((s) => ({
      activeSession: s.activeSession,
      repos: s.repos,
      skills: s.skills,
      composedPrompt: s.composedPrompt,
    })),
  );

  const activeRepoCount = repos.filter((r) => r.active).length;
  const activeSkillCount = skills.filter((s) => s.active).length;
  const totalTokens = composedPrompt?.totalTokens ?? 0;

  return (
    <div
      data-tauri-drag-region
      className="h-10 bg-v-bgAlt border-b border-v-border flex items-center justify-between px-3 select-none shrink-0"
    >
      {/* Left: Branding */}
      <div data-tauri-drag-region className="flex items-center gap-3">
        <span
          data-tauri-drag-region
          className="font-brand text-sm font-bold bg-gradient-to-r from-v-accent to-v-cyan bg-clip-text text-transparent"
        >
          VIBE OS
        </span>
        <span
          data-tauri-drag-region
          className="text-[10px] text-v-dim tracking-wide"
        >
          Agentic Development System
        </span>
      </div>

      {/* Center: Status */}
      <div data-tauri-drag-region className="flex items-center gap-2">
        {/* Session status badge */}
        {activeSession ? (
          <Badge color="text-v-green" bg="bg-v-green/15">
            <Dot color="bg-v-green" pulse />
            <span className="ml-1.5">Active</span>
          </Badge>
        ) : (
          <Badge color="text-v-dim" bg="bg-v-surface">
            <Dot color="bg-v-dim" />
            <span className="ml-1.5">No Session</span>
          </Badge>
        )}

        {/* Repo count */}
        <Badge color="text-v-accent" bg="bg-v-accent/10">
          {activeRepoCount} repo{activeRepoCount !== 1 ? "s" : ""}
        </Badge>

        {/* Skill count */}
        <Badge color="text-v-cyan" bg="bg-v-cyan/10">
          {activeSkillCount} skill{activeSkillCount !== 1 ? "s" : ""}
        </Badge>

        {/* Token count */}
        {totalTokens > 0 && (
          <Badge
            color={totalTokens > 20000 ? "text-v-red" : totalTokens > 15000 ? "text-v-orange" : "text-v-dim"}
            bg="bg-v-surface"
          >
            {totalTokens > 1000
              ? `${(totalTokens / 1000).toFixed(1)}k tokens`
              : `${totalTokens} tokens`}
          </Badge>
        )}
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
    </div>
  );
}
