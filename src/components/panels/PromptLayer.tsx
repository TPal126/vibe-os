import { useState, useCallback, useRef } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { PanelHeader } from "../layout/PanelHeader";
import { IconButton } from "../shared/IconButton";
import { formatTokens } from "../../lib/tokens";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Layers, Copy, Check } from "lucide-react";

const subTabs = [
  { id: "system", label: "System" },
  { id: "task", label: "Task" },
  { id: "skills", label: "Skills" },
  { id: "repo", label: "Repo" },
] as const;

type SubTabId = (typeof subTabs)[number]["id"];

export function PromptLayer() {
  const { systemPrompt, composedPrompt, setSystemPrompt } = useAppStore(
    useShallow((s) => ({
      systemPrompt: s.systemPrompt,
      composedPrompt: s.composedPrompt,
      setSystemPrompt: s.setSystemPrompt,
    })),
  );

  const [activeSubTab, setActiveSubTab] = useState<SubTabId>("system");
  const [copied, setCopied] = useState(false);
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync from store when it changes externally (hydration, etc.)
  const storePromptRef = useRef(systemPrompt);
  if (storePromptRef.current !== systemPrompt) {
    storePromptRef.current = systemPrompt;
    setLocalSystemPrompt(systemPrompt);
  }

  const handleSystemPromptChange = useCallback(
    (value: string) => {
      setLocalSystemPrompt(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSystemPrompt(value);
      }, 500);
    },
    [setSystemPrompt],
  );

  const handleCopy = useCallback(async () => {
    if (!composedPrompt) return;
    try {
      await writeText(composedPrompt.full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }, [composedPrompt]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        title="PROMPT LAYER"
        icon={<Layers size={12} />}
        actions={
          <div className="flex items-center gap-1.5">
            {composedPrompt && (
              <span className="text-[10px] font-mono text-v-dim">
                ~{formatTokens(composedPrompt.totalTokens)} tokens
              </span>
            )}
            <IconButton
              icon={copied ? <Check size={12} /> : <Copy size={12} />}
              onClick={handleCopy}
              title="Copy Full Prompt"
              active={copied}
            />
          </div>
        }
      />

      {/* Sub-tab strip */}
      <div className="flex border-b border-v-border bg-v-bg shrink-0">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3 py-1 text-[10px] font-sans tracking-wider uppercase transition-all border-b-2 ${
              activeSubTab === tab.id
                ? "font-semibold text-v-textHi border-v-accent"
                : "font-normal text-v-dim border-transparent hover:text-v-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-2">
        {activeSubTab === "system" ? (
          <textarea
            value={localSystemPrompt}
            onChange={(e) => handleSystemPromptChange(e.target.value)}
            placeholder="Enter your system prompt here..."
            className="w-full h-full resize-none bg-v-bg border border-v-border rounded p-3 text-[11px] font-mono text-v-text placeholder:text-v-dim/50 focus:border-v-accent focus:outline-none"
          />
        ) : (
          <textarea
            value={
              activeSubTab === "task"
                ? (composedPrompt?.task ?? "")
                : activeSubTab === "skills"
                  ? (composedPrompt?.skills ?? "")
                  : (composedPrompt?.repo ?? "")
            }
            readOnly
            className="w-full h-full resize-none bg-v-bg border border-v-border/50 rounded p-3 text-[11px] font-mono text-v-text/80 cursor-default"
          />
        )}
      </div>
    </div>
  );
}
