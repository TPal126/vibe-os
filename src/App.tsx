import { TitleBar } from "./components/layout/TitleBar";
import { StatusBar } from "./components/layout/StatusBar";

function App() {
  return (
    <div className="h-screen flex flex-col bg-v-bg">
      <TitleBar />
      <div className="flex-1 flex items-center justify-center">
        <span className="text-v-dim">
          Layout Shell -- Plan 02 will add columns
        </span>
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
