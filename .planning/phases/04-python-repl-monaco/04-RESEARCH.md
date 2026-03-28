# Phase 4: Python REPL + Monaco Editor - Research

**Researched:** 2026-03-28
**Domain:** Monaco Editor integration, Python subprocess management, Tauri shell/fs plugins, resource bundling
**Confidence:** HIGH

## Summary

Phase 4 introduces two major interactive components to VIBE OS: a Monaco code editor with Python syntax highlighting and a custom theme, and a Python REPL console driven by a persistent subprocess. Both build on existing infrastructure -- the Tauri shell plugin (already configured with Python and stdin permissions), the three-column layout (center column already has "Editor" and "Console" placeholders), and the Zustand store pattern.

The Monaco integration is well-trodden ground: `@monaco-editor/react` v4.7 provides a React wrapper with built-in multi-model support via the `path` prop, custom theme definition via `beforeMount`, and a loader system that can be configured to use a local `monaco-editor` npm package instead of CDN (critical for a desktop app). The Python REPL uses the Tauri shell plugin's `Command.create()` + `spawn()` pattern, which returns a `Child` handle for writing to stdin and provides `stdout`/`stderr` event callbacks for streaming output. This is the same pattern Phase 5 will reuse for Claude CLI.

This phase also adds the audit_log table to SQLite (migration v3), file read/write capabilities (via Tauri's fs plugin or Rust commands), and default skill bundling via Tauri's resource system.

**Primary recommendation:** Use `@monaco-editor/react` with local `monaco-editor` bundled via `loader.config({ monaco })`, manage file models explicitly with `monaco.editor.createModel()` / `model.dispose()` for tab lifecycle, spawn Python via `Command.create('run-python-win'/'run-python')` with `-u -i` flags for unbuffered interactive mode, and handle all file I/O through Rust `#[tauri::command]` functions (not the fs plugin) to keep the audit logging in one place.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONSOLE-01 | Python console spawns subprocess, accepts input, displays output with colored output and command history | Tauri shell plugin Command.create() + spawn() + Child.write() pattern; python -u -i flags for unbuffered interactive mode |
| CONSOLE-02 | Console displays input (cyan), output (text), errors (red), system messages (dim) | Frontend rendering with Tailwind color classes mapping to VIBE OS palette (v-cyan, v-text, v-red, v-dim) |
| CONSOLE-03 | Command history accessible via up/down arrow keys | Frontend state array with index pointer in Zustand console slice |
| EDIT-01 | Monaco editor opens Python files with syntax highlighting using custom VIBE OS dark theme | @monaco-editor/react with beforeMount for defineTheme, language="python", IStandaloneThemeData format |
| EDIT-02 | File tabs with close buttons; closing disposes Monaco model (no memory leaks) | Manual model management via monaco.editor.createModel() / model.dispose(), NOT the path prop |
| EDIT-03 | Save file to disk via Ctrl+S, triggers audit log entry | Rust command for file write + audit log insert in same transaction; frontend keydown handler |
| PLAT-04 | Default skill .md files bundled and copied to ~/.vibe-os/skills/ on first launch | Tauri resource bundling in tauri.conf.json + Rust setup() copy logic checking if target dir is empty |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @monaco-editor/react | ^4.7.0 | React wrapper for Monaco Editor | De facto standard for Monaco in React; handles mounting/unmounting, exposes beforeMount/onMount hooks |
| monaco-editor | ^0.52.0 | Monaco Editor core (local bundling) | Required for offline/desktop usage; @monaco-editor/react loads from CDN by default which fails offline |
| @tauri-apps/plugin-shell | ^2.3.5 (already installed) | Subprocess spawn + stdin/stdout | Already used in Phase 1; provides Command.create(), Child.write(), stdout/stderr events |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-fs | ^2.x | File read/write from frontend | OPTIONAL: only if preferring frontend file I/O over Rust commands. Recommendation: use Rust commands instead |
| tauri-plugin-fs (Rust) | 2.x | Rust-side fs plugin | OPTIONAL: same trade-off. Standard Rust std::fs already works in #[tauri::command] functions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rust commands for file I/O | @tauri-apps/plugin-fs from frontend | Plugin approach is simpler for pure read/write, but Rust commands let us audit-log in the same call and keep the pattern consistent with all other backend operations |
| Manual model management | @monaco-editor/react `path` prop | The `path` prop auto-creates models but does NOT auto-dispose them; manual management gives explicit control over memory and is needed for the close-tab-disposes-model requirement |
| loader.config({ monaco }) | CDN (default) or vite-plugin-monaco-editor | CDN fails offline/in Tauri; vite plugin adds complexity. Direct import is simplest for Vite |

**Installation:**
```bash
npm install @monaco-editor/react monaco-editor
```

No Rust crate additions needed -- tauri-plugin-shell already in Cargo.toml. If using fs plugin from frontend, add `tauri-plugin-fs` to Cargo.toml and `@tauri-apps/plugin-fs` to package.json. Recommendation: skip the fs plugin and use Rust std::fs in commands.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    center/
      CodeEditor.tsx       # Monaco editor wrapper with tab management
      Console.tsx          # Python REPL component
      EditorTabs.tsx       # File tab strip with close buttons (or inline in CodeEditor)
  hooks/
    usePythonProcess.ts    # Python subprocess lifecycle hook
  stores/
    slices/
      editorSlice.ts       # Open files, active file, file contents
      consoleSlice.ts      # REPL history, input history, process state
  lib/
    monacoTheme.ts         # VIBE OS Monaco theme definition (IStandaloneThemeData)
    monacoSetup.ts         # loader.config() call -- must run before Editor mounts
    tauri.ts               # Add new command wrappers: readFile, writeFile, logAudit

src-tauri/
  src/
    commands/
      file_commands.rs     # read_file, write_file (or add to existing module)
      audit_commands.rs    # log_action, get_audit_log
    db.rs                  # Migration v3: audit_log table
  skills/                  # Default skill .md files to bundle
```

### Pattern 1: Monaco Local Bundling (Critical for Tauri Desktop)
**What:** Configure @monaco-editor/react to load monaco-editor from node_modules instead of CDN
**When to use:** Always -- Tauri apps may not have internet access, and CDN loading adds latency
**Example:**
```typescript
// src/lib/monacoSetup.ts -- import BEFORE any Editor component renders
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

loader.config({ monaco });
```
```typescript
// src/main.tsx -- import setup before App
import './lib/monacoSetup';
import { StrictMode } from 'react';
// ...
```
**Confidence:** HIGH -- documented in @monaco-editor/react README, works with Vite's ESM bundling

### Pattern 2: Monaco Custom Theme via beforeMount
**What:** Define and register a custom Monaco theme using IStandaloneThemeData before the editor mounts
**When to use:** Every time an Editor component mounts for the first time
**Example:**
```typescript
// src/lib/monacoTheme.ts
import type { editor } from 'monaco-editor';

export const VIBE_OS_THEME: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '5a6080', fontStyle: 'italic' },
    { token: 'keyword', foreground: '5b7cfa', fontStyle: 'bold' },
    { token: 'string', foreground: '34d399' },
    { token: 'number', foreground: 'fbbf24' },
    { token: 'type', foreground: '22d3ee' },
    { token: 'function', foreground: '7d9bff' },
    { token: 'variable', foreground: 'b8bdd4' },
    { token: 'operator', foreground: 'e1e4f0' },
    { token: 'delimiter', foreground: '5a6080' },
    { token: 'string.escape', foreground: 'f97316' },
  ],
  colors: {
    'editor.background': '#12141c',          // v-surface
    'editor.foreground': '#b8bdd4',          // v-text
    'editor.lineHighlightBackground': '#181b26', // v-surfaceHi
    'editor.selectionBackground': '#2a3466',  // accentDim
    'editorCursor.foreground': '#5b7cfa',     // v-accent
    'editorWhitespace.foreground': '#232738', // v-border
    'editorWidget.background': '#12141c',     // v-surface
    'editorWidget.border': '#232738',         // v-border
    'editor.lineHighlightBorder': '#00000000', // transparent
    'editorLineNumber.foreground': '#5a6080', // v-dim
    'editorLineNumber.activeForeground': '#b8bdd4', // v-text
    'editorIndentGuide.background': '#232738', // v-border (deprecated key, still works)
    'editorGutter.background': '#0c0e14',    // v-bgAlt
    'minimap.background': '#0c0e14',         // v-bgAlt
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#2e334766',
    'scrollbarSlider.hoverBackground': '#5a608066',
    'scrollbarSlider.activeBackground': '#5b7cfa66',
  },
};

