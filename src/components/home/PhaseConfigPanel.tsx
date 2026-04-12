import type { PipelinePhaseConfig, FrameworkManifest } from "../../stores/types";

const BACKEND_MODELS: Record<string, { id: string; name: string }[]> = {
  claude: [
    { id: "opus", name: "Opus" },
    { id: "sonnet", name: "Sonnet" },
    { id: "haiku", name: "Haiku" },
  ],
  codex: [
    { id: "o3", name: "o3" },
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "o4-mini", name: "o4-mini" },
  ],
};

interface PhaseConfigPanelProps {
  phase: PipelinePhaseConfig;
  frameworks: FrameworkManifest[];
  onUpdate: (updates: Partial<PipelinePhaseConfig>) => void;
}

export function PhaseConfigPanel({ phase, frameworks, onUpdate }: PhaseConfigPanelProps) {
  const compatibleFrameworks = frameworks.filter(
    (f) => f.supported_backends.includes(phase.backend) && f.supported_phases.includes(phase.phaseType),
  );
  const incompatibleFrameworks = frameworks.filter(
    (f) => !f.supported_backends.includes(phase.backend) || !f.supported_phases.includes(phase.phaseType),
  );
  const models = BACKEND_MODELS[phase.backend] || [];

  return (
    <div className="w-[220px] bg-v-surfaceHi border-l border-v-border p-4 overflow-y-auto">
      <p className="text-[11px] uppercase tracking-wider text-v-dim font-semibold mb-3">
        Phase Config
      </p>
      <p className="text-xs text-v-textHi font-medium mb-4">{phase.label}</p>

      {/* Backend */}
      <div className="mb-4">
        <p className="text-[11px] text-v-dim mb-1.5">Backend</p>
        <div className="flex gap-1">
          {["claude", "codex"].map((b) => (
            <button
              key={b}
              onClick={() => onUpdate({ backend: b as "claude" | "codex" })}
              className={`flex-1 text-center py-1.5 rounded text-xs capitalize transition-colors ${
                phase.backend === b
                  ? "bg-v-accent/20 text-v-accent border border-v-accent/30"
                  : "bg-v-surface text-v-dim hover:text-v-text border border-v-border"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Framework */}
      <div className="mb-4">
        <p className="text-[11px] text-v-dim mb-1.5">Framework</p>
        <div className="flex flex-col gap-1">
          {compatibleFrameworks.map((f) => (
            <button
              key={f.id}
              onClick={() => onUpdate({ framework: f.id })}
              className={`text-left px-2.5 py-1.5 rounded text-xs transition-colors ${
                phase.framework === f.id
                  ? "bg-v-accent/20 text-v-accent border border-v-accent/30"
                  : "bg-v-surface text-v-dim hover:text-v-text border border-v-border"
              }`}
            >
              {f.name}
            </button>
          ))}
          {incompatibleFrameworks.map((f) => (
            <button
              key={f.id}
              disabled
              className="text-left px-2.5 py-1.5 rounded text-xs bg-v-surface text-v-dim/40 border border-v-border/50 cursor-not-allowed"
              title={`Not available for ${phase.backend} / ${phase.phaseType}`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Model */}
      <div className="mb-4">
        <p className="text-[11px] text-v-dim mb-1.5">Model</p>
        <div className="flex flex-col gap-1">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => onUpdate({ model: m.id })}
              className={`text-left px-2.5 py-1.5 rounded text-xs transition-colors ${
                phase.model === m.id
                  ? "bg-v-accent/20 text-v-accent border border-v-accent/30"
                  : "bg-v-surface text-v-dim hover:text-v-text border border-v-border"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Custom prompt (when framework = custom) */}
      {phase.framework === "custom" && (
        <div className="mb-4">
          <p className="text-[11px] text-v-dim mb-1.5">Custom Prompt</p>
          <textarea
            value={phase.customPrompt || ""}
            onChange={(e) => onUpdate({ customPrompt: e.target.value })}
            rows={4}
            className="w-full bg-v-surface border border-v-border rounded px-2 py-1.5 text-xs text-v-textHi placeholder:text-v-dim outline-none focus:border-v-accent resize-none"
            placeholder="System prompt for this phase..."
          />
        </div>
      )}
    </div>
  );
}
