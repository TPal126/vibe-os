import { TitleBar } from "./components/layout/TitleBar";
import { MainLayout } from "./components/layout/MainLayout";
import { StatusBar } from "./components/layout/StatusBar";

function App() {
  return (
    <div className="h-screen flex flex-col bg-v-bg overflow-hidden">
      <TitleBar />
      <MainLayout />
      <StatusBar />
    </div>
  );
}

export default App;