export const VIBE_OS_THEME_NAME = 'vibe-os-dark';
```
```typescript
// In CodeEditor.tsx
import { Editor, type Monaco } from '@monaco-editor/react';
import { VIBE_OS_THEME, VIBE_OS_THEME_NAME } from '../../lib/monacoTheme';

function handleBeforeMount(monaco: Monaco) {
  monaco.editor.defineTheme(VIBE_OS_THEME_NAME, VIBE_OS_THEME);
}

<Editor
  beforeMount={handleBeforeMount}
  theme={VIBE_OS_THEME_NAME}
  language="python"
  options={{
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 20,
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    padding: { top: 8 },
    renderWhitespace: 'selection',
  }}
/>
```
**Confidence:** HIGH -- IStandaloneThemeData is the official Monaco API, beforeMount is the documented hook in @monaco-editor/react

### Pattern 3: Multi-Tab Model Management (Memory-Safe)
**What:** Create Monaco models explicitly per file, dispose on tab close, save/restore view state on tab switch
**When to use:** Whenever opening, switching, or closing file tabs
**Example:**
```typescript
// Model lifecycle in editor store/component
import * as monaco from 'monaco-editor';

// Open file -- create model
function openFile(filePath: string, content: string, language: string) {
  const uri = monaco.Uri.parse(`file://${filePath}`);
  // Check if model already exists (file already open)
  let model = monaco.editor.getModel(uri);
  if (!model) {
    model = monaco.editor.createModel(content, language, uri);
  }
  return model;
}

