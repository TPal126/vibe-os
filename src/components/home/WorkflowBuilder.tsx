import { useEffect } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { PhasePalette } from "./PhasePalette";
import { PipelineCanvas } from "./PipelineCanvas";
import { PhaseConfigPanel } from "./PhaseConfigPanel";

export function WorkflowBuilder() {
  const {
    builderPhases,
    selectedPhaseId,
    frameworks,
    addPhase,
    removePhase,
    reorderPhases,
    updatePhase,
    selectPhase,
    toggleGate,
    loadFrameworks,
  } = useAppStore(
    useShallow((s) => ({
      builderPhases: s.builderPhases,
      selectedPhaseId: s.selectedPhaseId,
      frameworks: s.frameworks,
      addPhase: s.addPhase,
      removePhase: s.removePhase,
      reorderPhases: s.reorderPhases,
      updatePhase: s.updatePhase,
      selectPhase: s.selectPhase,
      toggleGate: s.toggleGate,
      loadFrameworks: s.loadFrameworks,
    })),
  );

  useEffect(() => {
    loadFrameworks();
  }, [loadFrameworks]);

  const selectedPhase = builderPhases.find((p) => p.id === selectedPhaseId) || null;

  return (
    <div className="flex h-full border border-v-border rounded-lg overflow-hidden bg-v-bg">
      <PhasePalette onAdd={addPhase} />
      <PipelineCanvas
        phases={builderPhases}
        selectedPhaseId={selectedPhaseId}
        onSelect={selectPhase}
        onRemove={removePhase}
        onReorder={reorderPhases}
        onToggleGate={toggleGate}
      />
      {selectedPhase && (
        <PhaseConfigPanel
          phase={selectedPhase}
          frameworks={frameworks}
          onUpdate={(updates) => updatePhase(selectedPhase.id, updates)}
        />
      )}
    </div>
  );
}
