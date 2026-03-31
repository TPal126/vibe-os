import { useState } from "react";
import { AgentSaveDialog } from "./AgentSaveDialog";

interface AgentCaptureCardProps {
  agentName: string;
  description: string;
  tools: string[];
  systemPrompt: string;
  sessionId: string;
}

export function AgentCaptureCard({
  agentName,
  description,
  tools,
  systemPrompt,
  sessionId,
}: AgentCaptureCardProps) {
  const [showSave, setShowSave] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [saved, setSaved] = useState(false);

  if (dismissed || saved) {
    return saved ? (
      <div className="bg-v-surface border border-v-greenDim rounded-lg p-3 text-[11px] text-v-green">
        Agent "{agentName}" saved to ~/.vibe-os/agents/
      </div>
    ) : null;
  }

  return (
    <>
      <div className="bg-v-surface border border-v-borderHi rounded-lg p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-v-cyan" />
          <span className="text-xs text-v-cyan font-semibold">Agent spawned</span>
          <span className="text-[10px] text-v-dim">{agentName}</span>
        </div>
        <p className="text-xs text-v-text mb-2.5">{description}</p>
        <div className="flex gap-1 flex-wrap mb-3">
          {tools.map((tool) => (
            <span key={tool} className="text-[9px] px-1.5 py-0.5 rounded bg-v-cyan/10 text-v-cyan">
              {tool}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2.5 border-t border-v-border">
          <span className="text-[10px] text-v-dim">Save this agent for reuse?</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1 rounded-md text-[11px] text-v-dim border border-v-border hover:border-v-borderHi transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={() => setShowSave(true)}
              className="px-3 py-1 rounded-md text-[11px] text-white bg-v-accent hover:bg-v-accentHi transition-colors"
            >
              Save Agent
            </button>
          </div>
        </div>
      </div>

      {showSave && (
        <AgentSaveDialog
          initialName={agentName}
          initialDescription={description}
          initialSystemPrompt={systemPrompt}
          initialTools={tools}
          sessionId={sessionId}
          onSaved={() => { setShowSave(false); setSaved(true); }}
          onClose={() => setShowSave(false)}
        />
      )}
    </>
  );
}
