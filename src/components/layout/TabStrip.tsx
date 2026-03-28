import type { ReactNode } from "react";

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabStripProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
}

export function TabStrip({ tabs, activeId, onChange }: TabStripProps) {
  return (
    <div className="flex border-b border-v-border bg-v-bg shrink-0 overflow-hidden">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-3 py-1.5 text-[11px] font-sans transition-all tracking-[0.01em] select-none border-b-2 ${
              isActive
                ? "font-semibold text-v-textHi border-v-accent"
                : "font-normal text-v-dim border-transparent hover:text-v-text"
            }`}
          >
            {tab.icon && (
              <span className="mr-1.5 text-[10px] opacity-60 inline-flex">
                {tab.icon}
              </span>
            )}
            {tab.label}
            {tab.count != null && (
              <span className="ml-1.5 text-[9px] opacity-50">
                ({tab.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