// Switch tab -- save old view state, set new model, restore view state
function switchTab(editor: monaco.editor.IStandaloneCodeEditor, newModel: monaco.editor.ITextModel) {
  // Save current state
  const currentModel = editor.getModel();
  if (currentModel) {
    viewStates.set(currentModel.uri.toString(), editor.saveViewState());
  }
  // Switch
  editor.setModel(newModel);
  // Restore
  const savedState = viewStates.get(newModel.uri.toString());
  if (savedState) {
    editor.restoreViewState(savedState);
  }
}

// Close tab -- dispose model
function closeTab(filePath: string) {
  const uri = monaco.Uri.parse(`file://${filePath}`);
  const model = monaco.editor.getModel(uri);
  if (model) {
    model.dispose(); // Frees memory -- required for EDIT-02
  }
  viewStates.delete(uri.toString());
}
```
**Confidence:** HIGH -- this is the standard Monaco multi-model pattern documented in official samples and GitHub issues

### Pattern 4: Python Subprocess via Tauri Shell Plugin
**What:** Spawn a persistent Python REPL using Command.create() + spawn(), write to stdin, read streaming stdout/stderr
**When to use:** When starting the Python console
**Example:**
```typescript
import { Command } from '@tauri-apps/plugin-shell';

// Detect platform for python command name
const isWindows = navigator.userAgent.includes('Windows');
const pythonCmd = isWindows ? 'run-python-win' : 'run-python';

