---
phase: 03-context-assembly
plan: 03
subsystem: prompt-layer-ui
tags: [prompt-layer, sub-tabs, clipboard-copy, app-initialization, session-restore, context-pipeline]
dependency_graph:
  requires: [03-01]
  provides: [prompt-layer-panel, app-initialization, session-restore, left-column-complete]
  affects: []
tech_stack:
  added: []
  patterns: [debounced-persistence, zustand-useShallow, clipboard-manager-writeText, async-init-useEffect]
key_files:
  created:
    - src/components/panels/PromptLayer.tsx
  modified:
    - src/components/layout/MainLayout.tsx
    - src/App.tsx
decisions:
  - "PromptLayer uses useShallow selector for store access -- prevents unnecessary re-renders on unrelated state changes"
  - "System prompt uses local state with debounced sync to store -- 500ms debounce avoids SQLite writes on every keystroke"
  - "App init uses individual stable Zustand selectors (not useShallow) -- single function refs are already referentially stable"
  - "Session restore uses useAppStore.getState() after async loadActiveSession -- avoids stale closure values"
metrics:
  duration: "3m 25s"
  completed: "2026-03-28T23:48:28Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 3 Plan 3: PromptLayer + App Initialization + Session Wiring Summary

PromptLayer panel with 4 sub-tabs (System editable, Task/Skills/Repo readonly), debounced system prompt persistence, clipboard copy via Tauri plugin, app-level initialization (session + repos + skills + compose), and session toggle restore across restarts.

## What Was Built

### Task 1: PromptLayer Panel
- **PromptLayer.tsx:** Sub-tabbed prompt viewer with System (editable textarea with 500ms debounced persistence), Task (readonly), Skills (readonly), Repo (readonly) sub-tabs
- **PanelHeader integration:** Layers icon, total token count display using formatTokens, Copy Full Prompt button with checkmark feedback (2s)
- **Clipboard copy:** Uses writeText from @tauri-apps/plugin-clipboard-manager to copy composedPrompt.full
- **Sub-tab strip:** 10px uppercase text with tracking, active tab has accent underline, inactive tabs have transparent border
- **Monospace textareas:** JetBrains Mono (font-mono), bg-v-bg, border styling differentiates editable (full border, focus:border-v-accent) from readonly (dimmer border, muted text, cursor-default)
- **Store sync:** useShallow selector for systemPrompt, composedPrompt, setSystemPrompt; ref-based external sync for hydration

### Task 2: MainLayout + App Initialization
- **MainLayout.tsx:** Added PromptLayer import, replaced PlaceholderPanel fallback for prompt tab with PromptLayer component, removed unused leftContent record
- **Left column complete:** All three tabs now render real panels (RepoManager, SkillsPanel, PromptLayer) -- no PlaceholderPanels remain in left column top area
- **App.tsx initialization:** useEffect on mount runs async init sequence: loadActiveSession -> createSession (if needed) -> loadRepos -> discoverSkills -> restore active toggles from session data -> recompose
- **Session restore:** Parses activeRepos/activeSkills JSON arrays from session data, maps over loaded repos/skills to restore active flags via useAppStore.setState()
- **Empty deps array:** Intentional -- init runs exactly once on mount; Zustand function refs are stable

## Verification Results

- `npx tsc --noEmit`: PASSED (0 errors)
- PromptLayer exports named function `PromptLayer`
- Four sub-tabs: System, Task, Skills, Repo
- System tab: editable textarea with debounced persistence
- Task/Skills/Repo tabs: readonly textareas with dimmer styling
- Copy button uses writeText from clipboard-manager plugin
- Token count shows in header via formatTokens
- MainLayout left column: all three tabs render real panels
- App.tsx: full init sequence with session restore

## Deviations from Plan

None -- plan executed exactly as written. The only coordination note is that Plan 03-02 executed in parallel and had already updated MainLayout.tsx with RepoManager and SkillsPanel imports before this plan ran, so the PromptLayer addition merged cleanly on top.

## Decisions Made

1. **useShallow for PromptLayer store access:** Prevents unnecessary re-renders when unrelated slices (repos, skills, session) update. Only re-renders when systemPrompt, composedPrompt, or setSystemPrompt change.

2. **Local state + debounced sync for system prompt:** The textarea value is held in local React state for instant keypress feedback. A 500ms debounce timeout fires setSystemPrompt which persists to SQLite via the store action. This avoids SQLite writes on every keystroke.

3. **Individual selectors in App.tsx:** Each store action (loadActiveSession, createSession, etc.) is selected individually rather than via useShallow, because single function references from Zustand are already referentially stable -- no need for shallow comparison.

4. **useAppStore.getState() for post-async state reads:** After loadActiveSession completes, the activeSession value is read via getState() rather than from the useEffect closure, which would be stale. Same pattern for reading repos/skills after loading.

## Commits

| Hash | Message |
|------|---------|
| e5ccdde | feat(03-03): PromptLayer panel with sub-tabs, editable system prompt, clipboard copy |
| 94459b1 | feat(03-03): wire PromptLayer into MainLayout, add app initialization with session restore |

## Self-Check: PASSED

All 3 files verified on disk. Commits e5ccdde and 94459b1 confirmed in git log.
