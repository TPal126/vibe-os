import { useEffect, useState } from "react";
import { useAppStore } from "../../stores";
import { commands } from "../../lib/tauri";
import type { ScriptEntryRaw } from "../../lib/tauri";
import type { ScriptEntry } from "../../stores/types";

export function ScriptsTracker() {
  const activeSession = useAppStore((s) => s.activeSession);
  const discoverSkills = useAppStore((s) => s.discoverSkills);
  const [scripts, setScripts] = useState<ScriptEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSession) return;
    setLoading(true);
    commands
      .getSessionScripts(activeSession.id)
      .then((raw: ScriptEntryRaw[]) => {
        setScripts(
          raw.map((s) => ({
            path: s.path,
            name: s.name,
            firstSeen: s.first_seen,
            lastModified: s.last_modified,
            modificationCount: s.modification_count,
          })),
        );
      })
      .catch((e) => console.error("Failed to load scripts:", e))
      .finally(() => setLoading(false));
  }, [activeSession]);

  const handleGenerateSkill = async (scriptPath: string) => {
    setGenerating(scriptPath);
    try {
      await commands.generateSkillFromScript(scriptPath);
      await discoverSkills();
    } catch (e) {
      console.error("Failed to generate skill:", e);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">Loading scripts...</p>
          </div>
        ) : scripts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <p className="text-[11px] text-v-dim">
                Python scripts created during this session will appear here
              </p>
              <p className="text-[9px] text-v-dim mt-1">
                Generate reusable skills from your scripts
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-v-border/30">
            {scripts.map((script) => (
              <ScriptRow
                key={script.path}
                script={script}
                generating={generating === script.path}
                onGenerate={() => handleGenerateSkill(script.path)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScriptRow({
  script,
  generating,
  onGenerate,
}: {
  script: ScriptEntry;
  generating: boolean;
  onGenerate: () => void;
}) {
  const time = new Date(script.firstSeen).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-v-surface/50 transition-colors">
      <span className="shrink-0 text-[11px] text-v-orange">{"\u25A6"}</span>
      <div className="flex-1 min-w-0">
        <p
          className="text-[11px] text-v-textHi font-mono truncate"
          title={script.path}
        >
          {script.name}
        </p>
        <p className="text-[9px] text-v-dim truncate" title={script.path}>
          {script.path}
        </p>
      </div>
      <span className="shrink-0 text-[9px] font-mono text-v-dim">{time}</span>
      {script.modificationCount > 1 && (
        <span className="shrink-0 px-1 py-0.5 rounded text-[9px] font-mono text-v-dim bg-v-surface">
          {script.modificationCount}x
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onGenerate();
        }}
        disabled={generating}
        className="shrink-0 px-2 py-0.5 rounded text-[9px] font-mono text-v-accent bg-v-accent/10 hover:bg-v-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Generate skill from this script"
      >
        {generating ? "..." : "\u2192 Skill"}
      </button>
    </div>
  );
}