// Create command with unbuffered (-u) interactive (-i) flags
const command = Command.create(pythonCmd, ['-u', '-i']);

// Register output handlers BEFORE spawn
command.stdout.on('data', (line: string) => {
  // Python stdout -- add to console output
  addConsoleEntry({ type: 'output', text: line });
});

command.stderr.on('data', (line: string) => {
  // Python stderr -- includes prompts (>>>, ...) AND errors
  // Python interactive mode sends prompts to stderr
  if (line.startsWith('>>>') || line.startsWith('...')) {
    // System prompt -- dim
    addConsoleEntry({ type: 'system', text: line });
  } else if (line.startsWith('Traceback') || line.startsWith('  File') || /Error:/.test(line)) {
    addConsoleEntry({ type: 'error', text: line });
  } else {
    addConsoleEntry({ type: 'error', text: line });
  }
});

command.on('close', (payload) => {
  addConsoleEntry({ type: 'system', text: `Python process exited (code ${payload.code})` });
});

command.on('error', (error) => {
  addConsoleEntry({ type: 'error', text: `Process error: ${error}` });
});

// Spawn -- returns Child handle
const child = await command.spawn();

// Write to stdin -- MUST include newline
await child.write(`print("Hello from VIBE OS")\n`);

// Kill when done
await child.kill();
```
**Confidence:** HIGH -- directly from Tauri v2 shell plugin API reference; scope names `run-python` and `run-python-win` already configured in capabilities/default.json

### Pattern 5: Audit Log Schema + Command
**What:** Add audit_log table via migration v3, expose log_action and get_audit_log commands
**When to use:** Every action that needs tracking -- file saves are the Phase 4 trigger
**Example (Rust):**
```rust
// Migration v3 in db.rs
if version < 3 {
    conn.execute_batch(
        "BEGIN;
         CREATE TABLE IF NOT EXISTS audit_log (
             id TEXT PRIMARY KEY,
             session_id TEXT NOT NULL,
             timestamp TEXT NOT NULL,
             action_type TEXT NOT NULL,
             detail TEXT NOT NULL,
             actor TEXT NOT NULL,
             metadata TEXT,
             FOREIGN KEY (session_id) REFERENCES sessions(id)
         );
         PRAGMA user_version = 3;
         COMMIT;",
    )
    .map_err(|e| format!("Migration v3 failed: {}", e))?;
}
```
```rust
// In audit_commands.rs
#[tauri::command]
pub fn log_action(
    state: State<'_, DbState>,
    action_type: String,
    detail: String,
    actor: String,
    metadata: Option<String>,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| format!("DB lock: {}", e))?;
    // Get active session ID
    let session_id: String = conn.query_row(
        "SELECT id FROM sessions WHERE active = 1 LIMIT 1",
        [],
        |row| row.get(0),
    ).map_err(|e| format!("No active session: {}", e))?;

    let id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO audit_log (id, session_id, timestamp, action_type, detail, actor, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, session_id, timestamp, action_type, detail, actor, metadata],
    ).map_err(|e| format!("Audit log insert failed: {}", e))?;
    Ok(())
}
```
**Confidence:** HIGH -- follows exact pattern from existing db_commands.rs and the build spec's schema definition

### Pattern 6: Tauri Resource Bundling for Default Skills
**What:** Bundle .md skill files with the app binary and copy to ~/.vibe-os/skills/ on first launch
**When to use:** App startup in setup()
**Example (tauri.conf.json):**
```json
{
  "bundle": {
    "resources": {
      "skills/*.md": "skills/"
    }
  }
}
```
```rust
// In lib.rs setup()
use tauri::Manager;
use tauri::path::BaseDirectory;

