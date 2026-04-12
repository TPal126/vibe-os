import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PhaseCard } from "./PhaseCard";
import { ConnectionEditor } from "./ConnectionEditor";
import type { PipelinePhaseConfig } from "../../stores/types";

interface PipelineCanvasProps {
  phases: PipelinePhaseConfig[];
  selectedPhaseId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleGate: (id: string) => void;
}

export function PipelineCanvas({
  phases,
  selectedPhaseId,
  onSelect,
  onRemove,
  onReorder,
  onToggleGate,
}: PipelineCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  };

  if (phases.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-v-dim">Add phases from the palette to build your pipeline</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <p className="text-[11px] uppercase tracking-wider text-v-dim font-semibold mb-4">
        Pipeline
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={phases.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {phases.map((phase, index) => (
            <div key={phase.id}>
              <PhaseCard
                phase={phase}
                isSelected={selectedPhaseId === phase.id}
                onSelect={() => onSelect(phase.id)}
                onRemove={() => onRemove(phase.id)}
              />
              {index < phases.length - 1 && (
                <ConnectionEditor
                  gateAfter={phase.gateAfter}
                  onToggle={() => onToggleGate(phase.id)}
                />
              )}
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
