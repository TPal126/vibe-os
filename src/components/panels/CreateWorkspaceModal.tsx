import { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../../stores";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateWorkspaceModal({
  isOpen,
  onClose,
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const createWorkspace = useAppStore((s) => s.createWorkspace);

  if (!isOpen) return null;

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name cannot be empty");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError("Only alphanumeric characters, hyphens, and underscores");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await createWorkspace(trimmed);
      setName("");
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative bg-v-bgAlt border border-v-border rounded-lg shadow-xl w-96 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-sans font-bold text-v-dim uppercase tracking-wider">
            New Workspace
          </span>
          <button
            onClick={onClose}
            className="text-v-dim hover:text-v-text transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Input */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          placeholder="my-project"
          autoFocus
          disabled={creating}
          className="w-full px-3 py-2 bg-v-surface border border-v-border rounded text-sm text-v-text placeholder:text-v-dim focus:outline-none focus:border-v-accent"
        />

        {/* Hint */}
        <p className="text-[10px] text-v-dim mt-1.5">
          Creates ~/vibe-workspaces/{name || "..."}/
        </p>

        {/* Error */}
        {error && (
          <p className="text-[10px] text-v-red mt-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-v-dim hover:text-v-text rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="px-3 py-1.5 text-xs bg-v-accent text-v-bg rounded hover:bg-v-accent/90 transition-colors disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