.setup(|app| {
    // ... existing DB setup ...

    // Copy bundled skills to ~/.vibe-os/skills/ on first launch
    let home = dirs::home_dir().expect("Cannot determine home directory");
    let skills_dir = home.join(".vibe-os").join("skills");
    if !skills_dir.exists() || std::fs::read_dir(&skills_dir).map(|d| d.count()).unwrap_or(0) == 0 {
        std::fs::create_dir_all(&skills_dir).expect("Failed to create skills dir");
        // Resolve bundled resource path
        let resource_dir = app.path().resolve("skills", BaseDirectory::Resource)
            .expect("Failed to resolve skills resource dir");
        if resource_dir.exists() {
            for entry in std::fs::read_dir(&resource_dir).expect("read bundled skills") {
                if let Ok(entry) = entry {
                    let dest = skills_dir.join(entry.file_name());
                    std::fs::copy(entry.path(), &dest).ok();
                }
            }
        }
    }
    Ok(())
})
```
**Confidence:** MEDIUM -- Tauri v2 resource bundling is documented but the exact resolve path format may need testing. The `BaseDirectory::Resource` enum maps to `$RESOURCE` and should work.

### Anti-Patterns to Avoid
- **CDN loading in desktop app:** `@monaco-editor/react` defaults to loading from CDN (jsdelivr). This will fail when offline and adds unnecessary latency. Always configure local loading.
- **Using `path` prop for tab switching:** The `path` prop creates models but never disposes them. For the close-tab-disposes-model requirement, manual model management is necessary.
- **Blocking reads on Python stdout:** Python interactive mode is line-buffered on stdout but sends prompts (`>>>`) to stderr. If you only listen on stdout, you'll miss the REPL prompt. Always handle both stdout AND stderr.
- **Forgetting newlines in stdin writes:** `child.write('print(1)')` will not execute -- Python needs `'print(1)\n'` with a trailing newline.
- **Creating models without checking for existing ones:** Always call `monaco.editor.getModel(uri)` before `createModel()` to avoid duplicate model errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code editor with syntax highlighting | Custom textarea + regex tokenizer | Monaco Editor via @monaco-editor/react | Monaco includes Python tokenization, autocomplete, bracket matching, minimap, scroll sync, and 100+ features |
| Python subprocess management | Raw Rust std::process::Command | Tauri shell plugin Command.create() | Tauri's security model requires scoped commands; raw process doesn't integrate with the event system |
| Editor theme token rules | Manual CSS class injection | Monaco IStandaloneThemeData | Monaco's theme system handles all 120+ editor color zones and token scope matching |
| View state preservation | Manual cursor/scroll position tracking | editor.saveViewState() / restoreViewState() | Monaco's built-in view state captures cursor, selection, scroll, folding -- everything |
| File tab close + cleanup | Just hide the tab | model.dispose() | Monaco models accumulate in memory if not disposed; each holds full text content + undo history |

**Key insight:** Monaco Editor is a complete code editor engine. Its internal APIs for model management, theme definition, and view state are battle-tested (used by VS Code). Fighting against these APIs by hand-rolling alternatives leads to bugs and memory leaks.

## Common Pitfalls

### Pitfall 1: Monaco Worker Loading Failures in Vite
**What goes wrong:** Monaco uses Web Workers for syntax highlighting. In Vite's ESM mode, worker loading can fail with "Could not resolve monaco-editor/esm/vs/editor/editor.worker" errors.
**Why it happens:** Vite handles workers differently than webpack. The default Monaco worker resolution path doesn't match Vite's module system.
**How to avoid:** Use `loader.config({ monaco })` with direct import of the `monaco-editor` package. This bypasses the AMD loader entirely and uses Vite's ESM bundling. No vite-plugin-monaco-editor needed.
**Warning signs:** "Loading..." spinner never resolves in the Editor component; console errors mentioning workers.

### Pitfall 2: Python Prompts on stderr
**What goes wrong:** The Python REPL prompt (`>>>`, `...`) appears on stderr, not stdout. If you only parse stderr as "errors", your console shows false error indicators for normal prompts.
**Why it happens:** Python's interactive interpreter writes prompts to stderr by design (so stdout can be piped cleanly).
**How to avoid:** Classify stderr lines: lines matching `>>>` or `...` are system prompts (dim); lines containing `Traceback`, `Error:`, or indented `File "..."` are actual errors (red); everything else from stderr is also likely error-related.
**Warning signs:** Red-colored `>>>` prompts; missing prompt display.

### Pitfall 3: Monaco Model Leak on Tab Close
**What goes wrong:** Closing a file tab removes it from the UI but the Monaco model stays in memory, holding the entire file content plus undo/redo history.
**Why it happens:** Monaco models persist in the global model registry until explicitly disposed. Neither React component unmounting nor `editor.setModel(null)` disposes models.
**How to avoid:** On tab close, explicitly call `model.dispose()` for the closed tab's model. Track models by URI in a Map for easy lookup.
**Warning signs:** Memory usage grows with each open/close cycle; `monaco.editor.getModels()` returns more models than open tabs.

### Pitfall 4: Stale View State After Model Disposal
**What goes wrong:** Switching to a tab whose model was disposed (e.g., closed then reopened) causes an error or shows stale content.
**Why it happens:** The view state references the old model. Restoring it on a new model can fail.
**How to avoid:** When disposing a model, also delete its entry from the view state map. When reopening a file, create a fresh model and don't attempt to restore old view state.
**Warning signs:** Editor shows wrong content after reopening a file; restoreViewState() throws.

### Pitfall 5: Python Subprocess Not Terminating on App Close
**What goes wrong:** The Python process keeps running as an orphan after the Tauri app closes.
**Why it happens:** `child.kill()` must be called explicitly. If the app crashes or the user force-quits, the cleanup doesn't run.
**How to avoid:** Call `child.kill()` in the component's cleanup (useEffect return). Also handle the Tauri window close event to kill the process. The Tauri shell plugin should handle this on normal exit, but be defensive.
**Warning signs:** `python` processes linger in task manager after app close.

### Pitfall 6: File Save Race Condition with Audit Log
**What goes wrong:** File save succeeds but audit log entry fails (or vice versa), leaving inconsistent state.
**Why it happens:** If file write and audit log insert are separate commands, one can fail independently.
**How to avoid:** Combine file write + audit log insert in a single Rust command. The file write uses std::fs::write, then the audit entry is inserted in the same function. If either fails, the command returns an error.
**Warning signs:** Audit log missing entries for saves that actually happened; saves failing because audit insert failed.

## Code Examples

### Complete Monaco Setup for Tauri (Offline)
```typescript
// src/lib/monacoSetup.ts
// MUST be imported before any @monaco-editor/react component renders
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

