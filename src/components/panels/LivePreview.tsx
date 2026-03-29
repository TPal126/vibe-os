import { useState, useEffect, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../stores";
import { Dot } from "../shared/Dot";
import { RefreshCw } from "lucide-react";

export function LivePreview() {
  const { previewUrl, autoRefresh, setPreviewUrl, toggleAutoRefresh } =
    useAppStore(
      useShallow((s) => ({
        previewUrl: s.previewUrl,
        autoRefresh: s.autoRefresh,
        setPreviewUrl: s.setPreviewUrl,
        toggleAutoRefresh: s.toggleAutoRefresh,
      })),
    );

  const lastSaveTimestamp = useAppStore((s) => s.lastSaveTimestamp);

  const [urlInput, setUrlInput] = useState(previewUrl ?? "");
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh on file changes (debounced 500ms)
  useEffect(() => {
    if (!autoRefresh || !previewUrl || lastSaveTimestamp === 0) return;

    const timeout = setTimeout(() => {
      setRefreshKey((k) => k + 1);
    }, 500);

    return () => clearTimeout(timeout);
  }, [autoRefresh, previewUrl, lastSaveTimestamp]);

  // URL submit handler
  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      let url = urlInput.trim();
      if (url && !url.startsWith("http")) {
        url = "http://" + url;
      }
      if (url) {
        setPreviewUrl(url);
        setRefreshKey((k) => k + 1);
      }
    },
    [urlInput, setPreviewUrl],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-v-border bg-v-bgAlt">
        {/* Traffic light dots */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-v-red/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-v-orange/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-v-green/60" />
        </div>

        {/* URL bar */}
        <form onSubmit={handleUrlSubmit} className="flex-1 min-w-0">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="http://localhost:3000"
            className="w-full px-2 py-0.5 rounded bg-v-surface text-[10px] font-mono text-v-text border border-v-border focus:border-v-accent focus:outline-none placeholder:text-v-dim"
          />
        </form>

        {/* Live indicator */}
        {previewUrl && (
          <div className="flex items-center gap-1 shrink-0">
            <Dot color="bg-v-green" pulse />
            <span className="text-[9px] font-mono text-v-green">Live</span>
          </div>
        )}

        {/* Auto-refresh toggle */}
        <button
          onClick={toggleAutoRefresh}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
            autoRefresh
              ? "text-v-accent bg-v-accent/10"
              : "text-v-dim hover:text-v-text"
          }`}
          title={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
        >
          <RefreshCw size={9} />
          Auto
        </button>

        {/* Manual refresh */}
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="p-1 rounded text-v-dim hover:text-v-text hover:bg-v-surface transition-colors"
          title="Refresh"
        >
          <RefreshCw size={10} />
        </button>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 overflow-hidden bg-white">
        {previewUrl ? (
          <iframe
            key={refreshKey}
            src={previewUrl}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Live Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-v-bg">
            <div className="text-center">
              <p className="text-[11px] text-v-dim">
                Enter a dev server URL above to preview
              </p>
              <p className="text-[9px] text-v-dim mt-1">
                e.g., http://localhost:3000 or http://localhost:8501
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
