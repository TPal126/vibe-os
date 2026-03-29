import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

interface NewProjectCardProps {
  disabled: boolean;
  onCreateProject: (name: string) => void;
}

export function NewProjectCard({ disabled, onCreateProject }: NewProjectCardProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed) {
      onCreateProject(trimmed);
      setName("");
      setCreating(false);
    }
  };

  const handleCancel = () => {
    setName("");
    setCreating(false);
  };

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

  if (creating) {
    return (
      <div className="border border-v-accent rounded-lg p-5 flex flex-col items-center justify-center min-h-[100px] bg-v-surface">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") handleCancel();
          }}
          onBlur={() => {
            if (!name.trim()) handleCancel();
          }}
          placeholder="Project name..."
          className="bg-transparent border-b border-v-border text-v-textHi text-sm text-center outline-none w-full pb-1 placeholder:text-v-dim"
        />
        <span className="text-v-dim text-[10px] mt-2">
          Enter to create · Esc to cancel
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={() => setCreating(true)}
      className="border border-dashed border-v-border rounded-lg p-5 flex flex-col items-center justify-center hover:border-v-accent transition-colors cursor-pointer min-h-[100px]"
    >
      <Plus size={20} className="text-v-dim" />
      <span className="text-v-dim text-[11px] mt-1.5">New Project</span>
    </button>
  );
}
