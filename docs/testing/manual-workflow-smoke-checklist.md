# Manual Workflow Smoke Checklist

Run before shipping major workflow changes.

## Project Lifecycle
- [ ] Create a new project from scratch
- [ ] Create a pipeline with 3+ phases (mix Claude and Codex backends)
- [ ] Verify pipeline persists (check PhaseIndicator or builder shows phases)
- [ ] Delete project and confirm cleanup (no orphaned pipelines)

## Pipeline Execution
- [ ] Run pipeline via PhaseIndicator "Run Pipeline" button
- [ ] Verify phase indicator shows running state
- [ ] Gate continue works (GatePromptCard "Continue" button)
- [ ] Pipeline completes all phases

## Interaction
- [ ] Interaction question card renders in chat
- [ ] User can answer via choice or text input
- [ ] Answer routes to backend

## Session Persistence
- [ ] Reopen project after navigating away
- [ ] Reopen project after app restart
- [ ] Session state is coherent (no empty/broken session)

## Real CLI
- [ ] Run one real Claude session (requires Claude CLI)
- [ ] Run one real Codex session (requires Codex CLI)
- [ ] Cancel an in-progress session

## Error Handling
- [ ] Backend error shows error card (not crash)
- [ ] No duplicate cards/messages after error
- [ ] Verify errors are visible and recoverable
