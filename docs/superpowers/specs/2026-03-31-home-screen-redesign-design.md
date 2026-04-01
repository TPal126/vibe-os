# Home Screen Redesign — Design Spec

Redesign the VIBE OS home screen to be self-documenting, support local + GitHub repos with batch adding, introduce reusable agent definitions, unify the resource panel, and add a light theme.

## 1. Home Screen Layout

The home screen shows only project cards in a clean grid (max 5, 3-column layout centered at max-width 720px).

**Project cards** display:
- Project name and status badge (idle / N active sessions)
- Optional description
- Summary chips: repo count, skill count, agent count (color-coded: blue for repos, cyan for skills, orange for agents)

**Empty state (first launch):** Centered welcome message — "Welcome to VIBE OS" — with a brief explanation of what a project is ("A project groups your repos, skills, and agents into a workspace") and a single "+ New Project" CTA button.

**Theme toggle:** Small pill toggle (sun/moon icons) in the title bar, always accessible from any view.

No resource catalog is visible on the home screen. The catalog only appears during project setup.

## 2. Project Setup Flow

Clicking "New Project" (either the dashed card in the grid or the empty-state CTA) transitions to a **setup view** that replaces the home screen:

**Left side — Project config:**
- Project name input (validated: alphanumeric, hyphens, underscores)
- Description textarea (optional)
- Cancel button (returns to home) and Create Project button

**Right side — Resource catalog (slides in):**
- Header: "Resource Catalog" with subtitle "Check resources to include in this project"
- Three collapsible sections: Repos, Skills, Agents
- Each section lists all items from the global catalog with checkboxes
- Checked items are included in the new project
- Sections are independently collapsible

On "Create Project": workspace is scaffolded, checked resources are linked, a Claude session is created, and the user navigates into the conversation view.

**Editing existing projects:** Clicking an existing project card on the home screen opens it directly into the conversation view (no setup view). Resource changes for existing projects are handled via the unified resource panel in the settings drawer (section 5).

## 3. Repo Adding

The Repos section in the resource catalog supports three input methods:

### Browse Local
- "Browse" button opens the native OS directory picker (Tauri `dialog.open` with `directory: true, multiple: true`)
- Selected folders appear in a preview list showing:
  - Folder name and full path
  - Git status badge: "git ✓" (green) if `.git/` exists, "no git" (yellow) otherwise
  - Remove button (×) per item
- "Browse more" button to add additional folders
- Confirm button with count: "Add N repos"

### GitHub URLs
- "GitHub" button opens a textarea for pasting URLs (one per line)
- URLs are parsed live into a preview list showing:
  - Parsed org/repo name
  - Clone destination path (e.g., `~/vibe-workspaces/repos/repo-name`)
  - Remove button (×) per item
- Invalid URLs show inline error styling
- Confirm button with count: "Clone & Add N repos"

### Drag & Drop
- A drop zone is always visible in the Repos section (dashed border, "Drop folders here" text)
- On drag-over: zone highlights with accent border and background
- Supports multiple folders dropped at once
- Dropped folders follow the same preview/confirm flow as Browse Local

### Global Catalog Persistence
All repos added through any method are persisted to a global catalog. On any future project setup, previously added repos appear in the checkbox list and can be toggled on without re-adding. Repos are identified by their absolute path (local) or clone URL (GitHub).

## 4. Agent Capture

### Detection
When Claude spawns a subagent during a session, VIBE OS detects the agent-spawn event from the Claude CLI stream. An inline card appears in the chat conversation.

