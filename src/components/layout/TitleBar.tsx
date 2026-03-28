import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { Badge } from "../shared/Badge";
import { Dot } from "../shared/Dot";

export function TitleBar() {
  const appWindow = getCurrentWindow();

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
      <div
        data-tauri-drag-region
        className="flex items-center gap-2"
      >
        <Badge color="text-v-green" bg="bg-v-green/15">
          <Dot color="bg-v-green" pulse />
          <span className="ml-1.5">Ready</span>
        </Badge>
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
