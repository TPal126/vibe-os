import type { ReactNode } from "react";

interface PlaceholderPanelProps {
  title: string;
  icon?: ReactNode;
  description?: string;
}

export function PlaceholderPanel({
  title,
  icon,
  description,
}: PlaceholderPanelProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-v-surface">
      {icon && (
        <div className="text-2xl text-v-dim/30 mb-2">{icon}</div>
      )}
      <div className="text-sm text-v-dim">{title}</div>
      {description && (
        <div className="text-xs text-v-dim/50 mt-1">{description}</div>
      )}
    </div>
  );
}
