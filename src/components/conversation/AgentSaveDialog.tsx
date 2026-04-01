import { useState } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { useAppStore } from "../../stores";

interface AgentSaveDialogProps {
  initialName: string;
  initialDescription: string;
  initialSystemPrompt: string;
  initialTools: string[];
  sessionId: string;
  onSaved: () => void;
  onClose: () => void;
}

const ALL_TOOLS = ["bash", "read", "write", "edit", "grep", "glob", "agent", "web_search", "web_fetch"];

const PERMISSION_MODES = ["default", "plan", "auto", "bypassPermissions"];
const ISOLATION_OPTIONS = ["none", "worktree", "remote"];
const MEMORY_OPTIONS = ["none", "user", "project", "local"];

export function AgentSaveDialog({
  initialName,
  initialDescription,
  initialSystemPrompt,
  initialTools,
  sessionId,
  onSaved,
  onClose,
}: AgentSaveDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [tools, setTools] = useState<Set<string>>(new Set(initialTools));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Advanced Claude Code fields
  const [model, setModel] = useState("");
  const [permissionMode, setPermissionMode] = useState("default");
  const [maxTurns, setMaxTurns] = useState("");
  const [background, setBackground] = useState(false);
  const [isolation, setIsolation] = useState("none");
  const [memory, setMemory] = useState("none");

  const saveAgentDefinition = useAppStore((s) => s.saveAgentDefinition);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const opts: {
        model?: string | null;
        permissionMode?: string | null;
        maxTurns?: number | null;
        background?: boolean;
        isolation?: string | null;
        memory?: string | null;
      } = {};
      if (model.trim()) opts.model = model.trim();
      if (permissionMode !== "default") opts.permissionMode = permissionMode;
      const parsedMaxTurns = parseInt(maxTurns, 10);
      if (!isNaN(parsedMaxTurns) && parsedMaxTurns > 0) opts.maxTurns = parsedMaxTurns;
      if (background) opts.background = true;
      if (isolation !== "none") opts.isolation = isolation;
      if (memory !== "none") opts.memory = memory;

      await saveAgentDefinition(
        name.trim(),
        description.trim(),
        systemPrompt.trim(),
        Array.from(tools),
        sessionId,
        Object.keys(opts).length > 0 ? opts : undefined,
      );
      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (tool: string) => {
    const next = new Set(tools);
    if (next.has(tool)) next.delete(tool);
    else next.add(tool);
    setTools(next);
  };

  const safeName = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-v-bgAlt border border-v-border rounded-xl p-5 w-[480px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-v-textHi">Save Agent Definition</h3>
          <button onClick={onClose} className="text-v-dim hover:text-v-text">
            <X size={14} />
          </button>
        </div>

        <div className="mb-3">
          <label className="text-[11px] text-v-dim block mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            className="w-full bg-v-surface border border-v-border rounded-md px-2.5 py-2 text-[13px] text-v-textHi outline-none focus:border-v-accent"
          />
        </div>

        <div className="mb-3">
          <label className="text-[11px] text-v-dim block mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-v-surface border border-v-border rounded-md px-2.5 py-2 text-[13px] text-v-textHi outline-none focus:border-v-accent"
          />
        </div>

        <div className="mb-3">
          <label className="text-[11px] text-v-dim block mb-1">System prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            className="w-full bg-v-surface border border-v-border rounded-md px-2.5 py-2 text-[11px] text-v-text font-mono outline-none focus:border-v-accent resize-none leading-relaxed"
          />
        </div>

        <div className="mb-3">
          <label className="text-[11px] text-v-dim block mb-1.5">Tool permissions</label>
          <div className="flex gap-1 flex-wrap">
            {ALL_TOOLS.map((tool) => (
              <button
                key={tool}
                onClick={() => toggleTool(tool)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                  tools.has(tool)
                    ? "bg-v-cyan/10 text-v-cyan border-v-cyan/15"
                    : "bg-v-surface text-v-dim border-v-border line-through"
                }`}
              >
                {tool}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Claude Code Settings */}
        <div className="mb-3 border border-v-border rounded-lg overflow-hidden">
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="w-full flex items-center gap-1.5 px-2.5 py-2 text-[11px] text-v-dim hover:text-v-text transition-colors"
          >
            {advancedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Advanced
          </button>
          {advancedOpen && (
            <div className="px-2.5 pb-3 space-y-2.5 border-t border-v-border pt-2.5">
              <div>
                <label className="text-[10px] text-v-dim block mb-1">Model</label>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="inherit"
                  className="w-full bg-v-surface border border-v-border rounded-md px-2 py-1.5 text-[12px] text-v-textHi outline-none focus:border-v-accent placeholder:text-v-dim/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-v-dim block mb-1">Permission mode</label>
                <select
                  value={permissionMode}
                  onChange={(e) => setPermissionMode(e.target.value)}
                  className="w-full bg-v-surface border border-v-border rounded-md px-2 py-1.5 text-[12px] text-v-textHi outline-none focus:border-v-accent"
                >
                  {PERMISSION_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-v-dim block mb-1">Max turns</label>
                <input
                  type="number"
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(e.target.value)}
                  min={1}
                  placeholder="unlimited"
                  className="w-full bg-v-surface border border-v-border rounded-md px-2 py-1.5 text-[12px] text-v-textHi outline-none focus:border-v-accent placeholder:text-v-dim/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="agent-background"
                  checked={background}
                  onChange={(e) => setBackground(e.target.checked)}
                  className="accent-v-accent"
                />
                <label htmlFor="agent-background" className="text-[11px] text-v-text">
                  Run in background
                </label>
              </div>
              <div>
                <label className="text-[10px] text-v-dim block mb-1">Isolation</label>
                <select
                  value={isolation}
                  onChange={(e) => setIsolation(e.target.value)}
                  className="w-full bg-v-surface border border-v-border rounded-md px-2 py-1.5 text-[12px] text-v-textHi outline-none focus:border-v-accent"
                >
                  {ISOLATION_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-v-dim block mb-1">Memory</label>
                <select
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  className="w-full bg-v-surface border border-v-border rounded-md px-2 py-1.5 text-[12px] text-v-textHi outline-none focus:border-v-accent"
                >
                  {MEMORY_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="text-[10px] text-v-dim font-mono bg-v-surface rounded-md px-2.5 py-2 mb-4">
          ~/.vibe-os/agents/{safeName || "..."}.md
        </div>

        {error && <p className="text-v-red text-[10px] mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-v-text border border-v-border hover:border-v-borderHi transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs text-white bg-v-accent hover:bg-v-accentHi transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save to Catalog"}
          </button>
        </div>
      </div>
    </div>
  );
}