// Configure loader to use local monaco-editor package instead of CDN
// This is critical for Tauri desktop apps that may be offline
loader.config({ monaco });
```

### File Read/Write via Rust Commands
```rust
// src-tauri/src/commands/file_commands.rs
use std::fs;
use std::sync::Mutex;
use rusqlite::Connection;
use tauri::State;

type DbState = Mutex<Connection>;

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
pub fn write_file(
    state: State<'_, DbState>,
    path: String,
    content: String,
) -> Result<(), String> {
    // Write file
    fs::write(&path, &content)
        .map_err(|e| format!("Failed to write {}: {}", path, e))?;

    // Log to audit trail
    let conn = state.lock().map_err(|e| format!("DB lock: {}", e))?;
    let session_id: Result<String, _> = conn.query_row(
        "SELECT id FROM sessions WHERE active = 1 LIMIT 1",
        [],
        |row| row.get(0),
    );
    if let Ok(sid) = session_id {
        let id = uuid::Uuid::new_v4().to_string();
        let ts = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO audit_log (id, session_id, timestamp, action_type, detail, actor, metadata)
             VALUES (?1, ?2, ?3, 'FILE_MODIFY', ?4, 'user', NULL)",
            rusqlite::params![id, sid, ts, format!("Saved file: {}", path)],
        ).ok(); // Don't fail the save if audit insert fails
    }
    Ok(())
}
```

### Console Entry Types
```typescript
// src/stores/types.ts additions
export interface ConsoleEntry {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
  timestamp: number;
}

