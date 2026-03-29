import { ClaudeChat } from "../panels/ClaudeChat";
import { SecondaryDrawer } from "./SecondaryDrawer";

export function MainLayout() {
  return (
    <div className="flex-1 overflow-hidden relative">
      <ClaudeChat />
      <SecondaryDrawer />
    </div>
  );
}
