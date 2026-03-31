# Home Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the VIBE OS home screen with a project setup flow, local/GitHub batch repo adding, agent capture, unified resource panel, and light/dark themes.

**Architecture:** Six phases building bottom-up: (1) theme system (CSS-only, no component changes), (2) data layer (new slices + Rust commands for agents and global repos), (3) home screen + project setup view, (4) repo adding (browse/GitHub/drag-drop), (5) agent capture flow, (6) unified resource panel in settings drawer.

**Tech Stack:** React 18, TypeScript 5.5, Zustand 5, Tailwind CSS 4 (CSS variable theming), Tauri 2 (Rust backend), `@tauri-apps/plugin-dialog` for file picker.

---

## File Structure

### New Files
- `src/stores/slices/themeSlice.ts` — theme state + persistence
- `src/stores/slices/agentDefinitionSlice.ts` — saved agent definitions CRUD
- `src/stores/slices/globalRepoSlice.ts` — global repo catalog CRUD
- `src/components/home/ProjectSetupView.tsx` — project name/description + resource catalog
- `src/components/home/ResourceCatalog.tsx` — repos/skills/agents checkbox panel (reused in setup + settings)
- `src/components/home/ResourceSection.tsx` — collapsible section wrapper
- `src/components/home/RepoBrowseModal.tsx` — local folder picker with preview
- `src/components/home/RepoGithubModal.tsx` — batch GitHub URL input
- `src/components/home/RepoDropZone.tsx` — drag & drop zone for folders
- `src/components/conversation/AgentCaptureCard.tsx` — inline chat card for agent-spawn events
- `src/components/conversation/AgentSaveDialog.tsx` — editable agent definition form
- `src/components/shared/ThemeToggle.tsx` — pill toggle for title bar
- `src-tauri/src/commands/agent_commands.rs` — Rust commands for agent .md files

### Modified Files
- `src/globals.css` — add `[data-theme="light"]` variable overrides
- `src/stores/types.ts` — add `ThemeSlice`, `AgentDefinitionSlice`, `GlobalRepoSlice`, extend `Project`, extend `ViewMode`
- `src/stores/index.ts` — compose new slices, re-export new types
- `src/lib/tauri.ts` — add command wrappers for agent + directory picker commands
- `src/components/home/HomeScreen.tsx` — simplified grid, delegate to ProjectSetupView
- `src/components/home/EnhancedProjectCard.tsx` — add resource summary chips
- `src/components/home/NewProjectCard.tsx` — simplified to trigger setup view
- `src/components/layout/MainLayout.tsx` — handle `"project-setup"` view
- `src/components/layout/TitleBar.tsx` — add ThemeToggle
- `src/components/panels/RepoManager.tsx` — replace with ResourceCatalog import
- `src/components/panels/SkillsPanel.tsx` — merge into ResourceCatalog
- `src-tauri/src/commands/mod.rs` — register agent_commands module
- `src-tauri/src/lib.rs` — register new commands in invoke_handler

---

## Task 1: Light/Dark Theme CSS Variables

**Files:**
- Modify: `src/globals.css`

- [ ] **Step 1: Add light theme variable overrides**

Add after the closing `}` of the `@theme` block (after line 49):

```css
/* ── Light Theme Overrides ── */
[data-theme="light"] {
  --color-v-bg: #f8f9fc;
  --color-v-bgAlt: #f0f1f6;
  --color-v-surface: #ffffff;
  --color-v-surfaceHi: #f5f6fa;
  --color-v-border: #e2e5f0;
  --color-v-borderHi: #d0d4e4;
  --color-v-text: #3a3f56;
  --color-v-textHi: #1e2236;
  --color-v-dim: #a0a6c0;
  --color-v-accent: #4a66d9;
  --color-v-accentHi: #3a54c4;
  --color-v-green: #16a34a;
  --color-v-greenDim: #dcfce7;
  --color-v-red: #dc2626;
  --color-v-redDim: #fee2e2;
  --color-v-orange: #d97706;
  --color-v-orangeDim: #fef3c7;
  --color-v-cyan: #0ea5ba;
  --color-v-cyanDim: #cffafe;
}

[data-theme="light"] ::-webkit-scrollbar-thumb {
  background: var(--color-v-borderHi);
}

[data-theme="light"] ::-webkit-scrollbar-thumb:hover {
  background: var(--color-v-dim);
}
```

- [ ] **Step 2: Verify visually**

Run: `npm run tauri dev`

Open the app. In the browser DevTools console, run:
```js
document.documentElement.setAttribute('data-theme', 'light')
```

Verify all surfaces, text, and borders switch to light colors. Run again with `'dark'` to revert. No component code was touched — everything responds via CSS variables.

- [ ] **Step 3: Commit**

```bash
git add src/globals.css
git commit -m "feat: add light theme CSS variable overrides"
```

---

## Task 2: Theme Slice + ThemeToggle Component

**Files:**
- Modify: `src/stores/types.ts`
- Create: `src/stores/slices/themeSlice.ts`
- Modify: `src/stores/index.ts`
- Create: `src/components/shared/ThemeToggle.tsx`
- Modify: `src/components/layout/TitleBar.tsx`

- [ ] **Step 1: Add ThemeSlice type**

In `src/stores/types.ts`, add after the `DashboardSlice` interface (after line 412):

```typescript
// ── Theme Types ──

export type Theme = "light" | "dark";

export interface ThemeSlice {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}
```

Update the `AppState` type to include `ThemeSlice`:

```typescript
export type AppState = SessionSlice &
  RepoSlice &
  SkillSlice &
  PromptSlice &
  EditorSlice &
  ConsoleSlice &
  AgentSlice &
  DecisionSlice &
  AuditSlice &
  DiffSlice &
  PreviewSlice &
  WorkspaceSlice &
  LayoutSlice &
  DashboardSlice &
  TokenSlice &
  ProjectSlice &
  ThemeSlice;
```

- [ ] **Step 2: Create themeSlice**

Create `src/stores/slices/themeSlice.ts`:

```typescript
import type { SliceCreator, ThemeSlice } from "../types";
import { commands } from "../../lib/tauri";

const THEME_SETTING_KEY = "theme";

export const createThemeSlice: SliceCreator<ThemeSlice> = (set) => {
  // Load theme from settings on init and apply before first render
  commands.getSetting(THEME_SETTING_KEY).then((saved) => {
    const theme = saved === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  }).catch(() => {});

  return {
    theme: "dark",

    setTheme: (theme) => {
      document.documentElement.setAttribute("data-theme", theme);
      set({ theme });
      commands.saveSetting(THEME_SETTING_KEY, theme).catch(() => {});
    },
  };
};
```

- [ ] **Step 3: Compose into store**

In `src/stores/index.ts`, add import:

```typescript
import { createThemeSlice } from "./slices/themeSlice";
```

Add to the store composition (inside the `persist((...a) => ({` block):

```typescript
      ...createThemeSlice(...a),
```

Add to the re-exports:

```typescript
export type { Theme, ThemeSlice } from "./types";
```

- [ ] **Step 4: Create ThemeToggle component**

Create `src/components/shared/ThemeToggle.tsx`:

```typescript
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
```

- [ ] **Step 5: Add ThemeToggle to TitleBar**

In `src/components/layout/TitleBar.tsx`, add import:

```typescript
import { ThemeToggle } from "../shared/ThemeToggle";
```

In the TitleBar JSX, add `<ThemeToggle />` inside the right-side `div` (before the attention badge button, around line 102):

```tsx
      {/* Right: Theme + Attention Badge + Window Controls */}
      <div className="flex items-center gap-1">
        <ThemeToggle />
        {attentionCount > 0 && (
```

- [ ] **Step 6: Run and verify**

Run: `npm run tauri dev`

Click the sun/moon toggle in the title bar. Verify:
- Entire app switches between dark and light
- Refreshing preserves the selected theme
- Toggle works from both home and conversation views