export interface ConsoleSlice {
  entries: ConsoleEntry[];
  inputHistory: string[];
  historyIndex: number;
  pythonRunning: boolean;
  addEntry: (entry: Omit<ConsoleEntry, 'id' | 'timestamp'>) => void;
  pushHistory: (cmd: string) => void;
  navigateHistory: (direction: 'up' | 'down') => string | null;
  setPythonRunning: (running: boolean) => void;
  clearEntries: () => void;
}

export interface EditorFile {
  path: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
}

export interface EditorSlice {
  openFiles: EditorFile[];
  activeFilePath: string | null;
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  markClean: (path: string) => void;
}
```

### Python Process Hook
```typescript
// src/hooks/usePythonProcess.ts
import { useRef, useCallback } from 'react';
import { Command, type Child } from '@tauri-apps/plugin-shell';
import { useAppStore } from '../stores';

export function usePythonProcess() {
  const childRef = useRef<Child | null>(null);
  const addEntry = useAppStore((s) => s.addEntry);
  const setPythonRunning = useAppStore((s) => s.setPythonRunning);

  const start = useCallback(async () => {
    if (childRef.current) return; // Already running

    const isWindows = navigator.userAgent.includes('Windows')
      || navigator.platform.includes('Win');
    const cmd = isWindows ? 'run-python-win' : 'run-python';

    const command = Command.create(cmd, ['-u', '-i']);

    command.stdout.on('data', (line) => {
      addEntry({ type: 'output', text: line });
    });

    command.stderr.on('data', (line) => {
      if (/^(>>>|\.\.\.)\s?/.test(line)) {
        addEntry({ type: 'system', text: line });
      } else {
        addEntry({ type: 'error', text: line });
      }
    });

    command.on('close', () => {
      childRef.current = null;
      setPythonRunning(false);
      addEntry({ type: 'system', text: 'Python process exited' });
    });

    command.on('error', (err) => {
      addEntry({ type: 'error', text: `Process error: ${err}` });
    });

    const child = await command.spawn();
    childRef.current = child;
    setPythonRunning(true);
    addEntry({ type: 'system', text: 'Python REPL started' });
  }, [addEntry, setPythonRunning]);

  const send = useCallback(async (input: string) => {
    if (!childRef.current) return;
    addEntry({ type: 'input', text: input });
    await childRef.current.write(input + '\n');
  }, [addEntry]);

  const kill = useCallback(async () => {
    if (!childRef.current) return;
    await childRef.current.kill();
    childRef.current = null;
    setPythonRunning(false);
  }, [setPythonRunning]);

  return { start, send, kill };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @monaco-editor/react CDN loading | loader.config({ monaco }) for local bundling | v4.4.0 (~2023) | Desktop apps can work offline; eliminates CDN dependency |
| Webpack MonacoWebpackPlugin | Direct ESM import + loader.config | Vite ecosystem matured | No need for webpack-specific plugins in Vite projects |
| Tauri v1 shell::Command::new | Tauri v2 @tauri-apps/plugin-shell Command.create() | Tauri v2 (2024) | Scoped permissions, security model, plugin architecture |
| Manual stdin/stdout piping | Child.write() + stdout.on('data') | Tauri v2 plugin-shell | Cleaner API, integrated with Tauri event system |

**Deprecated/outdated:**
- `monaco.init()` from early @monaco-editor/react versions -- replaced by `loader` API
- `tauri.promisified` from Tauri v1 -- replaced by `@tauri-apps/api/core` invoke
- webpack-specific Monaco worker plugins -- unnecessary with Vite + loader.config approach

## Open Questions

1. **Python command name on various platforms**
   - What we know: Windows uses `python`, macOS/Linux typically use `python3`. The shell scope already has both `run-python` (python3) and `run-python-win` (python).
   - What's unclear: Some Windows installations have `python3` available too. The detection logic (`navigator.userAgent.includes('Windows')`) may not cover all cases.
   - Recommendation: Try `run-python-win` first on Windows, fall back to `run-python` if it fails. On non-Windows, try `run-python` first. This matches the existing capabilities.

2. **Monaco ESM worker issues in Tauri webview**
   - What we know: `loader.config({ monaco })` bypasses the AMD loader and uses Vite's ESM bundling. This should work fine.
   - What's unclear: Whether Tauri's webview (WebView2 on Windows, WebKit on macOS/Linux) has any specific Web Worker restrictions that could affect Monaco.
   - Recommendation: Test early in development. If workers fail, fall back to `loader.config({ paths: { vs: '/node_modules/monaco-editor/min/vs' } })` with files in the public folder. LOW risk based on community reports of Monaco working in Tauri.

3. **Tauri resource path resolution on all platforms**
   - What we know: `app.path().resolve("skills", BaseDirectory::Resource)` should resolve to the bundled resources directory.
   - What's unclear: Exact path format on Windows vs macOS vs Linux. The documentation shows it works but platform-specific edge cases exist.
   - Recommendation: Test the resource bundling path on the primary dev platform (Windows based on the env). Add error logging if resolution fails.

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Shell Plugin docs](https://v2.tauri.app/plugin/shell/) -- Command.create(), spawn(), Child.write(), stdout/stderr events
- [Tauri v2 Shell JS API reference](https://v2.tauri.app/reference/javascript/shell/) -- Complete TypeScript type definitions for Command, Child, SpawnOptions, CommandEvents
- [Tauri v2 Resource Embedding](https://v2.tauri.app/develop/resources/) -- bundle.resources config, PathResolver.resolve() with BaseDirectory::Resource
- [Tauri v2 File System plugin](https://v2.tauri.app/plugin/file-system/) -- readTextFile, writeTextFile, scope permissions
- [Monaco Editor API - IStandaloneThemeData](https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IStandaloneThemeData.html) -- Theme definition interface
- [Monaco Editor theme colors gist](https://gist.github.com/NeuroNexul/7db6741e8c006159727f26a0fbddf10a) -- Complete list of 120+ color keys

### Secondary (MEDIUM confidence)
- [@monaco-editor/react GitHub](https://github.com/suren-atoyan/monaco-react) -- loader.config(), path prop, beforeMount, multi-model tabs
- [Monaco-react issue #12](https://github.com/suren-atoyan/monaco-react/issues/12) -- Loading from node_modules
- [Monaco-react issue #148](https://github.com/suren-atoyan/monaco-react/issues/148) -- Multi-file tabs implementation pattern
- [Monaco-react issue #40](https://github.com/suren-atoyan/monaco-react/issues/40) -- Offline/no-CDN usage
- [Offline Monaco in Electron](https://www.jameskerr.blog/posts/offline-monaco-editor-in-electron/) -- Desktop app patterns (applies to Tauri)
- [Tauri discussion #1645](https://github.com/tauri-apps/tauri/discussions/1645) -- Python execution patterns

### Tertiary (LOW confidence)
- Python interactive mode stderr behavior -- based on known Python interpreter behavior and community discussion, not officially documented in Tauri context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- @monaco-editor/react and tauri-plugin-shell are well-documented, widely used, and version-pinnable
- Architecture: HIGH -- patterns follow official docs and existing project conventions
- Pitfalls: HIGH -- identified from documented issues (Monaco workers in Vite, Python stderr prompts, model disposal)
- Resource bundling: MEDIUM -- documented in Tauri docs but platform-specific resolution may need runtime testing
- Monaco local loading in Tauri specifically: MEDIUM -- documented for Vite and Electron; Tauri webview should behave similarly but not explicitly tested in sources

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable libraries, 30-day validity)
