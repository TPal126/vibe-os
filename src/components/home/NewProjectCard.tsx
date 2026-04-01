import { Plus } from "lucide-react";

interface NewProjectCardProps {
  disabled: boolean;
  onNewProject: () => void;
}

export function NewProjectCard({ disabled, onNewProject }: NewProjectCardProps) {
  if (disabled) {
    return (
      <div
        className="border border-dashed border-v-border rounded-lg p-5 flex flex-col items-center justify-center opacity-40 cursor-not-allowed min-h-[100px]"
        title="Maximum 5 projects"
      >
        <Plus size={20} className="text-v-dim" />
        <span className="text-v-dim text-[11px] mt-1.5">Maximum reached</span>
      </div>
    );
  }

  return (
    <button
      onClick={onNewProject}
      className="border border-dashed border-v-border rounded-lg p-5 flex flex-col items-center justify-center hover:border-v-accent transition-colors cursor-pointer min-h-[100px]"
    >
      <Plus size={20} className="text-v-dim" />
      <span className="text-v-dim text-[11px] mt-1.5">New Project</span>
    </button>
  );
}
