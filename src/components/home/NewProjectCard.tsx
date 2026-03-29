import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

interface NewProjectCardProps {
  disabled: boolean;
  onCreateProject: (name: string) => Promise<string | null>;
}

export function NewProjectCard({ disabled, onCreateProject }: NewProjectCardProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;

    setError(null);
    setSubmitting(true);
    const err = await onCreateProject(trimmed);
    setSubmitting(false);

    if (err) {
      setError(err);
    } else {
      setName("");
      setCreating(false);
    }
  };

  const handleCancel = () => {
    setName("");
    setError(null);
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
          onChange={(e) => { setName(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") handleCancel();
          }}
          onBlur={() => {
            if (!name.trim() && !submitting) handleCancel();
          }}
          placeholder="Project name..."
          disabled={submitting}
          className="bg-transparent border-b border-v-border text-v-textHi text-sm text-center outline-none w-full pb-1 placeholder:text-v-dim disabled:opacity-50"
        />
        {error && (
          <span className="text-v-red text-[10px] mt-1.5">{error}</span>
        )}
        <span className="text-v-dim text-[10px] mt-2">
          {submitting ? "Creating..." : "Enter to create · Esc to cancel"}
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
