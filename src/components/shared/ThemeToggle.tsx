import { Sun, Moon } from "lucide-react";
import { useAppStore } from "../../stores";

export function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex items-center gap-1 px-2 py-1 rounded-full bg-v-surface border border-v-border hover:border-v-borderHi transition-colors"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      <Sun size={10} className={theme === "light" ? "text-v-textHi" : "text-v-dim"} />
      <div className="w-6 h-3.5 rounded-full bg-v-accent relative">
        <div
          className={`w-2.5 h-2.5 rounded-full bg-white absolute top-0.5 transition-all ${
            theme === "dark" ? "right-0.5" : "left-0.5"
          }`}
        />
      </div>
      <Moon size={10} className={theme === "dark" ? "text-v-textHi" : "text-v-dim"} />
    </button>
  );
}
