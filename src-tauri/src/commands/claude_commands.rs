use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;

use chrono::Utc;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex as TokioMutex;

use crate::services::event_stream::{self, AgentEvent, AgentEventType};

use super::db_commands::DbState;
use super::decision_commands;

// ── Process State ──

/// Managed state for active Claude CLI processes.
/// Key: claude_session_id, Value: the Child handle.
pub type ClaudeProcesses = Arc<TokioMutex<HashMap<String, Child>>>;

#[derive(Debug, Deserialize)]
pub struct StartClaudeArgs {
    pub working_dir: String,
    pub message: String,
    pub system_prompt: Option<String>,
    pub conversation_id: Option<String>,
    pub claude_session_id: String,
}

// ── Commands ──

/// Validate that the Claude CLI is available on the system.
/// Uses std::process::Command for reliable PATH resolution on all platforms.
#[tauri::command]
pub async fn validate_claude_cli() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        match Command::new("claude").arg("--version").output() {
            Ok(output) => {
                if output.status.success() {
                    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if version.is_empty() {
                        Ok("Claude CLI found (unknown version)".to_string())
                    } else {
                        Ok(version)
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    Err(format!("Claude Code CLI returned an error: {}", stderr))
                }
            }
            Err(e) => Err(format_spawn_error(&e)),
        }
    })
    .await
    .map_err(|e| format!("Validation task failed: {}", e))?
}

/// Start a Claude CLI invocation. Spawns `claude -p --output-format stream-json`
/// as a child process, reads stdout in a background thread, parses events,
/// and emits them as 'claude-stream' Tauri events.
///
/// Returns an invocation_id that can be used to cancel.
#[tauri::command]
pub async fn start_claude(app: AppHandle, args: StartClaudeArgs) -> Result<String, String> {
    let invocation_id = uuid::Uuid::new_v4().to_string();

    // Build CLI arguments
    let mut cli_args: Vec<String> = vec![
        "-p".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
    ];

    if let Some(ref conv_id) = args.conversation_id {
        cli_args.push("--resume".to_string());
        cli_args.push(conv_id.clone());
    }

    if let Some(ref sys_prompt) = args.system_prompt {
        if !sys_prompt.is_empty() {
            cli_args.push("--system-prompt".to_string());
            cli_args.push(sys_prompt.clone());
        }
    }

    cli_args.push(args.message.clone());

    // Spawn the process using std::process::Command for reliable PATH resolution
    let mut child = Command::new("claude")
        .args(&cli_args)
        .current_dir(&args.working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format_spawn_error(&e))?;

    // Take the stdout/stderr handles before storing the child
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Store the child handle keyed by claude_session_id
    let processes = get_or_init_processes(&app);
    let claude_sid = args.claude_session_id.clone();
    {
        let mut procs = processes.lock().await;
        procs.insert(claude_sid.clone(), child);
    }

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

    // Spawn a background thread to read stdout line by line
    let app_handle = app.clone();
    let inv_id = invocation_id.clone();
    let claude_sid_stdout = claude_sid.clone();
    let processes_clone = processes.clone();

    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let mut line_buffer = String::new();

        for line_result in reader.lines() {
            let line = match line_result {
                Ok(l) => l,
                Err(_) => break,
            };

            if line.trim().is_empty() {
                continue;
            }

            // Accumulate partial JSON if needed
            line_buffer.push_str(&line);

            // Parse via event_stream, then tag with claude_session_id
            let agent_event = event_stream::parse_event(&line_buffer)
                .with_session_id(&claude_sid_stdout);
            line_buffer.clear();

            // Persist conversation_id from Result events
            if agent_event.event_type == AgentEventType::Result {
                if let Some(ref meta) = agent_event.metadata {
                    if let Some(conv_id) = meta.get("session_id").and_then(|v| v.as_str()) {
                        update_session_conversation_id(
                            &app_handle,
                            &claude_sid_stdout,
                            conv_id,
                        );
                    }
                }
            }

            log_to_audit(&app_handle, &agent_event);
            let _ = app_handle.emit("claude-stream", &agent_event);
        }

        // Process terminated — emit done status
        // Try to get exit code from child
        let exit_code = {
            let rt = tauri::async_runtime::handle();
            rt.block_on(async {
                let mut procs = processes_clone.lock().await;
                if let Some(mut child) = procs.remove(&claude_sid_stdout) {
                    child.wait().ok().and_then(|s| s.code())
                } else {
                    None
                }
            })
        };

        let _ = app_handle.emit(
            "claude-stream",
            serde_json::json!({
                "type": "status",
                "status": "done",
                "invocation_id": &inv_id,
                "claude_session_id": &claude_sid_stdout,
                "exit_code": exit_code,
            }),
        );

        update_session_status_in_db(&app_handle, &claude_sid_stdout, "idle");
    });

    // Spawn a background thread to read stderr
    let app_handle_err = app.clone();
    let claude_sid_stderr = claude_sid.clone();

    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line_result in reader.lines() {
            let text = match line_result {
                Ok(l) => l.trim().to_string(),
                Err(_) => break,
            };
            if text.is_empty() {
                continue;
            }

            let error_event = AgentEvent {
                timestamp: Utc::now().to_rfc3339(),
                event_type: AgentEventType::Error,
                content: text,
                metadata: None,
                claude_session_id: Some(claude_sid_stderr.clone()),
            };
            let _ = app_handle_err.emit("claude-stream", &error_event);
        }
    });

    Ok(invocation_id)
}

/// Send a follow-up message in an existing conversation.
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

    if let Some(mut child) = procs.remove(&claude_session_id) {
        child
            .kill()
            .map_err(|e| format!("Failed to kill claude process: {}", e))?;

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
        Err(format!(
            "No active process for claude session: {}",
            claude_session_id
        ))
    }
}

// ── Helpers ──

fn format_spawn_error(e: &std::io::Error) -> String {
    let err_str = e.to_string().to_lowercase();
    if err_str.contains("not found")
        || err_str.contains("no such file")
        || err_str.contains("os error 2")
    {
        "Claude Code CLI not found. Install it with: npm install -g @anthropic-ai/claude-code \
         (https://docs.anthropic.com/en/docs/claude-code)"
            .to_string()
    } else {
        format!(
            "Failed to spawn Claude CLI: {}. \
             Ensure Claude Code CLI is installed: npm install -g @anthropic-ai/claude-code",
            e
        )
    }
}

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
fn update_session_conversation_id(
    app: &AppHandle,
    claude_session_id: &str,
    conversation_id: &str,
) {
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
fn log_to_audit(app: &AppHandle, event: &AgentEvent) {
    if event.event_type == AgentEventType::Raw && event.content.is_empty() {
        return;
    }

    if let Some(db_state) = app.try_state::<DbState>() {
        if let Ok(conn) = db_state.lock() {
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
