import React, { useState, useCallback } from "react";
import { ExternalLink, RefreshCw, Globe } from "lucide-react";
import type { ChatMessage } from "../../stores/types";

interface InlinePreviewCardProps {
  message: ChatMessage;
}

export const InlinePreviewCard = React.memo(function InlinePreviewCard({
  message,
}: InlinePreviewCardProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const data = message.cardData as { url: string } | undefined;
  if (!data?.url) return null;

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleOpenExternal = useCallback(() => {
    window.open(data!.url, "_blank");
  }, [data]);

  return (
    <div className="bg-v-surface/50 border border-v-border rounded-lg overflow-hidden my-1">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-v-border/50">
        <Globe size={12} className="text-v-green shrink-0" />
        <span className="flex-1 text-[11px] font-mono text-v-text truncate">
          {data.url}
        </span>
        <button
          onClick={handleRefresh}
          className="p-0.5 rounded text-v-dim hover:text-v-text transition-colors"
          title="Refresh"
        >
          <RefreshCw size={11} />
        </button>
        <button
          onClick={handleOpenExternal}
          className="p-0.5 rounded text-v-dim hover:text-v-text transition-colors"
          title="Open in browser"
        >
          <ExternalLink size={11} />
        </button>
      </div>

      {/* Iframe */}
      <div style={{ height: 300 }} className="bg-white">
        <iframe
          key={refreshKey}
          src={data.url}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Live Preview"
          loading="lazy"
        />
      </div>
    </div>
  );
});
