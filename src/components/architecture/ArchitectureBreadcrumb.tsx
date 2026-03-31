import { ChevronRight } from "lucide-react";

interface ArchitectureBreadcrumbProps {
  path: string[];  // e.g., ["All Repos"] or ["All Repos", "api-server"]
  onNavigate: (depth: number) => void;
}

export function ArchitectureBreadcrumb({ path, onNavigate }: ArchitectureBreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 text-[9px] shrink-0">
      {path.map((segment, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={8} className="text-v-dim" />}
          {i < path.length - 1 ? (
            <button
              onClick={() => onNavigate(i)}
              className="text-v-accent hover:text-v-accentHi"
            >
              {segment}
            </button>
          ) : (
            <span className="text-v-textHi font-semibold">{segment}</span>
          )}
        </span>
      ))}
    </div>
  );
}
