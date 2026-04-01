import { useState } from "react";
import { X } from "lucide-react";
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

  const saveAgentDefinition = useAppStore((s) => s.saveAgentDefinition);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveAgentDefinition(
        name.trim(),
        description.trim(),
        systemPrompt.trim(),
        Array.from(tools),
        sessionId,
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
