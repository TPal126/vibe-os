import { BarChart3 } from "lucide-react";
import { PanelHeader } from "../layout/PanelHeader";

export function SessionDashboard() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader title="SESSION DASHBOARD" icon={<BarChart3 size={12} />} />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[11px] text-v-dim">Dashboard loading...</p>
      </div>
    </div>
  );
}
