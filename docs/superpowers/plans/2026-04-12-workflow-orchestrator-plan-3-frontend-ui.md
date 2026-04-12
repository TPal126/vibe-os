# Workflow Orchestrator — Plan 3: Frontend UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the workflow builder UI (three-panel drag-and-drop pipeline editor) into the project setup flow, add conversation view components for pipeline execution (phase indicator, gate prompts, interaction cards), and wire pipeline creation into the project creation flow.

**Architecture:** The workflow builder is a new step in `ProjectSetupView`. It uses `@dnd-kit` for drag-and-drop. Pipeline data flows through the existing Tauri IPC commands (Plan 2). Conversation cards for phase transitions and gates follow the existing `cardType` switch pattern in `ClaudeChat.tsx`.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS 4, @dnd-kit/core + @dnd-kit/sortable, lucide-react

**Spec:** `docs/superpowers/specs/2026-04-12-multi-backend-workflow-orchestrator-design.md` (Section 3)

**Sequencing:** This is Plan 3 of 3. Depends on Plan 1 (foundation) and Plan 2 (adapters + engine).

**Current project setup flow:** `ProjectSetupView.tsx` collects project name, description, linked repos/skills/agents in a two-column layout (config left, resource catalog right). On "Create Project" it creates a workspace, session, and project. The workflow builder slots in as a second step between resource selection and project creation.

---

## File Map

### New files
- `src/components/home/WorkflowBuilder.tsx` — Three-panel builder container (palette + canvas + config)
- `src/components/home/PhasePalette.tsx` — Draggable phase preset cards
- `src/components/home/PipelineCanvas.tsx` — Drop target, vertical phase list with connection editors
- `src/components/home/PhaseCard.tsx` — Individual phase card showing backend/framework/model tags
- `src/components/home/ConnectionEditor.tsx` — Gate toggle between phases (amber/green dot)
- `src/components/home/PhaseConfigPanel.tsx` — Three-level cascading Backend → Framework → Model picker
- `src/components/conversation/PhaseIndicator.tsx` — Pipeline progress bar in conversation header
- `src/components/conversation/GatePromptCard.tsx` — "Phase complete, continue?" card in chat
- `src/components/conversation/InteractionCard.tsx` — Framework question card with inline answer input
- `src/stores/slices/pipelineSlice.ts` — Zustand slice for pipeline builder state + active run tracking

### Modified files
- `src/components/home/ProjectSetupView.tsx` — Add workflow builder step after resource selection
- `src/components/panels/ClaudeChat.tsx` — Add PhaseIndicator, wire new card types
- `src/stores/types.ts` — Add PipelineSlice types, new CardType values
- `src/stores/index.ts` — Compose pipelineSlice into the store
- `package.json` — Add `@dnd-kit/core` and `@dnd-kit/sortable`

---

## Milestone A: Dependencies + Pipeline State

### Task 1: Install @dnd-kit and add pipeline types

**Files:**
- Modify: `package.json`
- Modify: `src/stores/types.ts`

- [ ] **Step 1: Install @dnd-kit**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Add pipeline builder types to types.ts**

In `src/stores/types.ts`, add these types after the existing `AgentDefinitionSlice` section:

```typescript
// ── Pipeline Builder Types ──

export interface PipelinePhaseConfig {
  id: string;
  label: string;
  phaseType: string;  // ideation|planning|execution|verification|review|custom
  backend: "claude" | "codex";
  framework: string;  // superpowers|gsd|native|custom
  model: string;
  customPrompt: string | null;
  gateAfter: "gated" | "auto";
}

export interface PipelineRunState {
  pipelineRunId: string;
  status: string;
  currentPhase: {
    phaseRunId: string;
    phaseId: string;
    label: string;
    status: string;
  } | null;
  completedPhases: {
    phaseRunId: string;
    phaseId: string;
    label: string;
    status: string;
    artifactPath: string | null;
    summary: string | null;
  }[];
}

export interface FrameworkManifest {
  id: string;
  name: string;
  supported_backends: string[];
  supported_phases: string[];
  features: { visual_companion: boolean; interactive_questions: boolean };
  phase_skills: Record<string, string>;
}

export interface PipelineSlice {
  // Builder state
  builderPhases: PipelinePhaseConfig[];
  selectedPhaseId: string | null;
  frameworks: FrameworkManifest[];

  // Builder actions
  addPhase: (phaseType: string, label: string) => void;
  removePhase: (id: string) => void;
  reorderPhases: (fromIndex: number, toIndex: number) => void;
  updatePhase: (id: string, updates: Partial<PipelinePhaseConfig>) => void;
  selectPhase: (id: string | null) => void;
  toggleGate: (id: string) => void;
  resetBuilder: () => void;
  loadFrameworks: () => Promise<void>;

  // Pipeline hydration (for reopening existing projects)
  loadProjectPipeline: (projectId: string) => Promise<void>;

  // Active run tracking
  activePipelineRun: PipelineRunState | null;
  startPipelineRun: (pipelineId: string) => Promise<void>;
  advancePipelineGate: (pipelineRunId: string) => Promise<void>;
  refreshPipelineRun: (pipelineRunId: string) => Promise<void>;
  clearPipelineRun: () => void;
}
```

