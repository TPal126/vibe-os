import { X } from "lucide-react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";

export function EditorTabs() {
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useAppStore(
    useShallow((s) => ({
      openFiles: s.openFiles,
      activeFilePath: s.activeFilePath,
      setActiveFile: s.setActiveFile,
      closeFile: s.closeFile,
    })),
  );

  if (openFiles.length === 0) {
    return (
      <div className="flex items-center h-8 px-3 bg-v-bgAlt border-b border-v-border">
        <span className="text-[11px] text-v-dim">No files open</span>
      </div>
    );
  }

  return (
    <div className="flex items-center h-8 bg-v-bgAlt border-b border-v-border overflow-x-auto">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        return (
          <button
            key={file.path}
            className={`group flex items-center gap-1.5 h-full px-3 text-[11px] font-mono shrink-0 border-b-2 transition-colors ${
              isActive
                ? "bg-v-surface text-v-textHi border-v-accent"
                : "bg-v-bgAlt text-v-dim hover:text-v-text border-transparent"
            }`}
            onClick={() => setActiveFile(file.path)}
            title={file.path}
          >
            <span>{file.name}</span>
            {file.isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-v-orange shrink-0" />
            )}
            <span
              className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-v-border transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
            >
              <X size={12} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