- [ ] **Step 7: Commit**

```bash
git add src/stores/types.ts src/stores/slices/themeSlice.ts src/stores/index.ts src/components/shared/ThemeToggle.tsx src/components/layout/TitleBar.tsx
git commit -m "feat: add light/dark theme toggle with persistence"
```

---

## Task 3: Agent Definition Rust Commands

**Files:**
- Create: `src-tauri/src/commands/agent_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Create agent_commands.rs**

Create `src-tauri/src/commands/agent_commands.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentDefinition {
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub tools: Vec<String>,
    pub created_at: String,
    pub source_session_id: String,
}

fn agents_dir() -> PathBuf {
    let home = dirs::home_dir().expect("Cannot determine home directory");
    home.join(".vibe-os").join("agents")
}

#[tauri::command]
pub fn save_agent_definition(
    name: String,
    description: String,
    system_prompt: String,
    tools: Vec<String>,
    source_session_id: String,
) -> Result<AgentDefinition, String> {
    let dir = agents_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let safe_name = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>();
    let file_path = dir.join(format!("{}.md", safe_name));

    let created_at = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let tools_str = tools.join(", ");

    let content = format!(
        "---\nname: {}\ndescription: {}\ntools: [{}]\ncreated: {}\nsource_session: {}\n---\n\n{}",
        name, description, tools_str, created_at, source_session_id, system_prompt
    );

    std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;

    Ok(AgentDefinition {
        name,
        description,
        system_prompt,
        tools,
        created_at,
        source_session_id,
    })
}

#[tauri::command]
pub fn load_agent_definitions() -> Result<Vec<AgentDefinition>, String> {
    let dir = agents_dir();
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut agents = Vec::new();
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().map(|e| e == "md").unwrap_or(false) {
            let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            if let Some(agent) = parse_agent_md(&content) {
                agents.push(agent);
            }
        }
    }

    Ok(agents)
}

