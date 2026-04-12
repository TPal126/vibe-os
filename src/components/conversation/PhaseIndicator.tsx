import { useState } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { commands } from "../../lib/tauri";
import { CheckCircle, Circle, Loader, PauseCircle, Play } from "lucide-react";

export function PhaseIndicator() {
  const { activePipelineRun, activeProjectId, startPipelineRun } = useAppStore(
    useShallow((s) => ({
      activePipelineRun: s.activePipelineRun,
      activeProjectId: s.activeProjectId,
      startPipelineRun: s.startPipelineRun,
    })),
  );
  const [starting, setStarting] = useState(false);

  // When no active run, offer a "Run Pipeline" button if a project pipeline exists
  if (!activePipelineRun) {
    if (!activeProjectId) return null;

    const handleStart = async () => {
      setStarting(true);
      try {
        const pipeline = await commands.getProjectPipeline(activeProjectId);
        if (pipeline) {
          await startPipelineRun(pipeline.id);
        }
      } catch (err) {
        console.error("[vibe-os] Failed to start pipeline:", err);
      } finally {
        setStarting(false);
      }
    };

    return (
      <div className="flex items-center gap-2 px-4 py-1.5 bg-v-surface/50 border-b border-v-border">
        <span className="text-[10px] text-v-dim mr-1">Pipeline:</span>
        <button
          onClick={handleStart}
          disabled={starting}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-v-accent hover:text-v-accentHi bg-v-surface border border-v-accent/30 hover:border-v-accent transition-colors disabled:opacity-50"
        >
          {starting ? (
            <Loader size={10} className="animate-spin" />
          ) : (
            <Play size={10} />
          )}
          {starting ? "Starting..." : "Run Pipeline"}
        </button>
      </div>
    );
  }

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
