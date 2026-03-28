import { useState } from "react";
import { X } from "lucide-react";

interface AddRepoModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (gitUrl: string) => Promise<void>;
}

export function AddRepoModal({ open, onClose, onSubmit }: AddRepoModalProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit() {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(url.trim());
      setUrl("");
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-v-surface border border-v-border rounded-lg w-[420px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-v-border">
          <span className="text-[11px] font-sans font-bold text-v-dim uppercase tracking-wider">
            Add Repository
          </span>
          <button
            onClick={onClose}
            className="text-v-dim hover:text-v-text transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="https://github.com/org/repo.git"
            autoFocus
            disabled={loading}
            className="w-full px-3 py-2 bg-v-bg border border-v-border rounded text-[12px] font-mono text-v-text placeholder:text-v-dim focus:border-v-accent focus:outline-none"
          />
          {error && (
            <p className="text-[10px] text-v-red mt-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-v-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] font-sans text-v-dim hover:text-v-text rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!url.trim() || loading}
            className="px-3 py-1.5 text-[11px] font-sans font-semibold bg-v-accent/20 text-v-accentHi rounded hover:bg-v-accent/30 disabled:opacity-40"
          >
            {loading ? "Cloning..." : "Clone & Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
