import { useState, useCallback } from "react";

interface RepoDropZoneProps {
  onDrop: (paths: string[]) => void;
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
      const paths: string[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const path = (item as File & { path?: string }).path;
        if (!path) continue;
        paths.push(path);
      }

      if (paths.length > 0) {
        onDrop(paths);
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