- [ ] **Step 3: Add new CardType values**

In `src/stores/types.ts`, update the `CardType` union:

```typescript
export type CardType = "activity" | "outcome" | "error" | "decision" | "preview" | "test-detail" | "task-progress" | "gate-prompt" | "interaction";
```

- [ ] **Step 4: Add PipelineSlice to AppState**

Update the `AppState` type to include `PipelineSlice`:

```typescript
export type AppState = SessionSlice &
  RepoSlice &
  // ... existing slices ...
  AgentDefinitionSlice &
  PipelineSlice;
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/stores/types.ts
git commit -m "feat: install @dnd-kit, add pipeline builder types and PipelineSlice interface"
```

### Task 2: Create pipelineSlice

**Files:**
- Create: `src/stores/slices/pipelineSlice.ts`
- Modify: `src/stores/index.ts`

- [ ] **Step 1: Create pipelineSlice.ts**

Create `src/stores/slices/pipelineSlice.ts`:

```typescript
import type { SliceCreator, PipelineSlice, PipelinePhaseConfig } from "../types";
import { commands } from "../../lib/tauri";

const DEFAULT_MODELS: Record<string, string> = {
  claude: "sonnet",
  codex: "gpt-4.1",
};

export const createPipelineSlice: SliceCreator<PipelineSlice> = (set, get) => ({
  // Builder state
  builderPhases: [],
  selectedPhaseId: null,
  frameworks: [],

  addPhase: (phaseType, label) => {
    const phase: PipelinePhaseConfig = {
      id: crypto.randomUUID(),
      label,
      phaseType,
      backend: "claude",
      framework: "native",
      model: "sonnet",
      customPrompt: null,
      gateAfter: "gated",
    };
    set((state) => ({
      builderPhases: [...state.builderPhases, phase],
      selectedPhaseId: phase.id,
    }));
  },

  removePhase: (id) =>
    set((state) => ({
      builderPhases: state.builderPhases.filter((p) => p.id !== id),
      selectedPhaseId: state.selectedPhaseId === id ? null : state.selectedPhaseId,
    })),

  reorderPhases: (fromIndex, toIndex) =>
    set((state) => {
      const phases = [...state.builderPhases];
      const [moved] = phases.splice(fromIndex, 1);
      phases.splice(toIndex, 0, moved);
      return { builderPhases: phases };
    }),

  updatePhase: (id, updates) =>
    set((state) => ({
      builderPhases: state.builderPhases.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, ...updates };
        // When backend changes, reset framework and model to compatible defaults
        if (updates.backend && updates.backend !== p.backend) {
          updated.framework = "native";
          updated.model = DEFAULT_MODELS[updates.backend] || "sonnet";
        }
        return updated;
      }),
    })),

  selectPhase: (id) => set({ selectedPhaseId: id }),

  toggleGate: (id) =>
    set((state) => ({
      builderPhases: state.builderPhases.map((p) =>
        p.id === id ? { ...p, gateAfter: p.gateAfter === "gated" ? "auto" : "gated" } : p,
      ),
    })),

  resetBuilder: () => set({ builderPhases: [], selectedPhaseId: null }),

  loadFrameworks: async () => {
    try {
      const frameworks = await commands.listFrameworks();
      set({ frameworks });
    } catch (err) {
      console.warn("[vibe-os] Failed to load frameworks:", err);
    }
  },

  // Active run tracking
  activePipelineRun: null,

  startPipelineRun: async (pipelineId) => {
    try {
      const runId = await commands.startPipeline(pipelineId);
      const status = await commands.getPipelineRunStatus(runId);
      set({
        activePipelineRun: {
          pipelineRunId: status.pipeline_run_id,
          status: status.status,
          currentPhase: status.current_phase ? {
            phaseRunId: status.current_phase.phase_run_id,
            phaseId: status.current_phase.phase_id,
            label: status.current_phase.label,
            status: status.current_phase.status,
          } : null,
          completedPhases: status.completed_phases.map((p) => ({
            phaseRunId: p.phase_run_id,
            phaseId: p.phase_id,
            label: p.label,
            status: p.status,
            artifactPath: p.artifact_path,
            summary: p.summary,
          })),
        },
      });
    } catch (err) {
      console.error("[vibe-os] Failed to start pipeline:", err);
    }
  },

  advancePipelineGate: async (pipelineRunId) => {
    try {
      await commands.advanceGate(pipelineRunId);
      get().refreshPipelineRun(pipelineRunId);
    } catch (err) {
      console.error("[vibe-os] Failed to advance gate:", err);
    }
  },

  refreshPipelineRun: async (pipelineRunId) => {
    try {
      const status = await commands.getPipelineRunStatus(pipelineRunId);
      set({
        activePipelineRun: {
          pipelineRunId: status.pipeline_run_id,
          status: status.status,
          currentPhase: status.current_phase ? {
            phaseRunId: status.current_phase.phase_run_id,
            phaseId: status.current_phase.phase_id,
            label: status.current_phase.label,
            status: status.current_phase.status,
          } : null,
          completedPhases: status.completed_phases.map((p) => ({
            phaseRunId: p.phase_run_id,
            phaseId: p.phase_id,
            label: p.label,
            status: p.status,
            artifactPath: p.artifact_path,
            summary: p.summary,
          })),
        },
      });
    } catch (err) {
      console.error("[vibe-os] Failed to refresh pipeline run:", err);
    }
  },

  clearPipelineRun: () => set({ activePipelineRun: null }),

  // Pipeline hydration — loads existing pipeline for a project into builder state
  loadProjectPipeline: async (projectId) => {
    try {
      const pipeline = await commands.getProjectPipeline(projectId);
      if (!pipeline) {
        set({ builderPhases: [], selectedPhaseId: null });
        return;
      }
      const phases = await commands.getPipelinePhases(pipeline.id);
      const builderPhases: PipelinePhaseConfig[] = phases.map((p) => ({
        id: p.id,
        label: p.label,
        phaseType: p.phase_type,
        backend: p.backend as "claude" | "codex",
        framework: p.framework,
        model: p.model,
        customPrompt: p.custom_prompt,
        gateAfter: p.gate_after as "gated" | "auto",
      }));
      set({ builderPhases, selectedPhaseId: null });
    } catch (err) {
      console.warn("[vibe-os] Failed to load project pipeline:", err);
    }
  },
});
```

