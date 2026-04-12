import { Plus } from "lucide-react";

const PHASE_PRESETS = [
  { type: "ideation", label: "Ideation" },
  { type: "planning", label: "Planning" },
  { type: "execution", label: "Execution" },
  { type: "verification", label: "Verification" },
  { type: "review", label: "Review" },
  { type: "custom", label: "Custom" },
];

interface PhasePaletteProps {
  onAdd: (phaseType: string, label: string) => void;
}

export function PhasePalette({ onAdd }: PhasePaletteProps) {
  return (
    <div className="w-[170px] bg-v-surfaceHi border-r border-v-border p-4">
      <p className="text-[11px] uppercase tracking-wider text-v-dim font-semibold mb-3">
        Phases
      </p>
      <div className="flex flex-col gap-2">
        {PHASE_PRESETS.map((preset) => (
          <button
            key={preset.type}
            onClick={() => onAdd(preset.type, preset.label)}
            className="flex items-center gap-2 bg-v-surface border border-dashed border-v-accent/40 rounded-md px-3 py-2 text-xs text-v-accent hover:bg-v-accent/10 transition-colors"
          >
            <Plus size={12} />
            {preset.label}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-v-dim mt-3">Click to add a phase</p>
    </div>
  );
}
