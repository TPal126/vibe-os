import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { Dot } from "../shared/Dot";

export function StatusBar() {
  const pythonRunning = useAppStore(useShallow((s) => s.pythonRunning));

  return (
    <div className="h-7 bg-v-bgAlt border-t border-v-border flex items-center px-3 gap-4 select-none shrink-0">
      {/* Python status */}
      <div
        className={`flex items-center gap-1.5 text-[10px] font-mono ${pythonRunning ? "text-v-green" : "text-v-dim"}`}
      >
        <Dot color={pythonRunning ? "bg-v-green" : "bg-v-dim"} />
        <span>{pythonRunning ? "Python: running" : "Python: idle"}</span>
      </div>

      {/* Claude status */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-v-dim">
        <Dot color="bg-v-dim" />
        <span>Claude: disconnected</span>
      </div>

      {/* Separator */}
      <span className="text-v-border">|</span>

      {/* Session time */}
      <span className="text-[10px] font-mono text-v-dim">
        Session: 0:00:00
      </span>

      {/* Decisions */}
      <span className="text-[10px] font-mono text-v-dim">
        Decisions: 0
      </span>

      {/* Actions */}
      <span className="text-[10px] font-mono text-v-dim">
        Actions: 0
      </span>

      {/* Spacer + Version */}
      <span className="flex-1" />
      <span className="text-[10px] font-mono text-v-dim">
        v0.1.0
      </span>
    </div>
  );
}
