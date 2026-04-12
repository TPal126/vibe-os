import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import type { PipelinePhaseConfig } from "../../stores/types";

interface PhaseCardProps {
  phase: PipelinePhaseConfig;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export function PhaseCard({ phase, isSelected, onSelect, onRemove }: PhaseCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: phase.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`bg-v-surface border-2 rounded-lg p-3 cursor-pointer transition-colors ${
        isSelected ? "border-v-accent" : "border-v-border hover:border-v-accent/50"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button {...attributes} {...listeners} className="cursor-grab text-v-dim hover:text-v-text">
            <GripVertical size={14} />
          </button>
          <span className="text-sm font-semibold text-v-textHi">{phase.label}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-v-dim hover:text-v-red">
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <span className="text-[10px] bg-v-surfaceHi text-v-dim px-1.5 py-0.5 rounded">
          {phase.backend}
        </span>
        <span className="text-[10px] bg-v-surfaceHi text-v-dim px-1.5 py-0.5 rounded">
          {phase.framework}
        </span>
        <span className="text-[10px] bg-v-surfaceHi text-v-dim px-1.5 py-0.5 rounded">
          {phase.model}
        </span>
      </div>
    </div>
  );
}
