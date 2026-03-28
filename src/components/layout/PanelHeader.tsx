import type { ReactNode } from "react";

interface PanelHeaderProps {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PanelHeader({ title, icon, actions }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-v-bgAlt border-b border-v-border shrink-0 min-h-[32px]">
      <div className="flex items-center gap-1.5 text-[10px] font-sans font-bold text-v-dim tracking-[0.08em] uppercase">
        {icon && <span className="text-[11px] opacity-70">{icon}</span>}
        {title}
      </div>
      {actions && (
        <div className="flex gap-1 items-center">{actions}</div>
      )}
    </div>
  );
}