- [ ] **Step 2: Compose into store**

In `src/stores/index.ts`, import and compose the new slice. Read the file first to follow the existing pattern. Add:

```typescript
import { createPipelineSlice } from "./slices/pipelineSlice";
```

And add `...createPipelineSlice(...a),` in the store creation.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/stores/slices/pipelineSlice.ts src/stores/index.ts
git commit -m "feat: add pipelineSlice with builder state and run tracking"
```

---

## Milestone B: Workflow Builder Components

### Task 3: PhaseCard component

**Files:**
- Create: `src/components/home/PhaseCard.tsx`

A phase card shows the phase label and backend/framework/model as small tags. It's both a draggable item (in the canvas) and a click target (selects the phase for config).

- [ ] **Step 1: Create PhaseCard.tsx**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/PhaseCard.tsx
git commit -m "feat: add PhaseCard component for pipeline builder"
```

### Task 4: ConnectionEditor component

**Files:**
- Create: `src/components/home/ConnectionEditor.tsx`

The connection between two phases shows as a vertical line with a colored dot. Clicking toggles gate behavior.

- [ ] **Step 1: Create ConnectionEditor.tsx**

```typescript
interface ConnectionEditorProps {
  gateAfter: "gated" | "auto";
  onToggle: () => void;
}

export function ConnectionEditor({ gateAfter, onToggle }: ConnectionEditorProps) {
  const isGated = gateAfter === "gated";

  return (
    <div className="flex items-center ml-6 my-1 cursor-pointer group" onClick={onToggle}>
      <div className="w-0.5 h-5 bg-v-accent/40" />
      <div className="ml-3 flex items-center gap-1.5">
        <div
          className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${
            isGated
              ? "bg-amber-500 border-amber-700"
              : "bg-emerald-500 border-emerald-700"
          }`}
        />
        <span className="text-[10px] text-v-dim group-hover:text-v-text transition-colors">
          {isGated ? "Gated" : "Auto"}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/ConnectionEditor.tsx
