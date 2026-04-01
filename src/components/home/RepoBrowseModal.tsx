import { useState } from "react";
import { X } from "lucide-react";
import { showOpenDirectoriesDialog, commands } from "../../lib/tauri";
import type { GlobalRepo } from "../../stores/types";

interface RepoBrowseModalProps {
  onAdd: (repos: GlobalRepo[]) => void;
  onClose: () => void;
}

export function RepoBrowseModal({ onAdd, onClose }: RepoBrowseModalProps) {
  const [selected, setSelected] = useState<{ name: string; path: string; hasGit: boolean }[]>([]);

  const handleBrowse = async () => {
    const paths = await showOpenDirectoriesDialog();
    if (!paths) return;

    const newItems = await Promise.all(
      paths.map(async (p) => {
        const name = p.split(/[\\/]/).pop() || p;
        let hasGit = false;
        try {
          await commands.readFile(p + "/.git/HEAD");
          hasGit = true;
        } catch {
          hasGit = false;
        }
        return { name, path: p, hasGit };
      }),
    );

    setSelected((prev) => {
      const existingPaths = new Set(prev.map((s) => s.path));
      return [...prev, ...newItems.filter((i) => !existingPaths.has(i.path))];
    });
  };

  const handleConfirm = () => {
    const repos: GlobalRepo[] = selected.map((s) => ({
      id: s.path.replace(/[\\/]/g, "_").toLowerCase(),
      name: s.name,
      source: "local" as const,
      path: s.path,
      gitUrl: null,
      branch: "main",
      language: "",
    }));
    onAdd(repos);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-v-bgAlt border border-v-border rounded-xl p-5 w-[420px] max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-semibold text-v-textHi">Add Local Repos</h3>
          <button onClick={onClose} className="text-v-dim hover:text-v-text">
            <X size={14} />
          </button>
        </div>
        <p className="text-[11px] text-v-dim mb-4">Select one or more folders from your machine</p>

        {selected.length > 0 && (
          <div className="bg-v-surface border border-v-border rounded-lg p-3 mb-3 max-h-[200px] overflow-y-auto">
            <div className="text-[10px] uppercase text-v-dim mb-2 tracking-wider">Selected folders</div>
            <div className="flex flex-col gap-1.5">
              {selected.map((item) => (
                <div key={item.path} className="flex items-center justify-between px-2.5 py-2 bg-v-surfaceHi rounded-md border border-v-borderHi">
                  <div>
                    <div className="text-xs text-v-textHi">{item.name}</div>
                    <div className="text-[10px] text-v-dim truncate max-w-[260px]">{item.path}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${item.hasGit ? "bg-v-greenDim text-v-green" : "bg-v-orangeDim text-v-orange"}`}>
                      {item.hasGit ? "git ✓" : "no git"}
                    </span>
                    <button
                      onClick={() => setSelected((prev) => prev.filter((s) => s.path !== item.path))}
                      className="text-v-dim hover:text-v-text text-xs"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleBrowse}
            className="flex-1 text-center py-2 border border-dashed border-v-borderHi rounded-lg text-[11px] text-v-dim hover:border-v-accent hover:text-v-text transition-colors"
          >
            {selected.length > 0 ? "+ Browse more" : "Browse folders..."}
          </button>
          {selected.length > 0 && (
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-v-accent text-white rounded-lg text-xs font-medium hover:bg-v-accentHi transition-colors"
            >
              Add {selected.length} repo{selected.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
