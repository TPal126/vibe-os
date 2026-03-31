import { useState, useCallback, memo } from "react";
import { RefreshCw } from "lucide-react";
import { ArchitectureBreadcrumb } from "./ArchitectureBreadcrumb";
import { IconButton } from "../shared/IconButton";

export const ArchitectureDiagram = memo(function ArchitectureDiagram() {
  const [zoomLevel, setZoomLevel] = useState<"repo" | "module">("repo");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [loading, _setLoading] = useState(false);

  const breadcrumbPath = zoomLevel === "repo"
    ? ["All Repos"]
    : ["All Repos", selectedRepo ?? ""];

  const handleBreadcrumbNavigate = useCallback((depth: number) => {
    if (depth === 0) {
      setZoomLevel("repo");
      setSelectedRepo(null);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-v-bg">
      <div className="shrink-0 border-b border-v-border flex items-center justify-between">
        <ArchitectureBreadcrumb
          path={breadcrumbPath}
          onNavigate={handleBreadcrumbNavigate}
        />
        <div className="px-2">
          <IconButton
            icon={<RefreshCw size={10} className={loading ? "animate-spin" : ""} />}
            title="Refresh architecture"
            onClick={() => {}}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {zoomLevel === "repo" ? (
          <div className="text-center">
            <p className="text-v-dim text-xs">Architecture Diagram</p>
            <p className="text-v-dim text-[10px] mt-1">
              Repo topology will render here.
            </p>
            <p className="text-v-dim text-[10px]">
              Index a repo to see nodes.
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-v-dim text-xs">Module Detail: {selectedRepo}</p>
            <p className="text-v-dim text-[10px] mt-1">
              Module structure will render here.
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 px-2 py-1 border-t border-v-border flex items-center gap-3 text-[8px] text-v-dim">
        <span><span className="text-v-accent">●</span> active session</span>
        <span><span className="text-v-green">●</span> changed</span>
        <span><span className="text-v-dim">●</span> idle</span>
      </div>
    </div>
  );
});
