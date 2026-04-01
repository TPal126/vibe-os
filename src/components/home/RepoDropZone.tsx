import { useState, useCallback } from "react";
import type { GlobalRepo } from "../../stores/types";

interface RepoDropZoneProps {
  onDrop: (repos: GlobalRepo[]) => void;
}

export function RepoDropZone({ onDrop }: RepoDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const items = e.dataTransfer.files;
      const repos: GlobalRepo[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const path = (item as File & { path?: string }).path;
        if (!path) continue;

        const name = path.split(/[\\/]/).pop() || path;
        repos.push({
          id: path.replace(/[\\/]/g, "_").toLowerCase(),
          name,
          source: "local",
          path,
          gitUrl: null,
          branch: "main",
          language: "",
        });
      }

      if (repos.length > 0) {
        onDrop(repos);
      }
    },
    [onDrop],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors mb-2 ${
        dragOver
          ? "border-v-accent bg-v-accent/5"
          : "border-v-border"
      }`}
    >
      <p className={`text-[10px] ${dragOver ? "text-v-accentHi font-medium" : "text-v-dim"}`}>
        {dragOver ? "Drop to add repos" : "Drop folders here"}
      </p>
    </div>
  );
}
