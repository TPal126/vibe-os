import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { CheckCircle, Circle, Loader, PauseCircle } from "lucide-react";

export function PhaseIndicator() {
  const activePipelineRun = useAppStore(useShallow((s) => s.activePipelineRun));

  if (!activePipelineRun) return null;

  const allPhases = [
    ...activePipelineRun.completedPhases.map((p) => ({ ...p, isCurrent: false })),
    ...(activePipelineRun.currentPhase
      ? [{ ...activePipelineRun.currentPhase, isCurrent: true, artifactPath: null, summary: null }]
      : []),
  ];

  if (allPhases.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 bg-v-surface/50 border-b border-v-border">
      <span className="text-[10px] text-v-dim mr-2">Pipeline:</span>
      {allPhases.map((phase, i) => {
        const isCompleted = phase.status === "completed";
        const isRunning = phase.status === "running";
        const isGated = phase.status === "awaiting_gate";

        return (
          <div key={phase.phaseId || i} className="flex items-center">
            {i > 0 && <div className="w-4 h-px bg-v-border mx-0.5" />}
            <div className="flex items-center gap-1" title={`${phase.label}: ${phase.status}`}>
              {isCompleted && <CheckCircle size={12} className="text-emerald-500" />}
              {isRunning && <Loader size={12} className="text-v-accent animate-spin" />}
              {isGated && <PauseCircle size={12} className="text-amber-500" />}
              {!isCompleted && !isRunning && !isGated && <Circle size={12} className="text-v-dim" />}
              <span className={`text-[10px] ${phase.isCurrent ? "text-v-textHi font-medium" : "text-v-dim"}`}>
                {phase.label}
              </span>
            </div>
          </div>
        );
      })}
      <span className="ml-auto text-[10px] text-v-dim">{activePipelineRun.status}</span>
    </div>
  );
}