git commit -m "feat: add ConnectionEditor for gate toggle between phases"
```

### Task 5: PhaseConfigPanel component

**Files:**
- Create: `src/components/home/PhaseConfigPanel.tsx`

Three-level cascading selection: Backend → Framework (filtered by backend compatibility) → Model (filtered by backend). Loads framework manifests to drive compatibility filtering.

- [ ] **Step 1: Create PhaseConfigPanel.tsx**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/PhaseConfigPanel.tsx
git commit -m "feat: add PhaseConfigPanel with Backend/Framework/Model cascade"
```

### Task 6: PhasePalette + PipelineCanvas + WorkflowBuilder

**Files:**
- Create: `src/components/home/PhasePalette.tsx`
- Create: `src/components/home/PipelineCanvas.tsx`
- Create: `src/components/home/WorkflowBuilder.tsx`

- [ ] **Step 1: Create PhasePalette.tsx**

The palette is a list of phase presets the user can click to add to the canvas.

```typescript
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
```

- [ ] **Step 2: Create PipelineCanvas.tsx**

The canvas renders the vertical list of phases with connections between them, using `@dnd-kit/sortable` for reordering.

```typescript
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
```

- [ ] **Step 3: Create WorkflowBuilder.tsx**

The main container that composes all three panels:

```typescript
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
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/components/home/PhasePalette.tsx src/components/home/PipelineCanvas.tsx src/components/home/WorkflowBuilder.tsx
git commit -m "feat: add WorkflowBuilder with PhasePalette, PipelineCanvas, and three-panel layout"
```

---

## Milestone C: Integrate Builder Into Project Setup

### Task 7: Restructure ProjectSetupView with two-step flow + pipeline creation

**Files:**
- Modify: `src/components/home/ProjectSetupView.tsx`
- Modify: `src/stores/slices/projectSlice.ts`

**Key design decisions addressing review findings:**
- **Finding 1 (race condition):** `addProject` is fire-and-forget. Instead of relying on it, ProjectSetupView calls `commands.createProject()` directly to get the project ID, then calls `commands.createPipeline()` with that ID. The projectSlice's `addProject` is no longer used for the creation path — the setup view does the full sequence synchronously.
- **Finding 3 (layout/UX):** Step 1 is the existing name/description/resources layout. Step 2 is **full-width** workflow builder (hides the resource catalog sidebar). Enter key on step 1 advances to step 2, not create. "Back" returns to step 1 preserving all state. "Create Project" only appears on step 2.

- [ ] **Step 1: Add step state and restructure layout**

Read the current `ProjectSetupView.tsx` fully. Add:
- `const [step, setStep] = useState<1 | 2>(1);`
- Disable the `onKeyDown` Enter handler when `step === 1` from triggering `handleCreate` — instead make Enter advance to step 2
- Rename the current "Create Project" button to "Next: Configure Pipeline" on step 1
- On step 2: full-width layout with `<WorkflowBuilder />` and "Back" / "Create Project" buttons
- Add `useEffect` cleanup: `return () => resetBuilder();`

- [ ] **Step 2: Rewrite handleCreate to use direct commands**

Replace the `handleCreate` function to:
1. Create workspace (existing logic)
2. Call `commands.createProject(safeName, workspace.path)` directly — this returns `{ id, ... }`
3. Create session (existing logic)
4. Call `commands.createPipeline({ project_id: projectRow.id, name: "Default", phases: builderPhases.map(...) })` using the returned project ID
5. Update local store state with the new project (add to projects array, set active)
6. Call `resetBuilder()`

This eliminates the race — `createProject` returns the row synchronously before `createPipeline` uses its ID.

