import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { usePythonProcess } from "../../hooks/usePythonProcess";
import { RotateCcw, Trash2 } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  input: "text-v-cyan",
  output: "text-v-text",
  error: "text-v-red",
  system: "text-v-dim",
};

/**
 * Console -- Python REPL with colored output, input field,
 * command history (up/down), and auto-scroll.
 */
export function Console() {
  const { entries, pythonRunning, navigateHistory, pushHistory, clearEntries } =
    useAppStore(
      useShallow((s) => ({
        entries: s.entries,
        pythonRunning: s.pythonRunning,
        navigateHistory: s.navigateHistory,
        pushHistory: s.pushHistory,
        clearEntries: s.clearEntries,
      })),
    );

  const { start, send, kill } = usePythonProcess();
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-start Python on mount, kill on unmount
  useEffect(() => {
    start();
    return () => {
      kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (trimmed.length > 0) {
          send(trimmed);
          pushHistory(trimmed);
          setInputValue("");
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = navigateHistory("up");
        setInputValue(prev);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = navigateHistory("down");
        setInputValue(next);
      }
    },
    [inputValue, send, pushHistory, navigateHistory],
  );

  const handleRestart = useCallback(async () => {
    await kill();
    await start();
  }, [kill, start]);

  return (
    <div className="flex flex-col h-full bg-v-surface">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-0.5 border-b border-v-border shrink-0">
        <span className="text-[10px] font-mono text-v-dim uppercase tracking-wider flex-1">
          Python REPL
        </span>
        <button
          onClick={handleRestart}
          className="p-0.5 rounded hover:bg-v-surfaceHi text-v-dim hover:text-v-text transition-colors"
          title="Restart Python"
        >
          <RotateCcw size={11} />
        </button>
        <button
          onClick={clearEntries}
          className="p-0.5 rounded hover:bg-v-surfaceHi text-v-dim hover:text-v-text transition-colors"
          title="Clear console"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Output area */}
      <div className="flex-1 overflow-y-auto font-mono text-xs p-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`whitespace-pre-wrap ${TYPE_COLORS[entry.type] ?? "text-v-text"}`}
          >
            {entry.type === "input" ? `>>> ${entry.text}` : entry.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex items-center border-t border-v-border px-2 py-1 shrink-0">
        <span className="text-v-dim font-mono text-xs mr-1 select-none">
          &gt;&gt;&gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!pythonRunning}
          placeholder={pythonRunning ? "" : "Python not running"}
          className="bg-transparent border-none outline-none text-v-cyan font-mono text-xs flex-1 caret-v-accent placeholder:text-v-dim/50"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
