import React from "react";
import { Dot } from "../shared/Dot";

interface PreviewThumbnailProps {
  url: string;
}

export const PreviewThumbnail = React.memo(function PreviewThumbnail({
  url,
}: PreviewThumbnailProps) {
  return (
    <div className="mt-2 rounded overflow-hidden border border-v-border/50 bg-white relative"
         style={{ height: 80 }}
    >
      <div
        style={{
          width: 320,
          height: 200,
          transform: "scale(0.4)",
          transformOrigin: "top left",
        }}
      >
        <iframe
          src={url}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Preview thumbnail"
          loading="lazy"
          style={{ pointerEvents: "none" }}
        />
      </div>
      <div className="absolute bottom-1 right-1.5 flex items-center gap-1">
        <Dot color="bg-v-green" pulse />
        <span className="text-[8px] font-mono text-v-green/70">Live</span>
      </div>
    </div>
  );
});