```typescript
const handleCreate = async () => {
  setSubmitting(true);
  setError(null);
  try {
    await createWorkspace(safeName);
    const workspace = useAppStore.getState().activeWorkspace;
    if (!workspace) throw new Error("Workspace creation failed");

    // Create project in SQLite — get ID back directly
    const projectRow = await commands.createProject(safeName, workspace.path);

    // Create pipeline with builder phases
    const { builderPhases, resetBuilder } = useAppStore.getState();
    if (builderPhases.length > 0) {
      await commands.createPipeline({
        project_id: projectRow.id,
        name: "Default",
        phases: builderPhases.map((p) => ({
          label: p.label,
          phase_type: p.phaseType,
          backend: p.backend,
          framework: p.framework,
          model: p.model,
          custom_prompt: p.customPrompt,
          gate_after: p.gateAfter,
        })),
      });
    }

    // Create session and update store
    const sessionId = crypto.randomUUID();
    createSessionLocal(sessionId, safeName);

    // Add project to local store state
    useAppStore.setState((state) => ({
      projects: [...state.projects, {
        id: projectRow.id,
        name: projectRow.name,
        workspacePath: projectRow.workspace_path,
        activeSessionId: sessionId,
        summary: description,
        createdAt: projectRow.created_at,
        linkedRepoIds: [...checkedRepoIds],
        linkedSkillIds: [...checkedSkillIds],
        linkedAgentNames: [...checkedAgentNames],
      }],
      activeProjectId: projectRow.id,
      currentView: "conversation" as const,
    }));

    resetBuilder();
    setActiveSessionId(sessionId);
  } catch (err) {
    setError(String(err));
    setSubmitting(false);
  }
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/home/ProjectSetupView.tsx
git commit -m "feat: restructure ProjectSetupView with two-step flow and direct pipeline creation"
```

---

## Milestone D: Conversation View Components

### Task 7.5: Wire useAgentStream to emit gate-prompt and interaction card types

**Files:**
- Modify: `src/hooks/useAgentStream.ts`

Currently, `useAgentStream` maps `phase_transition` events to `"outcome"` cards with `cardSubtype: "phase_transition"` (line ~157). The new `GatePromptCard` and `InteractionCard` components won't render unless the stream hook emits the correct card types.

- [ ] **Step 1: Update phase_transition handling**

In `src/hooks/useAgentStream.ts`, find the `phase_transition` handling block inside the `agent_event` handler and change:

```typescript
// OLD:
if (eventType === "phase_transition") {
  store.insertRichCard(sid, "outcome", content, { ...meta, cardSubtype: "phase_transition" });
  return;
}

// NEW:
if (eventType === "phase_transition") {
  // Gate events get the gate-prompt card type; others get outcome
  const isGate = meta?.gate === "awaiting";
  store.insertRichCard(sid, isGate ? "gate-prompt" : "outcome", content, meta || {});
  return;
}
```

- [ ] **Step 2: Add interaction_request handling**

Add a new block for `interaction_request` events (framework questions):

```typescript
if (eventType === "interaction_request") {
  store.insertRichCard(sid, "interaction", content, meta || {});
  return;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAgentStream.ts
git commit -m "feat: wire gate-prompt and interaction card types in useAgentStream"
```

### Task 8: PhaseIndicator component

**Files:**
- Create: `src/components/conversation/PhaseIndicator.tsx`
- Modify: `src/components/panels/ClaudeChat.tsx`

- [ ] **Step 1: Create PhaseIndicator.tsx**

A horizontal progress bar showing pipeline phases. Each phase is a dot/label, colored by status (completed = green, running = blue pulse, pending = gray, awaiting_gate = amber).

```typescript
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
```

- [ ] **Step 2: Add PhaseIndicator to ClaudeChat**

In `src/components/panels/ClaudeChat.tsx`, import `PhaseIndicator` and render it between the `<SessionTabs>` and the CLI validation banner. Read the file to find the exact insertion point.

- [ ] **Step 3: Commit**

```bash
git add src/components/conversation/PhaseIndicator.tsx src/components/panels/ClaudeChat.tsx
git commit -m "feat: add PhaseIndicator to conversation header"
```

### Task 9: GatePromptCard component

**Files:**
- Create: `src/components/conversation/GatePromptCard.tsx`
- Modify: `src/components/panels/ClaudeChat.tsx`

- [ ] **Step 1: Create GatePromptCard.tsx**

A card rendered in the chat when a phase hits a gate. Shows phase completion info and a "Continue" button.

```typescript
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
```

- [ ] **Step 2: Wire into ClaudeChat card switch**

In `ClaudeChat.tsx`, import `GatePromptCard` and add to the `cardType` switch:

```typescript
case "gate-prompt":
  return <GatePromptCard key={msg.id} message={msg} />;
```

- [ ] **Step 3: Commit**

```bash
git add src/components/conversation/GatePromptCard.tsx src/components/panels/ClaudeChat.tsx
git commit -m "feat: add GatePromptCard for pipeline gate transitions"
```

