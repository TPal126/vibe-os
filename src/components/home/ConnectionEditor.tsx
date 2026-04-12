interface ConnectionEditorProps {
  gateAfter: "gated" | "auto";
  onToggle: () => void;
}

export function ConnectionEditor({ gateAfter, onToggle }: ConnectionEditorProps) {
  const isGated = gateAfter === "gated";

  return (
    <div className="flex items-center ml-6 my-1 cursor-pointer group" onClick={onToggle}>
      <div className="w-0.5 h-5 bg-v-accent/40" />
      <div className="ml-3 flex items-center gap-1.5">
        <div
          className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${
            isGated
              ? "bg-amber-500 border-amber-700"
              : "bg-emerald-500 border-emerald-700"
          }`}
        />
        <span className="text-[10px] text-v-dim group-hover:text-v-text transition-colors">
          {isGated ? "Gated" : "Auto"}
        </span>
      </div>
    </div>
  );
}
