import type { ReactNode } from "react";

interface TooltipProps {
  children: ReactNode;
  text: string;
  position?: "top" | "bottom";
}

export function Tooltip({
  children,
  text,
  position = "top",
}: TooltipProps) {
  return (
    <div className="relative group inline-flex">
      {children}
      <span
        className={`absolute left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-v-textHi bg-v-surfaceHi border border-v-border rounded shadow-lg whitespace-nowrap z-50 pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150 ${
          position === "top"
            ? "bottom-full mb-1.5"
            : "top-full mt-1.5"
        }`}
      >
        {text}
      </span>
    </div>
  );
}
