import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { commands } from "../../lib/tauri";
import type { GlobalRepo } from "../../stores/types";

interface RepoGithubModalProps {
  onAdd: (repos: GlobalRepo[]) => void;
  onClose: () => void;
}

function parseGithubUrl(url: string): { org: string; name: string } | null {
  const httpsMatch = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (httpsMatch) return { org: httpsMatch[1], name: httpsMatch[2] };
  return null;
}

export function RepoGithubModal({ onAdd, onClose }: RepoGithubModalProps) {
  const [text, setText] = useState("");
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({ url, parsed: parseGithubUrl(url) }));
  }, [text]);

  const validCount = parsed.filter((p) => p.parsed).length;

  const handleConfirm = async () => {
    setCloning(true);
    setError(null);

    const repos: GlobalRepo[] = [];

    for (const { url, parsed: p } of parsed) {
      if (!p) continue;
      try {
        const meta = await commands.cloneRepo(url);
        repos.push({
          id: meta.local_path.replace(/[\\/]/g, "_").toLowerCase(),
          name: meta.name,
          source: "github",
          path: meta.local_path,
          gitUrl: url,
          branch: meta.branch,
          language: meta.language,
        });
      } catch (err) {
        setError(`Failed to clone ${p.org}/${p.name}: ${err}`);
      }
    }

    if (repos.length > 0) {
      onAdd(repos);
    }
    if (!error) {
      onClose();
    }
    setCloning(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-v-bgAlt border border-v-border rounded-xl p-5 w-[420px] max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-semibold text-v-textHi">Add GitHub Repos</h3>
          <button onClick={onClose} className="text-v-dim hover:text-v-text">
            <X size={14} />
          </button>
        </div>
        <p className="text-[11px] text-v-dim mb-4">Paste one or more GitHub URLs (one per line)</p>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder={"https://github.com/org/repo\nhttps://github.com/org/another-repo"}
          disabled={cloning}
          rows={4}
          className="w-full bg-v-surface border border-v-border rounded-lg px-3 py-2.5 text-xs text-v-textHi font-mono placeholder:text-v-dim outline-none focus:border-v-accent transition-colors resize-none mb-3 disabled:opacity-50"
        />

        {parsed.length > 0 && (
          <div className="bg-v-surface border border-v-border rounded-lg p-3 mb-3 max-h-[150px] overflow-y-auto">
            <div className="text-[10px] uppercase text-v-dim mb-2 tracking-wider">Will clone</div>
            <div className="flex flex-col gap-1.5">
              {parsed.map(({ url, parsed: p }, i) => (
                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-v-surfaceHi rounded-md border border-v-borderHi">
                  {p ? (
                    <div>
                      <div className="text-xs text-v-textHi">{p.org}/{p.name}</div>
                      <div className="text-[10px] text-v-dim">→ ~/vibe-workspaces/repos/{p.name}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-v-red truncate">{url} (invalid URL)</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-v-red text-[10px] mb-3">{error}</p>}

        <div className="flex justify-end">
          {validCount > 0 && (
            <button
              onClick={handleConfirm}
              disabled={cloning}
              className="px-4 py-2 bg-v-accent text-white rounded-lg text-xs font-medium hover:bg-v-accentHi transition-colors disabled:opacity-50"
            >
              {cloning ? "Cloning..." : `Clone & Add ${validCount} repo${validCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
