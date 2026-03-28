import { useState } from "react";
import { commands } from "./lib/tauri";
import { appDataDir } from "@tauri-apps/api/path";

function App() {
  const [results, setResults] = useState<
    Array<{ prefix: string; color: string; message: string }>
  >([]);

  const addResult = (prefix: string, color: string, message: string) => {
    setResults((prev) => [...prev, { prefix, color, message }]);
  };

  const handleTestDatabase = async () => {
    try {
      const writeResult = await commands.testDbWrite();
      addResult("db", "text-v-accent", writeResult);

      const readResult = await commands.testDbRead();
      addResult("db", "text-v-accent", `Read back: ${readResult}`);
    } catch (err) {
      addResult("err", "text-v-red", String(err));
    }
  };

  const handleTestPaths = async () => {
    try {
      const dataDir = await appDataDir();
      addResult("path", "text-v-green", `appDataDir: ${dataDir}`);
    } catch (err) {
      addResult("err", "text-v-red", String(err));
    }
  };

  const handleClear = () => {
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-v-bg text-v-text p-8 font-sans">
      {/* Header */}
      <h1 className="text-3xl font-bold text-v-accentHi font-brand mb-2">
        VIBE OS
      </h1>
      <p className="text-v-dim text-sm mb-8">
        Foundation Test Harness -- Phase 1, Plan 01
      </p>

      {/* Color Palette Grid */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-v-textHi mb-3">
          Color Palette
        </h2>
        <div className="grid grid-cols-6 gap-2">
          <div className="bg-v-bg border border-v-border rounded p-2 text-xs text-v-dim">
            bg
          </div>
          <div className="bg-v-bgAlt border border-v-border rounded p-2 text-xs text-v-dim">
            bgAlt
          </div>
          <div className="bg-v-surface border border-v-border rounded p-2 text-xs text-v-dim">
            surface
          </div>
          <div className="bg-v-surfaceHi border border-v-border rounded p-2 text-xs text-v-dim">
            surfaceHi
          </div>
          <div className="bg-v-border rounded p-2 text-xs text-v-dim">
            border
          </div>
          <div className="bg-v-borderHi rounded p-2 text-xs text-v-dim">
            borderHi
          </div>
          <div className="bg-v-accent rounded p-2 text-xs text-white">
            accent
          </div>
          <div className="bg-v-accentHi rounded p-2 text-xs text-white">
            accentHi
          </div>
          <div className="bg-v-green rounded p-2 text-xs text-white">
            green
          </div>
          <div className="bg-v-greenDim rounded p-2 text-xs text-v-green">
            greenDim
          </div>
          <div className="bg-v-red rounded p-2 text-xs text-white">red</div>
          <div className="bg-v-redDim rounded p-2 text-xs text-v-red">
            redDim
          </div>
          <div className="bg-v-orange rounded p-2 text-xs text-black">
            orange
          </div>
          <div className="bg-v-orangeDim rounded p-2 text-xs text-v-orange">
            orangeDim
          </div>
          <div className="bg-v-cyan rounded p-2 text-xs text-black">cyan</div>
          <div className="bg-v-cyanDim rounded p-2 text-xs text-v-cyan">
            cyanDim
          </div>
          <div className="p-2 text-xs text-v-text">text</div>
          <div className="p-2 text-xs text-v-textHi">textHi</div>
        </div>
      </section>

      {/* Typography */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-v-textHi mb-3">
          Typography
        </h2>
        <p className="font-sans text-v-text mb-1">
          Instrument Sans (UI font) -- font-sans
        </p>
        <p className="font-mono text-v-text mb-1">
          JetBrains Mono (code font) -- font-mono
        </p>
        <p className="font-brand text-v-text mb-1">
          Space Mono (brand font) -- font-brand
        </p>
      </section>

      {/* Test Buttons */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-v-textHi mb-3">
          Infrastructure Tests
        </h2>
        <div className="flex gap-3">
          <button
            onClick={handleTestDatabase}
            className="px-4 py-2 bg-v-accent text-white rounded hover:bg-v-accentHi transition-colors font-mono text-sm"
          >
            Test Database
          </button>
          <button
            onClick={handleTestPaths}
            className="px-4 py-2 bg-v-green text-white rounded hover:opacity-80 transition-opacity font-mono text-sm"
          >
            Test Paths
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-v-surfaceHi text-v-dim rounded hover:text-v-text transition-colors font-mono text-sm border border-v-border"
          >
            Clear
          </button>
        </div>
      </section>

      {/* Results Area */}
      <section>
        <h2 className="text-lg font-semibold text-v-textHi mb-3">Results</h2>
        <div className="bg-v-surface border border-v-border rounded p-4 font-mono text-sm min-h-[120px]">
          {results.length > 0 ? (
            results.map((r, i) => (
              <div key={i} className="mb-1">
                <span className={r.color}>{r.prefix}&gt;</span>{" "}
                <span className="text-v-textHi">{r.message}</span>
              </div>
            ))
          ) : (
            <span className="text-v-dim">
              Click a test button to see results...
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
