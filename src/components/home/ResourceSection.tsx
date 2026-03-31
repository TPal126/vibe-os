import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ResourceSectionProps {
  title: string;
  count?: number;
  badge?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function ResourceSection({
  title,
  count,
  badge,
  actions,
  children,
  defaultOpen = true,
}: ResourceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-xs font-semibold text-v-text hover:text-v-textHi transition-colors"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
          {count !== undefined && (
            <span className="text-v-dim font-normal ml-1">({count})</span>
          )}
        </button>
        <div className="flex items-center gap-1">
          {badge && (
            <span className="text-[10px] text-v-dim bg-v-surface px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
          {actions}
        </div>
      </div>
      {open && children}
    </div>
  );
}