### Inline Card
The agent-spawned card displays:
- Agent name (as detected from the spawn event)
- Description (extracted from the agent's task description)
- Tool permission chips (bash, read, grep, etc.)
- "Save Agent" button and "Dismiss" link

### Save Dialog
Clicking "Save Agent" opens a dialog with pre-filled fields, all editable:
- **Name** — text input, pre-filled from detected agent name
- **Description** — text input, pre-filled from task description
- **System prompt** — multiline textarea, pre-filled from the agent's instructions
- **Tool permissions** — chip toggles, pre-filled from detected tools used
- **Save path** — shown as read-only: `~/.vibe-os/agents/{name}.md`

### File Format
Agents are saved as Markdown files with YAML frontmatter in `~/.vibe-os/agents/`:

```markdown
---
name: test-runner
description: Runs vitest + cargo test, reports summary
tools: [bash, read, grep, glob]
created: 2026-03-31
source_session: abc-123-def
---

You are a test-runner agent. Execute the following test suites and report results:

- Frontend: npm run test (vitest)
- Backend: cargo test --lib

Summarize pass/fail counts. Flag any new failures.
```

### Behavior
- No auto-save — agents are only persisted when the user explicitly clicks Save
- Saved agents appear in the Agents section of the resource catalog
- Agents can be checked per-project like skills and repos
- Agent `.md` files are hand-editable outside VIBE OS

## 5. Unified Resource Panel (In-Session)

Inside a project's conversation view, the existing settings drawer is restructured to include a **unified resource panel** — one scrollable area with three collapsible sections:

### Repos Section
- Same checkbox list as project setup
- Toggle repos on/off mid-session (triggers re-indexing and prompt recomposition)
- "Browse" and "GitHub" buttons to add new repos
- Drop zone for drag & drop
- Shows: name, source (Local/GitHub), branch, language badge

### Skills Section
- Same checkbox list as today's SkillsPanel
- Toggle skills on/off mid-session (triggers prompt recomposition)
- Token budget bar showing active skill token usage vs soft limit
- Shows: label, category badge, token count

### Agents Section
- Checkbox list of saved agents from `~/.vibe-os/agents/`
- Toggle agents on/off for the current session
- Shows: name, description
- No add button here — agents are created during sessions via the capture flow

All three sections are collapsible. The panel replaces the current separate Repos and Skills tabs in the settings drawer.

## 6. Light + Dark Themes

### Implementation
The existing CSS variable system in `globals.css` already defines all colors as `--color-v-*` custom properties, and all components reference them via Tailwind classes (`bg-v-surface`, `text-v-text`, etc.).

Add a `[data-theme="light"]` selector that overrides every variable:

```css
:root {
  /* Dark theme — existing values, unchanged */
  --color-v-bg: #08090d;
  --color-v-surface: #12141c;
  --color-v-text: #b8bdd4;
  /* ... */
}

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
```

### Toggle
- Pill toggle in the title bar with sun (light) and moon (dark) icons
- Toggles `data-theme` attribute on the `<html>` element
- Default: dark (current behavior)

### Persistence
- Theme preference stored via `commands.saveSetting('theme', 'light' | 'dark')`
- Loaded on app startup before first render to avoid flash

### No Component Changes
Because all components already use CSS variable-based Tailwind classes, switching the variables is sufficient. No component-level style changes are needed.

## Data Model Changes

### New: Agent Definition Store
- New `agentDefinitionSlice` in Zustand: `agentDefinitions: AgentDefinition[]`
- `AgentDefinition`: `{ id, name, description, systemPrompt, tools: string[], createdAt, sourceSessionId }`
- Actions: `saveAgentDefinition`, `removeAgentDefinition`, `loadAgentDefinitions`, `toggleAgentDefinition`
- Persisted to `~/.vibe-os/agents/` as `.md` files (read/write via new Rust commands)

### New: Global Repo Catalog
- Extend `repoSlice` to track repos globally (not just per-workspace)
- Add `globalRepos: Repo[]` alongside existing `repos` (which remains workspace-scoped)
- New repos added via any method are appended to `globalRepos` and persisted
- Project setup checks items from `globalRepos`; workspace `repos` is the active subset

### New: Theme Setting
- Add `theme: 'light' | 'dark'` to persisted settings
- New `themeSlice` with `theme` state and `setTheme` action
- `setTheme` updates `document.documentElement.dataset.theme` and persists to SQLite

### Extended: Project Model
- Add `linkedAgentIds: string[]` to the `Project` type
- Projects track which agent definitions are active alongside repos and skills

## New Rust Commands

- `save_agent_definition(name, description, system_prompt, tools, source_session_id)` — writes `.md` to `~/.vibe-os/agents/`
- `load_agent_definitions()` — reads all `.md` files from `~/.vibe-os/agents/`, parses frontmatter
- `remove_agent_definition(name)` — deletes the `.md` file
- `open_directory_picker(multiple)` — wraps Tauri dialog for multi-folder selection
- `get_theme()` / `set_theme(theme)` — read/write theme setting

## New/Modified Frontend Components

### New Components
- `ProjectSetupView` — the name + description form with resource catalog
- `ResourceCatalog` — unified repos/skills/agents panel (used in setup view and settings drawer)
- `RepoBrowseModal` — local folder picker flow with preview list
- `RepoGithubModal` — batch GitHub URL input with parsed preview
- `AgentCaptureCard` — inline chat card for agent-spawn events
- `AgentSaveDialog` — editable agent definition form
- `ThemeToggle` — pill toggle component for title bar

### Modified Components
- `HomeScreen` — remove inline project creation, add ProjectSetupView transition
- `EnhancedProjectCard` — add summary chips for repo/skill/agent counts
- `NewProjectCard` — simplified to just trigger setup view transition
- `SettingsPanel` — replace separate repo/skill tabs with unified ResourceCatalog
- `TitleBar` — add ThemeToggle component
- `MainLayout` — add `currentView: "project-setup"` state
