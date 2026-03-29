import { useState, useEffect } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { Dot } from "../shared/Dot";

export function StatusBar() {
  const {
    pythonRunning,
    isWorking,
    agentError,
    activeSession,
  } = useAppStore(
    useShallow((s) => ({
      pythonRunning: s.pythonRunning,
      isWorking: s.isWorking,
      agentError: s.agentError,
      activeSession: s.activeSession,
    })),
  );

  // Live decision count -- filter agentEvents for "decision" type
  const decisionCount = useAppStore((s) =>
    s.agentEvents.filter((e) => e.event_type === "decision").length,
  );

  // Live action count -- total agentEvents length
  const actionCount = useAppStore((s) => s.agentEvents.length);

  // Session elapsed time with 1-second interval
  const [elapsed, setElapsed] = useState("0:00:00");

  useEffect(() => {
    if (!activeSession) {
      setElapsed("0:00:00");
      return;
    }

    const startTime = new Date(activeSession.startedAt).getTime();

    const tick = () => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    };

    tick(); // Initial
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Claude status derivation
  let claudeStatus: { label: string; color: string; dotColor: string };
  if (agentError) {
    claudeStatus = {
      label: "Claude: error",
      color: "text-v-red",
      dotColor: "bg-v-red",
    };
  } else if (isWorking) {
    claudeStatus = {
      label: "Claude: working",
      color: "text-v-accent",
      dotColor: "bg-v-accent",
    };
  } else {
    claudeStatus = {
      label: "Claude: idle",
      color: "text-v-dim",
      dotColor: "bg-v-dim",
    };
  }

  return (
    <div className="h-7 bg-v-bgAlt border-t border-v-border flex items-center px-3 gap-4 select-none shrink-0">
      {/* Python status */}
      <div
        className={`flex items-center gap-1.5 text-[10px] font-mono ${pythonRunning ? "text-v-green" : "text-v-dim"}`}
      >
        <Dot color={pythonRunning ? "bg-v-green" : "bg-v-dim"} pulse={pythonRunning} />
        <span>{pythonRunning ? "Python: running" : "Python: idle"}</span>
      </div>

      {/* Claude status */}
      <div className={`flex items-center gap-1.5 text-[10px] font-mono ${claudeStatus.color}`}>
        <Dot color={claudeStatus.dotColor} pulse={isWorking} />
        <span>{claudeStatus.label}</span>
      </div>

      {/* Separator */}
      <span className="text-v-border">|</span>

      {/* Session time */}
      <span className="text-[10px] font-mono text-v-dim">
        Session: {elapsed}
      </span>

      {/* Decisions */}
      <span className="text-[10px] font-mono text-v-dim">
        Decisions: {decisionCount}
      </span>

      {/* Actions */}
      <span className="text-[10px] font-mono text-v-dim">
        Actions: {actionCount}
      </span>

      {/* Spacer + Version */}
      <span className="flex-1" />
      <span className="text-[10px] font-mono text-v-dim">
        v0.1.0
      </span>
    </div>
  );
}
