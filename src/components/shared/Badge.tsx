import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  color?: string;
  bg?: string;
}

export function Badge({
  children,
  color = "text-v-accent",
  bg = "bg-v-accent/15",
}: BadgeProps) {
  return (
    <span
      className={`text-[10px] font-sans font-semibold px-[7px] py-[2px] rounded ${color} ${bg} tracking-[0.04em] leading-4 inline-flex items-center whitespace-nowrap`}
    >
      {children}
    </span>
  );
}
