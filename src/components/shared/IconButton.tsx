import type { ReactNode } from "react";

interface IconButtonProps {
  icon: ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  size?: number;
  className?: string;
}

export function IconButton({
  icon,
  onClick,
  title,
  active = false,
  size = 13,
  className = "",
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-[5px] py-[3px] rounded-sm transition-all duration-[120ms] ${
        active
          ? "bg-v-accent/15 text-v-accentHi"
          : "text-v-dim hover:bg-v-surfaceHi hover:text-v-text"
      } ${className}`}
      style={{ fontSize: size }}
    >
      {icon}
    </button>
  );
}