### Task 10: InteractionCard component

**Files:**
- Create: `src/components/conversation/InteractionCard.tsx`
- Modify: `src/components/panels/ClaudeChat.tsx`

- [ ] **Step 1: Create InteractionCard.tsx**

A card for framework questions (GSD, Superpowers) that appear inline in chat. Shows the question with answer options or a text input.

```typescript
import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import type { ChatMessage } from "../../stores/types";

interface InteractionCardProps {
  message: ChatMessage;
  onRespond?: (answer: string) => void;
}

export function InteractionCard({ message, onRespond }: InteractionCardProps) {
  const [answer, setAnswer] = useState("");
  const data = message.cardData as {
    options?: string[];
    inputType?: "choice" | "text";
    answered?: boolean;
  } | undefined;

  const options = data?.options || [];
  const isChoice = data?.inputType === "choice" && options.length > 0;
  const isAnswered = data?.answered === true;

  const handleSubmit = (value: string) => {
    if (onRespond) onRespond(value);
  };

  return (
    <div className="bg-v-accent/5 border border-v-accent/20 rounded-lg p-3 mx-2">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare size={14} className="text-v-accent" />
        <span className="text-[10px] text-v-accent font-medium uppercase">Framework Question</span>
      </div>
      <p className="text-xs text-v-textHi mb-3">{message.content}</p>

      {!isAnswered && isChoice && (
        <div className="flex flex-col gap-1.5">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSubmit(opt)}
              className="text-left bg-v-surface border border-v-border rounded px-3 py-2 text-xs text-v-text hover:border-v-accent/50 transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {!isAnswered && !isChoice && (
        <div className="flex gap-2">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && answer.trim()) handleSubmit(answer.trim()); }}
            placeholder="Type your answer..."
            className="flex-1 bg-v-surface border border-v-border rounded px-2.5 py-1.5 text-xs text-v-textHi placeholder:text-v-dim outline-none focus:border-v-accent"
          />
          <button
            onClick={() => { if (answer.trim()) handleSubmit(answer.trim()); }}
            className="bg-v-accent text-white px-2.5 py-1.5 rounded text-xs hover:bg-v-accentHi transition-colors"
          >
            <Send size={12} />
          </button>
        </div>
      )}

      {isAnswered && (
        <p className="text-[10px] text-v-dim italic">Answered</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into ClaudeChat card switch**

```typescript
case "interaction":
  return <InteractionCard key={msg.id} message={msg} />;
```

- [ ] **Step 3: Commit**

```bash
git add src/components/conversation/InteractionCard.tsx src/components/panels/ClaudeChat.tsx
git commit -m "feat: add InteractionCard for framework question/answer in chat"
```

---

### Task 10.5: Pipeline hydration on project open

**Files:**
- Modify: `src/components/home/HomeScreen.tsx`

When reopening an existing project, load its pipeline so the conversation view can show the PhaseIndicator and track runs.

- [ ] **Step 1: Call loadProjectPipeline on project open**

In `HomeScreen.tsx`, update `handleOpenProject` to also call `loadProjectPipeline`:

```typescript
const handleOpenProject = async (project: { id: string; workspacePath: string; activeSessionId: string }) => {
  openProject(project.id);
  setActiveSessionId(project.activeSessionId);
  // Hydrate pipeline state for this project
  useAppStore.getState().loadProjectPipeline(project.id);
  try {
    await openWorkspace(project.workspacePath);
  } catch (err) {
    console.warn("Workspace load failed, chat still works:", err);
  }
};
```

This ensures `builderPhases` and any active pipeline run are populated from SQLite when reopening a project, rather than only working at creation time.

- [ ] **Step 2: Commit**

```bash
git add src/components/home/HomeScreen.tsx
git commit -m "feat: hydrate pipeline state when reopening project"
```

---

## Milestone E: Verification

### Task 11: Full build + test verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run frontend tests**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Builds successfully.

- [ ] **Step 4: Run Rust tests**

Run: `npm run test:rust`
Expected: All tests pass (no Rust changes in this plan).

- [ ] **Step 5: Start dev mode and test the flow**

Run: `npm run dev` (frontend only, no Rust needed for UI components)
Expected: Navigate to Home → New Project → Step 1 (name/resources) → Step 2 (workflow builder) → can add phases, configure backend/framework/model, toggle gates, reorder → Create Project. In conversation view, PhaseIndicator appears when a pipeline run is active.
