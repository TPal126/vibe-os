import { Network } from "lucide-react";
import { PanelHeader } from "../layout/PanelHeader";

export function MermaidDiagram() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader title="ARCHITECTURE" icon={<Network size={12} />} />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[11px] text-v-dim">Activate repos to see architecture</p>
      </div>
    </div>
  );
}
