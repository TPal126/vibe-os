import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { PlayCircle, PauseCircle } from "lucide-react";
import type { ChatMessage } from "../../stores/types";

interface GatePromptCardProps {
  message: ChatMessage;
}

export function GatePromptCard({ message }: GatePromptCardProps) {
  const { activePipelineRun, advancePipelineGate } = useAppStore(
    useShallow((s) => ({
      activePipelineRun: s.activePipelineRun,
      advancePipelineGate: s.advancePipelineGate,
    })),
  );

  const data = message.cardData as { gate?: string; next_phase_id?: string } | undefined;
  const isAwaiting = data?.gate === "awaiting";
  const runId = activePipelineRun?.pipelineRunId;

  const handleContinue = () => {
    if (runId) {
      advancePipelineGate(runId);
    }
  };

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mx-2">
      <div className="flex items-center gap-2 mb-2">
        <PauseCircle size={16} className="text-amber-500" />
        <span className="text-xs font-medium text-amber-300">Gate</span>
      </div>
      <p className="text-xs text-v-text mb-3">{message.content}</p>
      {isAwaiting && (
        <button
          onClick={handleContinue}
          className="flex items-center gap-1.5 bg-v-accent text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-v-accentHi transition-colors"
        >
          <PlayCircle size={14} />
          Continue to next phase
        </button>
      )}
    </div>
  );
}