#[tauri::command]
pub fn remove_agent_definition(name: String) -> Result<(), String> {
    let safe_name = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>();
    let file_path = agents_dir().join(format!("{}.md", safe_name));
    if file_path.exists() {
        std::fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn parse_agent_md(content: &str) -> Option<AgentDefinition> {
    let content = content.trim();
    if !content.starts_with("---") {
        return None;
    }

    let rest = &content[3..];
    let end = rest.find("---")?;
    let frontmatter = &rest[..end];
    let body = rest[end + 3..].trim().to_string();

    let mut name = String::new();
    let mut description = String::new();
    let mut tools = Vec::new();
    let mut created_at = String::new();
    let mut source_session_id = String::new();

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("name:") {
            name = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("description:") {
            description = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("tools:") {
            let val = val.trim().trim_start_matches('[').trim_end_matches(']');
            tools = val.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        } else if let Some(val) = line.strip_prefix("created:") {
            created_at = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("source_session:") {
            source_session_id = val.trim().to_string();
        }
    }

    if name.is_empty() {
        return None;
    }

    Some(AgentDefinition {
        name,
        description,
        system_prompt: body,
        tools,
        created_at,
        source_session_id,
    })
}
```

- [ ] **Step 2: Register module in mod.rs**

In `src-tauri/src/commands/mod.rs`, add:

```rust
pub mod agent_commands;
```

- [ ] **Step 3: Register commands in lib.rs**

In `src-tauri/src/lib.rs`, add import:

```rust
use commands::agent_commands;
```

Add to the `invoke_handler` macro (before the `// Graph commands` comment):

```rust
            agent_commands::save_agent_definition,
            agent_commands::load_agent_definitions,
            agent_commands::remove_agent_definition,
```

- [ ] **Step 4: Add TypeScript wrappers**

In `src/lib/tauri.ts`, add the type after the existing interfaces (after the `FileTreeEntry` interface, around line 100):

```typescript
export interface AgentDefinitionRaw {
  name: string;
  description: string;
  system_prompt: string;
  tools: string[];
  created_at: string;
  source_session_id: string;
}
```

Add commands inside the `commands` object (before the closing `};`):

```typescript
  // ── Agent definition commands ──
  saveAgentDefinition: (
    name: string,
    description: string,
    systemPrompt: string,
    tools: string[],
    sourceSessionId: string,
  ) =>
    invoke<AgentDefinitionRaw>("save_agent_definition", {
      name,
      description,
      systemPrompt,
      tools,
      sourceSessionId,
    }),
  loadAgentDefinitions: () =>
    invoke<AgentDefinitionRaw[]>("load_agent_definitions"),
  removeAgentDefinition: (name: string) =>
    invoke<void>("remove_agent_definition", { name }),
```

- [ ] **Step 5: Add multi-directory picker wrapper**

In `src/lib/tauri.ts`, add a new exported function after the existing `showOpenWorkspaceDialog`:

```typescript
export async function showOpenDirectoriesDialog(): Promise<string[] | null> {
  const paths = await open({
    directory: true,
    multiple: true,
    title: "Select Repositories",
  });
  if (!paths) return null;
  if (typeof paths === "string") return [paths];
  return paths;
}
```

- [ ] **Step 6: Build and verify**

Run: `npm run tauri dev`

Verify no compilation errors in both Rust and TypeScript. In the DevTools console, run:

```js
window.__TAURI__.core.invoke('load_agent_definitions')
```

Should return `[]` (empty array, no agents saved yet).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/agent_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src/lib/tauri.ts
git commit -m "feat: add Rust commands for agent definition CRUD + multi-directory picker"
```

---

## Task 4: Agent Definition Slice + Global Repo Slice

**Files:**
- Modify: `src/stores/types.ts`
- Create: `src/stores/slices/agentDefinitionSlice.ts`
- Create: `src/stores/slices/globalRepoSlice.ts`
- Modify: `src/stores/index.ts`

- [ ] **Step 1: Add types**

In `src/stores/types.ts`, add after the `ThemeSlice` interface:

```typescript
// ── Agent Definition Types ──

export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  createdAt: string;
  sourceSessionId: string;
  active: boolean;
}

export interface AgentDefinitionSlice {
  agentDefinitions: AgentDefinition[];
  agentDefinitionsLoading: boolean;
  loadAgentDefinitions: () => Promise<void>;
  saveAgentDefinition: (
    name: string,
    description: string,
    systemPrompt: string,
    tools: string[],
    sourceSessionId: string,
  ) => Promise<void>;
  removeAgentDefinition: (name: string) => Promise<void>;
  toggleAgentDefinition: (name: string) => void;
}

// ── Global Repo Types ──

export interface GlobalRepo {
  id: string;
  name: string;
  source: "local" | "github";
  path: string;
  gitUrl: string | null;
  branch: string;
  language: string;
}

export interface GlobalRepoSlice {
  globalRepos: GlobalRepo[];
  globalReposLoading: boolean;
  loadGlobalRepos: () => Promise<void>;
  addGlobalRepos: (repos: GlobalRepo[]) => Promise<void>;
  removeGlobalRepo: (id: string) => Promise<void>;
  toggleGlobalRepo: (id: string) => void;
}
```

Extend `ViewMode`:

```typescript
export type ViewMode = "home" | "conversation" | "project-setup";
```

Extend `Project`:

```typescript
export interface Project {
  id: string;
  name: string;
  workspacePath: string;
  claudeSessionId: string;
  summary: string;
  createdAt: string;
  linkedRepoIds: string[];
  linkedSkillIds: string[];
  linkedAgentNames: string[];
}
```

Update `AppState`:

```typescript
export type AppState = SessionSlice &
  RepoSlice &
  SkillSlice &
  PromptSlice &
  EditorSlice &
  ConsoleSlice &
  AgentSlice &
  DecisionSlice &
  AuditSlice &
  DiffSlice &
  PreviewSlice &
  WorkspaceSlice &
  LayoutSlice &
  DashboardSlice &
  TokenSlice &
  ProjectSlice &
  ThemeSlice &
  AgentDefinitionSlice &
  GlobalRepoSlice;
```

- [ ] **Step 2: Create agentDefinitionSlice**

Create `src/stores/slices/agentDefinitionSlice.ts`:

```typescript
import type { SliceCreator, AgentDefinitionSlice } from "../types";
import { commands } from "../../lib/tauri";

export const createAgentDefinitionSlice: SliceCreator<AgentDefinitionSlice> = (set, get) => ({
  agentDefinitions: [],
  agentDefinitionsLoading: false,

  loadAgentDefinitions: async () => {
    set({ agentDefinitionsLoading: true });
    try {
      const raw = await commands.loadAgentDefinitions();
      const defs = raw.map((r) => ({
        name: r.name,
        description: r.description,
        systemPrompt: r.system_prompt,
        tools: r.tools,
        createdAt: r.created_at,
        sourceSessionId: r.source_session_id,
        active: false,
      }));
      set({ agentDefinitions: defs });
    } catch (err) {
      console.warn("[vibe-os] Failed to load agent definitions:", err);
    } finally {
      set({ agentDefinitionsLoading: false });
    }
  },

  saveAgentDefinition: async (name, description, systemPrompt, tools, sourceSessionId) => {
    await commands.saveAgentDefinition(name, description, systemPrompt, tools, sourceSessionId);
    const def = {
      name,
      description,
      systemPrompt,
      tools,
      createdAt: new Date().toISOString().slice(0, 10),
      sourceSessionId,
      active: false,
    };
    set({ agentDefinitions: [...get().agentDefinitions, def] });
  },

  removeAgentDefinition: async (name) => {
    await commands.removeAgentDefinition(name);
    set({ agentDefinitions: get().agentDefinitions.filter((a) => a.name !== name) });
  },

  toggleAgentDefinition: (name) => {
    set({
      agentDefinitions: get().agentDefinitions.map((a) =>
        a.name === name ? { ...a, active: !a.active } : a,
      ),
    });
  },
});
```

- [ ] **Step 3: Create globalRepoSlice**

Create `src/stores/slices/globalRepoSlice.ts`:

```typescript
import type { SliceCreator, GlobalRepoSlice, GlobalRepo } from "../types";
import { commands } from "../../lib/tauri";

const GLOBAL_REPOS_KEY = "global_repos";

export const createGlobalRepoSlice: SliceCreator<GlobalRepoSlice> = (set, get) => ({
  globalRepos: [],
  globalReposLoading: false,

  loadGlobalRepos: async () => {
    set({ globalReposLoading: true });
    try {
      const raw = await commands.getSetting(GLOBAL_REPOS_KEY);
      if (raw) {
        const repos: GlobalRepo[] = JSON.parse(raw);
        set({ globalRepos: repos });
      }
    } catch {
      console.warn("[vibe-os] Failed to load global repos");
    } finally {
      set({ globalReposLoading: false });
    }
  },

  addGlobalRepos: async (repos) => {
    const existing = get().globalRepos;
    const existingIds = new Set(existing.map((r) => r.id));
    const newRepos = repos.filter((r) => !existingIds.has(r.id));
    if (newRepos.length === 0) return;

    const next = [...existing, ...newRepos];
    set({ globalRepos: next });
    commands.saveSetting(GLOBAL_REPOS_KEY, JSON.stringify(next)).catch(() => {});
  },

  removeGlobalRepo: async (id) => {
    const next = get().globalRepos.filter((r) => r.id !== id);
    set({ globalRepos: next });
    commands.saveSetting(GLOBAL_REPOS_KEY, JSON.stringify(next)).catch(() => {});
  },

  toggleGlobalRepo: (id) => {
    // no-op for global catalog — toggling is per-project context only
  },
});
```

- [ ] **Step 4: Compose into store**

In `src/stores/index.ts`, add imports:

```typescript
import { createAgentDefinitionSlice } from "./slices/agentDefinitionSlice";
import { createGlobalRepoSlice } from "./slices/globalRepoSlice";
```

Add to store composition:

```typescript
      ...createAgentDefinitionSlice(...a),
      ...createGlobalRepoSlice(...a),
```

Add to re-exports:

```typescript
export type {
  AgentDefinition,
  AgentDefinitionSlice,
  GlobalRepo,
  GlobalRepoSlice,
} from "./types";
```

- [ ] **Step 5: Update Project default in projectSlice**

In `src/stores/slices/projectSlice.ts`, update the `addProject` function's `Project` construction to include the new fields:

```typescript
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      workspacePath,
      claudeSessionId,
      summary: "",
      createdAt: new Date().toISOString(),
      linkedRepoIds: [],
      linkedSkillIds: [],
      linkedAgentNames: [],
    };
```

- [ ] **Step 6: Verify build**

Run: `npm run build`

Expected: no TypeScript errors. All new slices compose cleanly.

- [ ] **Step 7: Commit**

```bash
git add src/stores/types.ts src/stores/slices/agentDefinitionSlice.ts src/stores/slices/globalRepoSlice.ts src/stores/index.ts src/stores/slices/projectSlice.ts
git commit -m "feat: add agent definition slice, global repo slice, extend Project model"
```

---

## Task 5: Home Screen Redesign + Empty State

**Files:**
- Modify: `src/components/home/HomeScreen.tsx`
- Modify: `src/components/home/EnhancedProjectCard.tsx`
- Modify: `src/components/home/NewProjectCard.tsx`
- Modify: `src/components/layout/MainLayout.tsx`
- Modify: `src/stores/slices/projectSlice.ts`

- [ ] **Step 1: Update ViewMode and add navigation**

In `src/stores/slices/projectSlice.ts`, add `goToSetup` action. First update the `ProjectSlice` interface in `src/stores/types.ts` to add:

```typescript
  goToSetup: () => void;
```

Then in `projectSlice.ts`, add:

```typescript
  goToSetup: () => {
    set({ currentView: "project-setup" });
  },
```

- [ ] **Step 2: Simplify NewProjectCard**

Replace the full contents of `src/components/home/NewProjectCard.tsx`:

```typescript
import { Plus } from "lucide-react";

interface NewProjectCardProps {
  disabled: boolean;
  onNewProject: () => void;
}

export function NewProjectCard({ disabled, onNewProject }: NewProjectCardProps) {
  if (disabled) {
    return (
      <div
        className="border border-dashed border-v-border rounded-lg p-5 flex flex-col items-center justify-center opacity-40 cursor-not-allowed min-h-[100px]"
        title="Maximum 5 projects"
      >
        <Plus size={20} className="text-v-dim" />
        <span className="text-v-dim text-[11px] mt-1.5">Maximum reached</span>
      </div>
    );
  }

  return (
    <button
      onClick={onNewProject}
      className="border border-dashed border-v-border rounded-lg p-5 flex flex-col items-center justify-center hover:border-v-accent transition-colors cursor-pointer min-h-[100px]"
    >
      <Plus size={20} className="text-v-dim" />
      <span className="text-v-dim text-[11px] mt-1.5">New Project</span>
    </button>
  );
}
```

- [ ] **Step 3: Add resource chips to EnhancedProjectCard**

In `src/components/home/EnhancedProjectCard.tsx`, add resource summary chips after the description paragraph. Find the closing `</p>` tag for the description (line with `{project.summary || "No description"}`), and after that `</p>`, add:

```tsx
      {/* Resource summary chips */}
      <div className="flex gap-1 flex-wrap mb-2">
        {project.linkedRepoIds.length > 0 && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-v-accent/10 text-v-accent">
            {project.linkedRepoIds.length} repo{project.linkedRepoIds.length !== 1 ? "s" : ""}
          </span>
        )}
        {project.linkedSkillIds.length > 0 && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-v-cyan/10 text-v-cyan">
            {project.linkedSkillIds.length} skill{project.linkedSkillIds.length !== 1 ? "s" : ""}
          </span>
        )}
        {project.linkedAgentNames.length > 0 && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-v-orange/10 text-v-orange">
            {project.linkedAgentNames.length} agent{project.linkedAgentNames.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
```

- [ ] **Step 4: Update HomeScreen**

Replace `src/components/home/HomeScreen.tsx`:

```typescript
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { EnhancedProjectCard } from "./EnhancedProjectCard";
import { NewProjectCard } from "./NewProjectCard";
import type { ClaudeSessionState } from "../../stores/types";

export function HomeScreen() {
  const {
    projects,
    claudeSessions,
    openProject,
    setActiveClaudeSessionId,
    openWorkspace,
    goToSetup,
  } = useAppStore(
    useShallow((s) => ({
      projects: s.projects,
      claudeSessions: s.claudeSessions,
      openProject: s.openProject,
      setActiveClaudeSessionId: s.setActiveClaudeSessionId,
      openWorkspace: s.openWorkspace,
      goToSetup: s.goToSetup,
    })),
  );

  const handleOpenProject = async (project: { id: string; workspacePath: string; claudeSessionId: string }) => {
    openProject(project.id);
    setActiveClaudeSessionId(project.claudeSessionId);
    try {
      await openWorkspace(project.workspacePath);
    } catch (err) {
      console.warn("Workspace load failed, chat still works:", err);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-[360px]">
          <div className="text-4xl mb-3 opacity-25">⬡</div>
          <h2 className="text-lg font-semibold text-v-textHi mb-2">Welcome to VIBE OS</h2>
          <p className="text-[13px] text-v-dim leading-relaxed mb-6">
            Create a project to get started. You'll pick a name, link repos from your machine or GitHub, attach skills, and optionally add saved agents.
          </p>
          <button
            onClick={goToSetup}
            className="bg-v-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-v-accentHi transition-colors"
          >
            + New Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="grid grid-cols-3 gap-4 max-w-[720px] w-full">
        {projects.map((project) => {
          const projectSessions = new Map<string, ClaudeSessionState>();
          const primarySession = claudeSessions.get(project.claudeSessionId);
          if (primarySession) {
            projectSessions.set(primarySession.id, primarySession);
          }

          return (
            <EnhancedProjectCard
              key={project.id}
              project={project}
              sessions={projectSessions}
              onOpen={() => handleOpenProject(project)}
              onOpenSession={(sessionId) => {
                setActiveClaudeSessionId(sessionId);
                openProject(project.id);
              }}
            />
          );
        })}
        <NewProjectCard
          disabled={projects.length >= 5}
          onNewProject={goToSetup}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update MainLayout for project-setup view**

In `src/components/layout/MainLayout.tsx`, add the import and view:

```typescript
import { HomeScreen } from "../home/HomeScreen";
import { ProjectSetupView } from "../home/ProjectSetupView";
import { EditorPanel } from "../editor/EditorPanel";
import { QuadrantLayout } from "./QuadrantLayout";
import { useAppStore } from "../../stores";

export function MainLayout() {
  const currentView = useAppStore((s) => s.currentView);

  if (currentView === "home") {
    return (
      <div className="flex-1 overflow-hidden relative">
        <HomeScreen />
      </div>
    );
  }

  if (currentView === "project-setup") {
    return (
      <div className="flex-1 overflow-hidden relative">
        <ProjectSetupView />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden relative">
      <QuadrantLayout />
      <EditorPanel />
    </div>
  );
}
```

Note: `ProjectSetupView` will be created in the next task. For now, create a placeholder:

Create `src/components/home/ProjectSetupView.tsx`:

```typescript
export function ProjectSetupView() {
  return <div className="flex-1 flex items-center justify-center text-v-dim">Project setup (WIP)</div>;
}
```

- [ ] **Step 6: Verify**

Run: `npm run tauri dev`

Verify:
- Empty state shows welcome message with "New Project" button
- If projects exist, cards show with resource chips (empty for now — `linkedRepoIds` etc. will be `[]`)
- Clicking "New Project" navigates to the setup placeholder
- Back button in title bar returns to home

- [ ] **Step 7: Commit**

```bash
git add src/stores/types.ts src/stores/slices/projectSlice.ts src/components/home/HomeScreen.tsx src/components/home/NewProjectCard.tsx src/components/home/EnhancedProjectCard.tsx src/components/layout/MainLayout.tsx src/components/home/ProjectSetupView.tsx
git commit -m "feat: redesign home screen with empty state and project-setup view routing"
```

---

## Task 6: Resource Catalog Components

**Files:**
- Create: `src/components/home/ResourceSection.tsx`
- Create: `src/components/home/ResourceCatalog.tsx`

- [ ] **Step 1: Create ResourceSection (collapsible wrapper)**

Create `src/components/home/ResourceSection.tsx`:

```typescript
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ResourceSectionProps {
  title: string;
  count?: number;
  badge?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function ResourceSection({
  title,
  count,
  badge,
  actions,
  children,
  defaultOpen = true,
}: ResourceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-xs font-semibold text-v-text hover:text-v-textHi transition-colors"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
          {count !== undefined && (
            <span className="text-v-dim font-normal ml-1">({count})</span>
          )}
        </button>
        <div className="flex items-center gap-1">
          {badge && (
            <span className="text-[10px] text-v-dim bg-v-surface px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
          {actions}
        </div>
      </div>
      {open && children}
    </div>
  );
}
```

- [ ] **Step 2: Create ResourceCatalog**

Create `src/components/home/ResourceCatalog.tsx`:

```typescript
import { useEffect } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { ResourceSection } from "./ResourceSection";
import type { GlobalRepo, Skill, AgentDefinition } from "../../stores/types";

interface ResourceCatalogProps {
  /** Which global repo IDs are checked */
  checkedRepoIds: Set<string>;
  /** Which skill IDs are checked */
  checkedSkillIds: Set<string>;
  /** Which agent names are checked */
  checkedAgentNames: Set<string>;
  onToggleRepo: (id: string) => void;
  onToggleSkill: (id: string) => void;
  onToggleAgent: (name: string) => void;
  onAddReposLocal: () => void;
  onAddReposGithub: () => void;
}

export function ResourceCatalog({
  checkedRepoIds,
  checkedSkillIds,
  checkedAgentNames,
  onToggleRepo,
  onToggleSkill,
  onToggleAgent,
  onAddReposLocal,
  onAddReposGithub,
}: ResourceCatalogProps) {
  const {
    globalRepos,
    skills,
    agentDefinitions,
    loadGlobalRepos,
    discoverSkills,
    loadAgentDefinitions,
  } = useAppStore(
    useShallow((s) => ({
      globalRepos: s.globalRepos,
      skills: s.skills,
      agentDefinitions: s.agentDefinitions,
      loadGlobalRepos: s.loadGlobalRepos,
      discoverSkills: s.discoverSkills,
      loadAgentDefinitions: s.loadAgentDefinitions,
    })),
  );

  useEffect(() => {
    loadGlobalRepos();
    loadAgentDefinitions();
  }, [loadGlobalRepos, loadAgentDefinitions]);

  const activeSkillTokens = skills
    .filter((s) => checkedSkillIds.has(s.id))
    .reduce((sum, s) => sum + s.tokens, 0);

  const formatTokens = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-v-dim font-semibold mb-1">
        Resource Catalog
      </div>
      <div className="text-[10px] text-v-dim mb-4">
        Check resources to include in this project
      </div>

      {/* Repos */}
      <ResourceSection
        title="Repos"
        count={globalRepos.length}
        actions={
          <div className="flex gap-1">
            <button
              onClick={onAddReposLocal}
              className="text-[9px] text-v-dim border border-v-border px-1.5 py-0.5 rounded hover:border-v-borderHi transition-colors"
            >
              Browse
            </button>
            <button
              onClick={onAddReposGithub}
              className="text-[9px] text-v-dim border border-v-border px-1.5 py-0.5 rounded hover:border-v-borderHi transition-colors"
            >
              GitHub
            </button>
          </div>
        }
      >
        {globalRepos.length === 0 ? (
          <div className="border border-dashed border-v-border rounded-lg p-4 text-center">
            <p className="text-[11px] text-v-dim leading-relaxed">
              Drop a folder here, browse locally,<br />or paste a GitHub URL
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {globalRepos.map((repo) => (
              <RepoRow
                key={repo.id}
                repo={repo}
                checked={checkedRepoIds.has(repo.id)}
                onToggle={() => onToggleRepo(repo.id)}
              />
            ))}
          </div>
        )}
      </ResourceSection>

      {/* Skills */}
      <ResourceSection
        title="Skills"
        count={skills.length}
        badge={activeSkillTokens > 0 ? `${formatTokens(activeSkillTokens)} tokens` : undefined}
      >
        {skills.length === 0 ? (
          <div className="border border-dashed border-v-border rounded-lg p-4 text-center">
            <p className="text-[11px] text-v-dim leading-relaxed">
              Add .md files to<br />~/.vibe-os/skills/
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {skills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                checked={checkedSkillIds.has(skill.id)}
                onToggle={() => onToggleSkill(skill.id)}
              />
            ))}
          </div>
        )}
      </ResourceSection>

      {/* Agents */}
      <ResourceSection
        title="Agents"
        count={agentDefinitions.length}
        badge="~/.vibe-os/agents/"
      >
        {agentDefinitions.length === 0 ? (
          <div className="border border-dashed border-v-border rounded-lg p-4 text-center">
            <p className="text-[11px] text-v-dim leading-relaxed">
              Agents created during sessions<br />will appear here
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {agentDefinitions.map((agent) => (
              <AgentRow
                key={agent.name}
                agent={agent}
                checked={checkedAgentNames.has(agent.name)}
                onToggle={() => onToggleAgent(agent.name)}
              />
            ))}
          </div>
        )}
      </ResourceSection>
    </div>
  );
}

function RepoRow({ repo, checked, onToggle }: { repo: GlobalRepo; checked: boolean; onToggle: () => void }) {
  return (
    <label
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        checked ? "bg-v-accent/8 border border-v-accent/20" : "bg-v-surface border border-v-border"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-v-accent"
      />
      <div className="min-w-0">
        <div className="text-xs text-v-textHi truncate">{repo.name}</div>
        <div className="text-[10px] text-v-dim truncate">
          {repo.source === "local" ? "Local" : "GitHub"} · {repo.branch}
          {repo.language && ` · ${repo.language}`}
        </div>
      </div>
    </label>
  );
}

function SkillRow({ skill, checked, onToggle }: { skill: Skill; checked: boolean; onToggle: () => void }) {
  return (
    <label
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        checked ? "bg-v-accent/8 border border-v-accent/20" : "bg-v-surface border border-v-border"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-v-accent"
      />
      <div className="min-w-0">
        <div className="text-xs text-v-textHi truncate">{skill.label}</div>
        <div className="text-[10px] text-v-dim">
          {skill.category} · {skill.tokens} tokens
        </div>
      </div>
    </label>
  );
}

function AgentRow({ agent, checked, onToggle }: { agent: AgentDefinition; checked: boolean; onToggle: () => void }) {
  return (
    <label
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        checked ? "bg-v-accent/8 border border-v-accent/20" : "bg-v-surface border border-v-border"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-v-accent"
      />
      <div className="min-w-0">
        <div className="text-xs text-v-textHi truncate">{agent.name}</div>
        <div className="text-[10px] text-v-dim truncate">{agent.description}</div>
      </div>
    </label>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: no errors. Components not yet rendered but types are clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/ResourceSection.tsx src/components/home/ResourceCatalog.tsx
git commit -m "feat: add ResourceCatalog and ResourceSection components"
```

---

## Task 7: Project Setup View

**Files:**
- Modify: `src/components/home/ProjectSetupView.tsx` (replace placeholder)

- [ ] **Step 1: Implement ProjectSetupView**

Replace `src/components/home/ProjectSetupView.tsx`:

```typescript
import { useState, useCallback } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { ResourceCatalog } from "./ResourceCatalog";

export function ProjectSetupView() {
  const {
    goHome,
    addProject,
    createWorkspace,
    createClaudeSessionLocal,
    setActiveClaudeSessionId,
  } = useAppStore(
    useShallow((s) => ({
      goHome: s.goHome,
      addProject: s.addProject,
      createWorkspace: s.createWorkspace,
      createClaudeSessionLocal: s.createClaudeSessionLocal,
      setActiveClaudeSessionId: s.setActiveClaudeSessionId,
    })),
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Checked resource state
  const [checkedRepoIds, setCheckedRepoIds] = useState<Set<string>>(new Set());
  const [checkedSkillIds, setCheckedSkillIds] = useState<Set<string>>(new Set());
  const [checkedAgentNames, setCheckedAgentNames] = useState<Set<string>>(new Set());

  const toggleSet = <T,>(prev: Set<T>, item: T): Set<T> => {
    const next = new Set(prev);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    return next;
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }

    const safeName = trimmed
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!safeName) {
      setError("Invalid project name");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createWorkspace(safeName);
      const workspace = useAppStore.getState().activeWorkspace;
      if (!workspace) throw new Error("Workspace creation failed");

      const sessionId = crypto.randomUUID();
      createClaudeSessionLocal(sessionId, trimmed);

      // addProject now accepts linked resources
      addProject(trimmed, workspace.path, sessionId);

      // Update project with linked resources
      const projects = useAppStore.getState().projects;
      const newProject = projects[projects.length - 1];
      if (newProject) {
        const { saveProjects } = useAppStore.getState();
        const updatedProjects = projects.map((p) =>
          p.id === newProject.id
            ? {
                ...p,
                summary: description,
                linkedRepoIds: Array.from(checkedRepoIds),
                linkedSkillIds: Array.from(checkedSkillIds),
                linkedAgentNames: Array.from(checkedAgentNames),
              }
            : p,
        );
        useAppStore.setState({ projects: updatedProjects });
        saveProjects();
      }

      setActiveClaudeSessionId(sessionId);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);

  return (
    <div className="flex-1 flex h-full">
      {/* Left: Project config */}
      <div className="flex-1 flex flex-col p-8 max-w-[480px]">
        <div className="text-[11px] uppercase tracking-wider text-v-dim font-semibold mb-6">
          New Project
        </div>

        <div className="mb-5">
          <label className="text-xs text-v-text mb-1.5 block">Project name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            placeholder="my-project"
            disabled={submitting}
            autoFocus
            className="w-full bg-v-surface border border-v-border rounded-lg px-3 py-2.5 text-sm text-v-textHi placeholder:text-v-dim outline-none focus:border-v-accent transition-colors disabled:opacity-50"
          />
        </div>

        <div className="mb-5">
          <label className="text-xs text-v-text mb-1.5 block">
            Description <span className="text-v-dim">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            disabled={submitting}
            rows={3}
            className="w-full bg-v-surface border border-v-border rounded-lg px-3 py-2.5 text-[13px] text-v-textHi placeholder:text-v-dim outline-none focus:border-v-accent transition-colors resize-none disabled:opacity-50"
          />
        </div>

        {error && (
          <p className="text-v-red text-[11px] mb-4">{error}</p>
        )}

        <div className="flex-1" />

        <div className="flex gap-3">
          <button
            onClick={goHome}
            disabled={submitting}
            className="px-5 py-2.5 bg-v-surface border border-v-border rounded-lg text-sm text-v-text hover:border-v-borderHi transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting || !name.trim()}
            className="flex-1 px-5 py-2.5 bg-v-accent text-white rounded-lg text-sm font-medium hover:bg-v-accentHi transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>

      {/* Right: Resource catalog */}
      <div className="w-[300px] border-l border-v-border bg-v-bgAlt">
        <ResourceCatalog
          checkedRepoIds={checkedRepoIds}
          checkedSkillIds={checkedSkillIds}
          checkedAgentNames={checkedAgentNames}
          onToggleRepo={(id) => setCheckedRepoIds((prev) => toggleSet(prev, id))}
          onToggleSkill={(id) => setCheckedSkillIds((prev) => toggleSet(prev, id))}
          onToggleAgent={(name) => setCheckedAgentNames((prev) => toggleSet(prev, name))}
          onAddReposLocal={() => setShowBrowseModal(true)}
          onAddReposGithub={() => setShowGithubModal(true)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the flow**

Run: `npm run tauri dev`

Verify:
- Home screen shows project cards or welcome empty state
- Clicking "New Project" shows setup view with name/description fields on left, resource catalog on right
- Cancel returns to home
- Create Project creates a workspace and navigates to conversation view

- [ ] **Step 3: Commit**

```bash
git add src/components/home/ProjectSetupView.tsx
git commit -m "feat: implement ProjectSetupView with resource catalog integration"
```

---

## Task 8: Repo Adding — Browse Local + GitHub URLs

**Files:**
- Create: `src/components/home/RepoBrowseModal.tsx`
- Create: `src/components/home/RepoGithubModal.tsx`
- Create: `src/components/home/RepoDropZone.tsx`
- Modify: `src/components/home/ProjectSetupView.tsx` (wire modals)
- Modify: `src/components/home/ResourceCatalog.tsx` (add drop zone)

- [ ] **Step 1: Create RepoBrowseModal**

Create `src/components/home/RepoBrowseModal.tsx`:

```typescript
import { useState } from "react";
import { X } from "lucide-react";
import { showOpenDirectoriesDialog } from "../../lib/tauri";
import type { GlobalRepo } from "../../stores/types";

interface RepoBrowseModalProps {
  onAdd: (repos: GlobalRepo[]) => void;
  onClose: () => void;
}

export function RepoBrowseModal({ onAdd, onClose }: RepoBrowseModalProps) {
  const [selected, setSelected] = useState<{ name: string; path: string; hasGit: boolean }[]>([]);
  const [loading, setLoading] = useState(false);

  const handleBrowse = async () => {
    const paths = await showOpenDirectoriesDialog();
    if (!paths) return;

    const newItems = await Promise.all(
      paths.map(async (p) => {
        const name = p.split(/[\\/]/).pop() || p;
        // Check for .git directory by trying to read it
        let hasGit = false;
        try {
          const { commands } = await import("../../lib/tauri");
          await commands.readFile(p + "/.git/HEAD");
          hasGit = true;
        } catch {
          hasGit = false;
        }
        return { name, path: p, hasGit };
      }),
    );

    setSelected((prev) => {
      const existingPaths = new Set(prev.map((s) => s.path));
      return [...prev, ...newItems.filter((i) => !existingPaths.has(i.path))];
    });
  };

  const handleConfirm = () => {
    const repos: GlobalRepo[] = selected.map((s) => ({
      id: s.path.replace(/[\\/]/g, "_").toLowerCase(),
      name: s.name,
      source: "local" as const,
      path: s.path,
      gitUrl: null,
      branch: "main",
      language: "",
    }));
    onAdd(repos);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-v-bgAlt border border-v-border rounded-xl p-5 w-[420px] max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-semibold text-v-textHi">Add Local Repos</h3>
          <button onClick={onClose} className="text-v-dim hover:text-v-text">
            <X size={14} />
          </button>
        </div>
        <p className="text-[11px] text-v-dim mb-4">Select one or more folders from your machine</p>

        {selected.length > 0 && (
          <div className="bg-v-surface border border-v-border rounded-lg p-3 mb-3 max-h-[200px] overflow-y-auto">
            <div className="text-[10px] uppercase text-v-dim mb-2 tracking-wider">Selected folders</div>
            <div className="flex flex-col gap-1.5">
              {selected.map((item) => (
                <div key={item.path} className="flex items-center justify-between px-2.5 py-2 bg-v-surfaceHi rounded-md border border-v-borderHi">
                  <div>
                    <div className="text-xs text-v-textHi">{item.name}</div>
                    <div className="text-[10px] text-v-dim truncate max-w-[260px]">{item.path}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${item.hasGit ? "bg-v-greenDim text-v-green" : "bg-v-orangeDim text-v-orange"}`}>
                      {item.hasGit ? "git ✓" : "no git"}
                    </span>
                    <button
                      onClick={() => setSelected((prev) => prev.filter((s) => s.path !== item.path))}
                      className="text-v-dim hover:text-v-text text-xs"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleBrowse}
            className="flex-1 text-center py-2 border border-dashed border-v-borderHi rounded-lg text-[11px] text-v-dim hover:border-v-accent hover:text-v-text transition-colors"
          >
            {selected.length > 0 ? "+ Browse more" : "Browse folders..."}
          </button>
          {selected.length > 0 && (
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-v-accent text-white rounded-lg text-xs font-medium hover:bg-v-accentHi transition-colors"
            >
              Add {selected.length} repo{selected.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create RepoGithubModal**

Create `src/components/home/RepoGithubModal.tsx`:

```typescript
import { useState, useMemo } from "react";
import { X } from "lucide-react";
import type { GlobalRepo } from "../../stores/types";

interface RepoGithubModalProps {
  onAdd: (repos: GlobalRepo[]) => void;
  onClose: () => void;
}

function parseGithubUrl(url: string): { org: string; name: string } | null {
  const httpsMatch = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (httpsMatch) return { org: httpsMatch[1], name: httpsMatch[2] };
  return null;
}

export function RepoGithubModal({ onAdd, onClose }: RepoGithubModalProps) {
  const [text, setText] = useState("");
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({ url, parsed: parseGithubUrl(url) }));
  }, [text]);

  const validCount = parsed.filter((p) => p.parsed).length;

  const handleConfirm = async () => {
    setCloning(true);
    setError(null);

    try {
      const { commands } = await import("../../lib/tauri");
      const repos: GlobalRepo[] = [];

      for (const { url, parsed: p } of parsed) {
        if (!p) continue;
        try {
          const meta = await commands.cloneRepo(url);
          repos.push({
            id: meta.local_path.replace(/[\\/]/g, "_").toLowerCase(),
            name: meta.name,
            source: "github",
            path: meta.local_path,
            gitUrl: url,
            branch: meta.branch,
            language: meta.language,
          });
        } catch (err) {
          setError(`Failed to clone ${p.org}/${p.name}: ${err}`);
        }
      }

      if (repos.length > 0) {
        onAdd(repos);
      }
      if (!error) {
        onClose();
      }
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-v-bgAlt border border-v-border rounded-xl p-5 w-[420px] max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-semibold text-v-textHi">Add GitHub Repos</h3>
          <button onClick={onClose} className="text-v-dim hover:text-v-text">
            <X size={14} />
          </button>
        </div>
        <p className="text-[11px] text-v-dim mb-4">Paste one or more GitHub URLs (one per line)</p>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder={"https://github.com/org/repo\nhttps://github.com/org/another-repo"}
          disabled={cloning}
          rows={4}
          className="w-full bg-v-surface border border-v-border rounded-lg px-3 py-2.5 text-xs text-v-textHi font-mono placeholder:text-v-dim outline-none focus:border-v-accent transition-colors resize-none mb-3 disabled:opacity-50"
        />

        {parsed.length > 0 && (
          <div className="bg-v-surface border border-v-border rounded-lg p-3 mb-3 max-h-[150px] overflow-y-auto">
            <div className="text-[10px] uppercase text-v-dim mb-2 tracking-wider">Will clone</div>
            <div className="flex flex-col gap-1.5">
              {parsed.map(({ url, parsed: p }, i) => (
                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-v-surfaceHi rounded-md border border-v-borderHi">
                  {p ? (
                    <div>
                      <div className="text-xs text-v-textHi">{p.org}/{p.name}</div>
                      <div className="text-[10px] text-v-dim">→ ~/vibe-workspaces/repos/{p.name}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-v-red truncate">{url} (invalid URL)</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-v-red text-[10px] mb-3">{error}</p>}

        <div className="flex justify-end">
          {validCount > 0 && (
            <button
              onClick={handleConfirm}
              disabled={cloning}
              className="px-4 py-2 bg-v-accent text-white rounded-lg text-xs font-medium hover:bg-v-accentHi transition-colors disabled:opacity-50"
            >
              {cloning ? "Cloning..." : `Clone & Add ${validCount} repo${validCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create RepoDropZone**

Create `src/components/home/RepoDropZone.tsx`:

```typescript
import { useState, useCallback } from "react";
import type { GlobalRepo } from "../../stores/types";

interface RepoDropZoneProps {
  onDrop: (repos: GlobalRepo[]) => void;
}

export function RepoDropZone({ onDrop }: RepoDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const items = e.dataTransfer.files;
      const repos: GlobalRepo[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // In Tauri, dropped files give us paths
        const path = (item as File & { path?: string }).path;
        if (!path) continue;

        const name = path.split(/[\\/]/).pop() || path;
        repos.push({
          id: path.replace(/[\\/]/g, "_").toLowerCase(),
          name,
          source: "local",
          path,
          gitUrl: null,
          branch: "main",
          language: "",
        });
      }

      if (repos.length > 0) {
        onDrop(repos);
      }
    },
    [onDrop],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors mb-2 ${
        dragOver
          ? "border-v-accent bg-v-accent/5"
          : "border-v-border"
      }`}
    >
      <p className={`text-[10px] ${dragOver ? "text-v-accentHi font-medium" : "text-v-dim"}`}>
        {dragOver ? "Drop to add repos" : "Drop folders here"}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Wire modals into ProjectSetupView**

In `src/components/home/ProjectSetupView.tsx`, add imports after the existing imports:

```typescript
import { RepoBrowseModal } from "./RepoBrowseModal";
import { RepoGithubModal } from "./RepoGithubModal";
```

Add the modal rendering inside the component, before the final closing `</div>`:

```tsx
      {showBrowseModal && (
        <RepoBrowseModal
          onAdd={(repos) => {
            useAppStore.getState().addGlobalRepos(repos);
            repos.forEach((r) => setCheckedRepoIds((prev) => toggleSet(prev, r.id)));
          }}
          onClose={() => setShowBrowseModal(false)}
        />
      )}
      {showGithubModal && (
        <RepoGithubModal
          onAdd={(repos) => {
            useAppStore.getState().addGlobalRepos(repos);
            repos.forEach((r) => setCheckedRepoIds((prev) => toggleSet(prev, r.id)));
          }}
          onClose={() => setShowGithubModal(false)}
        />
      )}
```

- [ ] **Step 5: Add drop zone to ResourceCatalog**

In `src/components/home/ResourceCatalog.tsx`, add import:

```typescript
import { RepoDropZone } from "./RepoDropZone";
```

Inside the Repos `ResourceSection`, add the `RepoDropZone` before the repo list (after the empty state check's closing bracket, or before the `globalRepos.map` list):

Replace the entire Repos section children with:

```tsx
        <RepoDropZone
          onDrop={(repos) => {
            useAppStore.getState().addGlobalRepos(repos);
            repos.forEach((r) => onToggleRepo(r.id));
          }}
        />
        {globalRepos.length === 0 ? (
          <div className="text-center">
            <p className="text-[11px] text-v-dim leading-relaxed">
              No repos yet — browse, paste a GitHub URL, or drop folders above
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {globalRepos.map((repo) => (
              <RepoRow
                key={repo.id}
                repo={repo}
                checked={checkedRepoIds.has(repo.id)}
                onToggle={() => onToggleRepo(repo.id)}
              />
            ))}
          </div>
        )}
```

Add the import for `useAppStore` at the top of the file if not already present.

- [ ] **Step 6: Verify**

Run: `npm run tauri dev`

Test:
- Click "New Project" → setup view with catalog
- Click "Browse" → OS folder picker opens, can select multiple folders
- Click "GitHub" → paste URLs, see parsed preview, clone works
- Drag a folder from Explorer onto the drop zone
- All added repos appear in the checkbox list and are auto-checked

- [ ] **Step 7: Commit**

```bash
git add src/components/home/RepoBrowseModal.tsx src/components/home/RepoGithubModal.tsx src/components/home/RepoDropZone.tsx src/components/home/ProjectSetupView.tsx src/components/home/ResourceCatalog.tsx
git commit -m "feat: add repo adding with browse, GitHub URLs, and drag-drop"
```

---

## Task 9: Agent Capture Card + Save Dialog

**Files:**
- Create: `src/components/conversation/AgentCaptureCard.tsx`
- Create: `src/components/conversation/AgentSaveDialog.tsx`
- Modify: `src/hooks/useClaudeStream.ts`

- [ ] **Step 1: Create AgentCaptureCard**

Create `src/components/conversation/AgentCaptureCard.tsx`:

```typescript
import { useState } from "react";
import { AgentSaveDialog } from "./AgentSaveDialog";

interface AgentCaptureCardProps {
  agentName: string;
  description: string;
  tools: string[];
  systemPrompt: string;
  sessionId: string;
}

export function AgentCaptureCard({
  agentName,
  description,
  tools,
  systemPrompt,
  sessionId,
}: AgentCaptureCardProps) {
  const [showSave, setShowSave] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [saved, setSaved] = useState(false);

  if (dismissed || saved) {
    return saved ? (
      <div className="bg-v-surface border border-v-greenDim rounded-lg p-3 text-[11px] text-v-green">
        ✓ Agent "{agentName}" saved to ~/.vibe-os/agents/
      </div>
    ) : null;
  }

  return (
    <>
      <div className="bg-v-surface border border-v-borderHi rounded-lg p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-v-cyan" />
          <span className="text-xs text-v-cyan font-semibold">Agent spawned</span>
          <span className="text-[10px] text-v-dim">{agentName}</span>
        </div>
        <p className="text-xs text-v-text mb-2.5">{description}</p>
        <div className="flex gap-1 flex-wrap mb-3">
          {tools.map((tool) => (
            <span key={tool} className="text-[9px] px-1.5 py-0.5 rounded bg-v-cyan/10 text-v-cyan">
              {tool}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2.5 border-t border-v-border">
          <span className="text-[10px] text-v-dim">Save this agent for reuse?</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1 rounded-md text-[11px] text-v-dim border border-v-border hover:border-v-borderHi transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={() => setShowSave(true)}
              className="px-3 py-1 rounded-md text-[11px] text-white bg-v-accent hover:bg-v-accentHi transition-colors"
            >
              Save Agent
            </button>
          </div>
        </div>
      </div>

      {showSave && (
        <AgentSaveDialog
          initialName={agentName}
          initialDescription={description}
          initialSystemPrompt={systemPrompt}
          initialTools={tools}
          sessionId={sessionId}
          onSaved={() => { setShowSave(false); setSaved(true); }}
          onClose={() => setShowSave(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Create AgentSaveDialog**

Create `src/components/conversation/AgentSaveDialog.tsx`:

```typescript
import { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../../stores";

interface AgentSaveDialogProps {
  initialName: string;
  initialDescription: string;
  initialSystemPrompt: string;
  initialTools: string[];
  sessionId: string;
  onSaved: () => void;
  onClose: () => void;
}

const ALL_TOOLS = ["bash", "read", "write", "edit", "grep", "glob", "agent", "web_search", "web_fetch"];

export function AgentSaveDialog({
  initialName,
  initialDescription,
  initialSystemPrompt,
  initialTools,
  sessionId,
  onSaved,
  onClose,
}: AgentSaveDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [tools, setTools] = useState<Set<string>>(new Set(initialTools));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveAgentDefinition = useAppStore((s) => s.saveAgentDefinition);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveAgentDefinition(
        name.trim(),
        description.trim(),
        systemPrompt.trim(),
        Array.from(tools),
        sessionId,
      );
      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (tool: string) => {
    const next = new Set(tools);
    if (next.has(tool)) next.delete(tool);
    else next.add(tool);
    setTools(next);
  };

  const safeName = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-v-bgAlt border border-v-border rounded-xl p-5 w-[480px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-v-textHi">Save Agent Definition</h3>
          <button onClick={onClose} className="text-v-dim hover:text-v-text">
            <X size={14} />
          </button>
        </div>

        <div className="mb-3">
          <label className="text-[11px] text-v-dim block mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            className="w-full bg-v-surface border border-v-border rounded-md px-2.5 py-2 text-[13px] text-v-textHi outline-none focus:border-v-accent"
          />
        </div>

        <div className="mb-3">
          <label className="text-[11px] text-v-dim block mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-v-surface border border-v-border rounded-md px-2.5 py-2 text-[13px] text-v-textHi outline-none focus:border-v-accent"
          />
        </div>

        <div className="mb-3">
          <label className="text-[11px] text-v-dim block mb-1">System prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            className="w-full bg-v-surface border border-v-border rounded-md px-2.5 py-2 text-[11px] text-v-text font-mono outline-none focus:border-v-accent resize-none leading-relaxed"
          />
        </div>

        <div className="mb-3">
          <label className="text-[11px] text-v-dim block mb-1.5">Tool permissions</label>
          <div className="flex gap-1 flex-wrap">
            {ALL_TOOLS.map((tool) => (
              <button
                key={tool}
                onClick={() => toggleTool(tool)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                  tools.has(tool)
                    ? "bg-v-cyan/10 text-v-cyan border-v-cyan/15"
                    : "bg-v-surface text-v-dim border-v-border line-through"
                }`}
              >
                {tool}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-v-dim font-mono bg-v-surface rounded-md px-2.5 py-2 mb-4">
          → ~/.vibe-os/agents/{safeName || "..."}.md
        </div>

        {error && <p className="text-v-red text-[10px] mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-v-text border border-v-border hover:border-v-borderHi transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs text-white bg-v-accent hover:bg-v-accentHi transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save to Catalog"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire agent detection into useClaudeStream**

In `src/hooks/useClaudeStream.ts`, the hook already processes agent events. We need to detect `subagent` type events and insert an `AgentCaptureCard` as a rich card. Find the section that handles agent events (the `isAgentEvent(data)` branch), and add detection for agent-spawn events.

After the existing agent event processing, add a check for subagent spawn patterns. In the section that calls `addSessionAgentEvent`, add:

```typescript
        // Detect agent spawns for capture UI
        if (
          data.event_type === "raw" &&
          typeof data.content === "string" &&
          data.content.includes("Agent spawned") ||
          (data.metadata?.tool === "Agent" && data.event_type === "result")
        ) {
          const agentName = data.metadata?.agent_name as string || "unnamed-agent";
          const agentDesc = data.metadata?.description as string || data.content || "";
          const agentTools = (data.metadata?.tools as string[]) || [];

          insertRichCard(sid, "activity", "Agent spawned: " + agentName, {
            capturable: true,
            agentName,
            agentDescription: agentDesc,
            agentTools,
            agentSystemPrompt: (data.metadata?.system_prompt as string) || "",
          });
        }
```

Note: The exact event shape depends on Claude CLI's stream format. This provides the hook point — the `AgentCaptureCard` component will be rendered when a chat message has `cardType === "activity"` and `cardData?.capturable === true`. The conversation renderer needs to check for this flag and render `AgentCaptureCard` instead of the default activity card.

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/conversation/AgentCaptureCard.tsx src/components/conversation/AgentSaveDialog.tsx src/hooks/useClaudeStream.ts
git commit -m "feat: add agent capture card and save dialog for reusable agent definitions"
```

---

## Task 10: Unified Resource Panel in Settings Drawer

**Files:**
- Modify: `src/components/panels/RepoManager.tsx`
- Modify: `src/components/panels/SkillsPanel.tsx`
- Modify: relevant settings drawer parent (the component that renders tab content)

- [ ] **Step 1: Find the settings drawer tab renderer**

The settings drawer uses `SettingsPanel` or the `SecondaryDrawer` component to render tabs. Find which component renders `<RepoManager />` and `<SkillsPanel />` as tab content. This is likely in a component that switches on `activeDrawerTab`.

- [ ] **Step 2: Create a unified panel wrapper**

The simplest approach is to replace the separate Repos and Skills tabs with a single "Resources" tab that renders the `ResourceCatalog` component. Since `ResourceCatalog` was designed for the project setup flow with controlled checkbox state, create a thin wrapper that connects it to the workspace-scoped `repoSlice` and `skillSlice`:

Create or modify the appropriate file to add a `ResourcesTab` that:
- Uses `repos` from `repoSlice` as the checkbox source (converting to `GlobalRepo` format)
- Uses `skills` from `skillSlice` as the checkbox source
- Uses `agentDefinitions` from `agentDefinitionSlice`
- Calls `toggleRepo`, `toggleSkill`, `toggleAgentDefinition` on toggle
- Passes through `onAddReposLocal` and `onAddReposGithub` to open the browse/GitHub modals

This replaces the separate `RepoManager` and `SkillsPanel` tabs with a single unified tab. The exact wiring depends on how the drawer tab switching works in the codebase — follow the existing pattern.

- [ ] **Step 3: Verify**

Run: `npm run tauri dev`

Open a project, open the settings drawer. Verify:
- Single "Resources" tab shows repos, skills, and agents
- Toggling repos/skills works as before (triggers indexing, prompt recomposition)
- Agent definitions from `~/.vibe-os/agents/` appear in the Agents section

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: replace separate repo/skill tabs with unified resource panel"
```

---

## Task 11: Integration Testing + Polish

**Files:**
- Various — testing and fixing edge cases

- [ ] **Step 1: Test complete flow end-to-end**

Run: `npm run tauri dev`

Test the complete flow:
1. Fresh launch → welcome empty state appears
2. Click "New Project" → setup view with name input + resource catalog
3. Browse and add a local repo folder → appears in catalog, checked
4. Paste a GitHub URL and clone → appears in catalog, checked
5. Check a skill → token count updates
6. Create project → navigates to conversation, resources are linked
7. Go home → project card shows resource chips
8. Click project → conversation view, settings drawer shows unified Resources panel
9. Toggle theme → light/dark switches everywhere
10. Refresh app → theme and projects persist

- [ ] **Step 2: Test backward compatibility**

Verify existing projects (created before this change) still load and open correctly. The new `linkedRepoIds`, `linkedSkillIds`, `linkedAgentNames` fields will be `undefined` on old projects — ensure the code handles this gracefully with defaults.

In `EnhancedProjectCard.tsx`, guard the chip rendering:

```tsx
{(project.linkedRepoIds?.length ?? 0) > 0 && (
```

Apply the same `?.` guard for `linkedSkillIds` and `linkedAgentNames`.

- [ ] **Step 3: Run test suites**

Run: `npm run test:all`

Fix any test failures. The main risk is `projectSlice` tests that construct `Project` objects without the new fields.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: backward compat for old projects, integration polish"
```
