use std::collections::HashMap;
use std::sync::Arc;

use chrono::Utc;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex as TokioMutex;

use crate::services::event_stream::{self, AgentEvent, AgentEventType};

use super::db_commands::DbState;
use super::decision_commands;

// ── Process State ──

/// Managed state for active Claude CLI processes.
/// Key: claude_session_id, Value: the CommandChild handle.
pub type ClaudeProcesses = Arc<TokioMutex<HashMap<String, CommandChild>>>;

#[derive(Debug, Deserialize)]
pub struct StartClaudeArgs {
    pub working_dir: String,
    pub message: String,
    pub system_prompt: Option<String>,
    pub conversation_id: Option<String>,
    pub claude_session_id: String,
}

// ── Commands ──

/// Start a Claude CLI invocation. Spawns `claude -p --output-format stream-json`
/// as a child process, reads stdout in a background task, parses events,
/// and emits them as 'claude-stream' Tauri events.
///
/// Returns an invocation_id that can be used to cancel.
#[tauri::command]
pub async fn start_claude(app: AppHandle, args: StartClaudeArgs) -> Result<String, String> {
    let shell = app.shell();
    let invocation_id = uuid::Uuid::new_v4().to_string();

    // Build CLI arguments
    let mut cli_args: Vec<String> = vec![
        "-p".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
    ];

    // Add conversation-id for multi-turn continuity
    if let Some(ref conv_id) = args.conversation_id {
        cli_args.push("--conversation-id".to_string());
        cli_args.push(conv_id.clone());
    }

    // Add system prompt if provided
    if let Some(ref sys_prompt) = args.system_prompt {
        if !sys_prompt.is_empty() {
            cli_args.push("--system-prompt".to_string());
            cli_args.push(sys_prompt.clone());
        }
    }

    // The user message is the last argument
    cli_args.push(args.message.clone());

    // Spawn the process
    let (mut rx, child) = shell
        .command("run-claude")
        .args(&cli_args)
        .current_dir(args.working_dir)
        .spawn()
        .map_err(|e| format!("Failed to spawn Claude CLI: {}", e))?;

    // Store the child handle keyed by claude_session_id
    let processes = get_or_init_processes(&app);
    let claude_sid = args.claude_session_id.clone();
    {
        let mut procs = processes.lock().await;
        procs.insert(claude_sid.clone(), child);
    }

    // Update session status to active in DB
    update_session_status_in_db(&app, &claude_sid, "active");

    // Emit a "working" event to signal the frontend
    let _ = app.emit(
        "claude-stream",
        serde_json::json!({
            "type": "status",
            "status": "working",
            "invocation_id": &invocation_id,
            "claude_session_id": &claude_sid,
        }),
    );

    // Spawn a background task to read stdout and emit events
    let app_handle = app.clone();
    let inv_id = invocation_id.clone();
    let claude_sid_clone = claude_sid.clone();
    let processes_clone = processes.clone();

    tauri::async_runtime::spawn(async move {
        let mut line_buffer = String::new();

        while let Some(event) = rx.recv().await {
            use tauri_plugin_shell::process::CommandEvent;
            match event {
                CommandEvent::Stdout(bytes) => {
                    // Accumulate bytes and split by newlines (stream-json is line-delimited)
                    let text = String::from_utf8_lossy(&bytes);
                    line_buffer.push_str(&text);

                    // Process complete lines
                    while let Some(newline_pos) = line_buffer.find('\n') {
                        let line = line_buffer[..newline_pos].to_string();
                        line_buffer = line_buffer[newline_pos + 1..].to_string();

                        if line.trim().is_empty() {
                            continue;
                        }

                        // Parse via event_stream, then tag with claude_session_id
                        let agent_event = event_stream::parse_event(&line)
                            .with_session_id(&claude_sid_clone);

                        // Persist conversation_id from Result events
                        if agent_event.event_type == AgentEventType::Result {
                            if let Some(ref meta) = agent_event.metadata {
                                if let Some(conv_id) = meta.get("session_id").and_then(|v| v.as_str()) {
                                    update_session_conversation_id(&app_handle, &claude_sid_clone, conv_id);
                                }
                            }
                        }

                        // Log to audit_log in SQLite
                        log_to_audit(&app_handle, &agent_event);

                        // Emit to frontend
                        let _ = app_handle.emit("claude-stream", &agent_event);
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let text = String::from_utf8_lossy(&bytes).trim().to_string();
                    if !text.is_empty() {
                        let error_event = AgentEvent {
                            timestamp: Utc::now().to_rfc3339(),
                            event_type: AgentEventType::Error,
                            content: text,
                            metadata: None,
                            claude_session_id: Some(claude_sid_clone.clone()),
                        };
                        let _ = app_handle.emit("claude-stream", &error_event);
                    }
                }
                CommandEvent::Terminated(payload) => {
                    // Emit completion status
                    let _ = app_handle.emit(
                        "claude-stream",
                        serde_json::json!({
                            "type": "status",
                            "status": "done",
                            "invocation_id": &inv_id,
                            "claude_session_id": &claude_sid_clone,
                            "exit_code": payload.code,
                        }),
                    );

                    // Update session status in DB
                    update_session_status_in_db(&app_handle, &claude_sid_clone, "idle");

                    // Clean up process entry
                    let mut procs = processes_clone.lock().await;
                    procs.remove(&claude_sid_clone);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(invocation_id)
}

/// Send a follow-up message in an existing conversation.
/// This spawns a NEW claude process with --conversation-id for continuity.
/// The previous process should have already completed.
#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    message: String,
    conversation_id: String,
    working_dir: String,
    claude_session_id: String,
) -> Result<String, String> {
    start_claude(
        app,
        StartClaudeArgs {
            working_dir,
            message,
            system_prompt: None,
            conversation_id: Some(conversation_id),
            claude_session_id,
        },
    )
    .await
}

/// Cancel a running Claude CLI invocation by killing the process.
#[tauri::command]
pub async fn cancel_claude(app: AppHandle, claude_session_id: String) -> Result<(), String> {
    let processes = get_or_init_processes(&app);
    let mut procs = processes.lock().await;

    if let Some(child) = procs.remove(&claude_session_id) {
        child
            .kill()
            .map_err(|e| format!("Failed to kill claude process: {}", e))?;

        // Emit cancellation event
        let _ = app.emit(
            "claude-stream",
            serde_json::json!({
                "type": "status",
                "status": "cancelled",
                "claude_session_id": &claude_session_id,
            }),
        );

        update_session_status_in_db(&app, &claude_session_id, "idle");
        Ok(())
    } else {
        Err(format!("No active process for claude session: {}", claude_session_id))
    }
}

// ── Helpers ──

/// Get or initialize the ClaudeProcesses managed state.
fn get_or_init_processes(app: &AppHandle) -> ClaudeProcesses {
    if let Some(processes) = app.try_state::<ClaudeProcesses>() {
        processes.inner().clone()
    } else {
        let processes: ClaudeProcesses = Arc::new(TokioMutex::new(HashMap::new()));
        app.manage(processes.clone());
        processes
    }
}

/// Update the status of a Claude session in the database.
fn update_session_status_in_db(app: &AppHandle, claude_session_id: &str, status: &str) {
    if let Some(db_state) = app.try_state::<DbState>() {
        if let Ok(conn) = db_state.lock() {
            let _ = conn.execute(
                "UPDATE claude_sessions SET status = ?1 WHERE id = ?2",
                rusqlite::params![status, claude_session_id],
            );
        }
    }
}

/// Persist the Claude CLI conversation ID on a Claude session row.
fn update_session_conversation_id(app: &AppHandle, claude_session_id: &str, conversation_id: &str) {
    if let Some(db_state) = app.try_state::<DbState>() {
        if let Ok(conn) = db_state.lock() {
            let _ = conn.execute(
                "UPDATE claude_sessions SET conversation_id = ?1 WHERE id = ?2",
                rusqlite::params![conversation_id, claude_session_id],
            );
        }
    }
}

/// Log an AgentEvent to the audit_log table.
/// Decision-type events are also persisted to the decisions table.
fn log_to_audit(app: &AppHandle, event: &AgentEvent) {
    // Skip Raw events and empty content to avoid noise
    if event.event_type == AgentEventType::Raw && event.content.is_empty() {
        return;
    }

    if let Some(db_state) = app.try_state::<DbState>() {
        if let Ok(conn) = db_state.lock() {
            // Get active session ID
            let session_id: Option<String> = conn
                .query_row(
                    "SELECT id FROM sessions WHERE active = 1 LIMIT 1",
                    [],
                    |row| row.get(0),
                )
                .ok();

            if let Some(session_id) = session_id {
                let id = uuid::Uuid::new_v4().to_string();
                let action_type = format!("{:?}", event.event_type).to_uppercase();
                let metadata_str = event
                    .metadata
                    .as_ref()
                    .map(|m| serde_json::to_string(m).unwrap_or_default());

                let _ = conn.execute(
                    "INSERT INTO audit_log (id, session_id, timestamp, action_type, detail, actor, metadata) VALUES (?1, ?2, ?3, ?4, ?5, 'agent', ?6)",
                    rusqlite::params![id, session_id, event.timestamp, action_type, event.content, metadata_str],
                );

                // Also persist Decision-type events to the decisions table
                if event.event_type == AgentEventType::Decision {
                    let decision = decision_commands::Decision {
                        id: uuid::Uuid::new_v4().to_string(),
                        session_id: session_id.clone(),
                        timestamp: event.timestamp.clone(),
                        decision: event.content.clone(),
                        rationale: "Auto-captured from agent stream".to_string(),
                        confidence: 0.8,
                        impact_category: "architecture".to_string(),
                        reversible: true,
                        related_files: event
                            .metadata
                            .as_ref()
                            .and_then(|m| m.get("path"))
                            .and_then(|v| v.as_str())
                            .map(|p| vec![p.to_string()])
                            .unwrap_or_default(),
                        related_tickets: Vec::new(),
                    };
                    let _ = decision_commands::insert_decision(&conn, &decision);
                }
            }
        }
    }
}
