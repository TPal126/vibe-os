# Real CLI Smoke Test Procedure

Optional validation against real Claude/Codex binaries. Not CI-blocking.

## Prerequisites

- Claude CLI installed: `npm install -g @anthropic-ai/claude-code`
- Codex CLI installed: `npm install -g @openai/codex`
- Valid authentication for both
- App built: `npm run tauri build` or running in dev mode

## Test Runs

### 1. Claude Single Prompt
```bash
# Via app: open project, type a message, verify response appears
# Via CLI directly: claude -p "say hello" --output-format stream-json
```
**Pass:** Response appears in chat, outcome card shows cost/tokens.

### 2. Claude Cancellation
Start a long prompt, click cancel button.
**Pass:** Session stops, status returns to idle, no orphaned spinner.

### 3. Codex Single Prompt
```bash
# Via app: create project with Codex backend phase, run pipeline
# Via CLI directly: codex exec --json "say hello"
```
**Pass:** Response appears, tokens shown (cost may be null).

### 4. Workflow Phase (Claude)
Create a 2-phase pipeline (both Claude), run it.
**Pass:** Phase 1 completes, phase 2 starts (or gates), PhaseIndicator updates.

### 5. Workflow Phase (Codex)
Create a pipeline with one Codex phase, run it.
**Pass:** Codex CLI spawns, events stream, result appears.

### 6. Gated Flow
Create a 2-phase pipeline with gate between, run it.
**Pass:** GatePromptCard appears after phase 1, Continue button advances to phase 2.

### 7. Interaction Request (if applicable)
Run a Superpowers brainstorming phase.
**Pass:** If the framework asks questions, InteractionCard renders with options.

## Artifacts to Capture on Failure

- App console output (`npm run tauri dev` terminal)
- Rust stderr logs (look for `[vibe-os]` prefix)
- Screenshots of UI state
- The raw event payloads (visible in browser DevTools Console)

## When to Run

- Before major releases
- After changing adapter spawn/emit logic
- After changing useAgentStream event routing
- After changing Tauri command signatures
- Optionally: nightly on a machine with credentials
