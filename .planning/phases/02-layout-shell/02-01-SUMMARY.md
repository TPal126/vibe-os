---
phase: 02-layout-shell
plan: 01
subsystem: layout-components
tags: [ui, components, title-bar, status-bar, fonts, animations]
dependency_graph:
  requires: [01-01-foundation]
  provides: [shared-components, layout-components, design-system-css, font-loading]
  affects: [02-02-three-column-layout]
tech_stack:
  added: [react-resizable-panels@4.8.0, lucide-react@1.7.0, "@fontsource/instrument-sans@5.2.8", "@fontsource/jetbrains-mono@5.2.8", "@fontsource/space-mono@5.2.9"]
  patterns: [data-tauri-drag-region, getCurrentWindow-api, css-only-tooltip, fontsource-bundled-fonts, tailwind-v4-custom-animations]
key_files:
  created:
    - src/components/shared/Badge.tsx
    - src/components/shared/Dot.tsx
    - src/components/shared/IconButton.tsx
    - src/components/shared/Tooltip.tsx
    - src/components/layout/PanelHeader.tsx
    - src/components/layout/TabStrip.tsx
    - src/components/layout/TitleBar.tsx
    - src/components/layout/StatusBar.tsx
    - src/components/panels/PlaceholderPanel.tsx
  modified:
    - package.json
    - package-lock.json
    - src-tauri/tauri.conf.json
    - src-tauri/capabilities/default.json
    - src/globals.css
    - src/main.tsx
    - src/App.tsx
decisions:
  - "CSS-only Tooltip over @radix-ui/react-tooltip -- no additional dependency for simple text tooltips"
  - "data-tauri-drag-region on every non-interactive child element in TitleBar for full drag coverage"
  - "Named exports for all components (not default exports) for consistent import patterns"
metrics:
  duration: "3m 9s"
  completed: "2026-03-28T22:51:05Z"
  tasks_completed: 4
  tasks_total: 4
  files_created: 9
  files_modified: 7
---

# Phase 2 Plan 01: Layout Shell Components Summary

Custom title bar with draggable region and window controls (minimize/maximize/close), status bar with five placeholder metrics, four shared components (Badge, Dot with pulse, IconButton, Tooltip), reusable PanelHeader and TabStrip, all fonts bundled via @fontsource, and globals.css extended with animations and custom scrollbars.

## What Was Built

### Task 1: Dependencies and Tauri Configuration
Installed five npm packages: react-resizable-panels (v4.8.0), lucide-react (v1.7.0), and three @fontsource packages. Configured Tauri for custom title bar by setting `decorations: false` and `shadow: true` in tauri.conf.json. Added five window control permissions (`core:window:allow-minimize`, `allow-toggle-maximize`, `allow-internal-toggle-maximize`, `allow-close`, `allow-start-dragging`) to capabilities/default.json alongside existing shell permissions.

### Task 2: CSS and Font Loading
Extended globals.css @theme block with two custom animations (`dot-pulse` for 2s infinite opacity pulsing, `fade-slide-in` for 0.3s entry animation). Added base body styles (12px font, overflow hidden, full height), custom 5px scrollbars with transparent track and borderHi thumb, and resize handle styling via `[data-resize-handle]` selectors. Updated main.tsx to import 9 @fontsource CSS files (Instrument Sans 400/500/600/700, JetBrains Mono 400/500/600, Space Mono 400/700) before globals.css.

### Task 3: Shared Components
Built four reusable shared components as named exports:
- **Badge**: 10px font, configurable text color and background classes, inline-flex layout
- **Dot**: 6px (w-1.5 h-1.5) status indicator with optional `animate-dot-pulse` animation
- **IconButton**: Transparent-to-surfaceHi hover transition (120ms), active state with accent tint
- **Tooltip**: CSS-only via group-hover pattern, top/bottom positioning, border+shadow styling

### Task 4: Layout Components
Built five layout/panel components:
- **TitleBar**: 40px height, "VIBE OS" gradient branding (accent to cyan), subtitle, "Ready" status badge with pulsing green dot, minimize/maximize/close window controls. `data-tauri-drag-region` on container and all non-interactive children.
- **StatusBar**: 28px height, five placeholder metrics (Python idle, Claude disconnected, Session 0:00:00, Decisions 0, Actions 0), version v0.1.0 pushed right.
- **PanelHeader**: 32px min-height, 10px uppercase bold title with optional icon and action slots.
- **TabStrip**: 11px tabs with 2px bottom border, active state (accent border, semibold, textHi), inactive state (transparent border, dim, hover text). Exports `Tab` type.
- **PlaceholderPanel**: Centered layout with icon, title, description for empty panel slots.

Updated App.tsx to render TitleBar + centered placeholder text + StatusBar as a temporary layout shell.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `e1f8593` | Install Phase 2 deps, configure Tauri custom title bar |
| 2 | `717604a` | Extend globals.css with animations/scrollbars, bundle fonts |
| 3 | `7bc2a32` | Build shared components (Badge, Dot, IconButton, Tooltip) |
| 4 | `927653f` | Build layout components, wire TitleBar + StatusBar |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compilation passes with zero errors (`npx tsc --noEmit`)
- All 9 created files exist on disk
- All 4 commits verified in git history
- tauri.conf.json has `decorations: false` and `shadow: true`
- capabilities/default.json includes all 5 `core:window:allow-*` permissions
- package.json lists all 5 new dependencies
- globals.css contains `--animate-dot-pulse` and `--animate-fade-slide-in` in @theme
- main.tsx imports 9 @fontsource CSS files before globals.css
- All components use named exports (not default)

## Self-Check: PASSED

All 12 files verified present. All 4 commit hashes verified in git log.
