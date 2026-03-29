import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { Dot } from "../shared/Dot";
import { Folder } from "lucide-react";

export function StatusBar() {
  const {
    pythonRunning,
    activeSession,
    activeWorkspace,
    claudeSessions,
  } = useAppStore(
    useShallow((s) => ({
      pythonRunning: s.pythonRunning,
      activeSession: s.activeSession,
      activeWorkspace: s.activeWorkspace,
      claudeSessions: s.claudeSessions,
    })),
  );

  // Derive multi-session status
  const sessionStatus = useMemo(() => {
    const sessions = Array.from(claudeSessions.values());
    const total = sessions.length;
    const working = sessions.filter((s) => s.isWorking).length;
    const needsInput = sessions.filter((s) => s.needsInput).length;
    const errors = sessions.filter((s) => s.agentError !== null).length;

    let label: string;
    let color: string;
    let dotColor: string;

    if (total === 0) {
      label = "Claude: no sessions";
      color = "text-v-dim";
      dotColor = "bg-v-dim";
    } else if (errors > 0) {
      label = `${total} session${total !== 1 ? "s" : ""} (${errors} error)`;
      color = "text-v-red";
      dotColor = "bg-v-red";
    } else if (needsInput > 0) {
      label = `${total} session${total !== 1 ? "s" : ""} (${needsInput} needs input)`;
      color = "text-v-orange";
      dotColor = "bg-v-orange";
    } else if (working > 0) {
      label = `${total} session${total !== 1 ? "s" : ""} (${working} working)`;
      color = "text-v-accent";
      dotColor = "bg-v-accent";
    } else {
      label = `${total} session${total !== 1 ? "s" : ""} (all idle)`;
      color = "text-v-green";
      dotColor = "bg-v-green";
    }

    return { label, color, dotColor, pulse: working > 0 };
  }, [claudeSessions]);

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

  return (
    <div className="h-7 bg-v-bgAlt border-t border-v-border flex items-center px-3 gap-4 select-none shrink-0">
      {/* Workspace indicator */}
      <div
        className={`flex items-center gap-1.5 text-[10px] font-mono ${activeWorkspace ? "text-v-accent" : "text-v-dim"}`}
        title={activeWorkspace ? activeWorkspace.path : "No workspace open"}
      >
        <Folder size={10} className="shrink-0" />
        <span className="max-w-[140px] truncate">
          {activeWorkspace ? activeWorkspace.name : "No Workspace"}
        </span>
      </div>

      {/* Separator */}
      <span className="text-v-border">|</span>

      {/* Python status */}
      <div
        className={`flex items-center gap-1.5 text-[10px] font-mono ${pythonRunning ? "text-v-green" : "text-v-dim"}`}
      >
        <Dot color={pythonRunning ? "bg-v-green" : "bg-v-dim"} pulse={pythonRunning} />
        <span>{pythonRunning ? "Python: running" : "Python: idle"}</span>
      </div>

      {/* Claude multi-session status */}
      <div className={`flex items-center gap-1.5 text-[10px] font-mono ${sessionStatus.color}`}>
        <Dot color={sessionStatus.dotColor} pulse={sessionStatus.pulse} />
        <span>{sessionStatus.label}</span>
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
        v0.2.0
      </span>
    </div>
  );
}
