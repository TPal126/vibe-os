use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex as TokioMutex;

use crate::services::event_stream::{self, AgentEvent, AgentEventType};

use super::db_commands::DbState;

// ── Process State ──

/// Managed state for active CLI processes.
/// Key: agent_session_id, Value: the Child handle.
pub type ClaudeProcesses = Arc<TokioMutex<HashMap<String, Child>>>;

#[derive(Debug, Deserialize)]
pub struct StartClaudeArgs {
    pub working_dir: String,
    pub message: String,
    pub system_prompt: Option<String>,
    pub conversation_id: Option<String>,
    pub agent_session_id: String,
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
/// and emits them as 'agent-stream' Tauri events.
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

    // Log the command for debugging
    eprintln!("[vibe-os] Spawning claude CLI: claude {}", cli_args.join(" "));
    eprintln!("[vibe-os] Working dir: {}", &args.working_dir);
    eprintln!("[vibe-os] Session ID: {}", &args.agent_session_id);

    // Spawn the process using std::process::Command for reliable PATH resolution
    let mut child = Command::new("claude")
        .args(&cli_args)
        .current_dir(&args.working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            eprintln!("[vibe-os] Failed to spawn claude: {}", e);
            format_spawn_error(&e)
        })?;

    eprintln!("[vibe-os] Claude process spawned (pid: {:?})", child.id());

    // Take the stdout/stderr handles before storing the child
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Store the child handle keyed by agent_session_id
    let processes = get_or_init_processes(&app);
    let session_id = args.agent_session_id.clone();
    {
        let mut procs = processes.lock().await;
        procs.insert(session_id.clone(), child);
    }

    update_session_status_in_db(&app, &session_id, "active");

    // Emit a "working" status envelope
    let _ = app.emit(
        "agent-stream",
        serde_json::json!({
            "type": "status",
            "source": "cli-claude",
            "sessionId": &session_id,
            "status": "working",
        }),
    );

    // Spawn a background thread to read stdout line by line
    let app_handle = app.clone();
    let inv_id = invocation_id.clone();
    let claude_sid_stdout = session_id.clone();
    let processes_clone = processes.clone();
    let working_dir_for_index = args.working_dir.clone();

    std::thread::spawn(move || {
        eprintln!("[vibe-os] Stdout reader started for session {}", &claude_sid_stdout);
        let reader = BufReader::new(stdout);
        let mut line_buffer = String::new();
        let mut line_count = 0u64;

        for line_result in reader.lines() {
            let line = match line_result {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("[vibe-os] Stdout read error: {}", e);
                    break;
                }
            };
            line_count += 1;
            if line_count <= 5 {
                eprintln!("[vibe-os] Stdout line {}: {}...", line_count, &line[..line.len().min(120)]);
            }

            if line.trim().is_empty() {
                continue;
            }

            // Accumulate partial JSON if needed
            line_buffer.push_str(&line);

            // Parse via event_stream, then tag with agent_session_id
            let agent_event = event_stream::parse_event(&line_buffer)
                .with_session_id(&claude_sid_stdout);
            line_buffer.clear();

            if line_count <= 5 {
                eprintln!("[vibe-os] Parsed event type: {:?}", agent_event.event_type);
            }

            // Persist conversation_id from Result events and trigger auto-indexing
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

                // Auto-index repo into knowledge graph (fire-and-forget)
                if let Some(graph_db) = app_handle.try_state::<surrealdb::Surreal<surrealdb::engine::local::Db>>() {
                    let gdb = graph_db.inner().clone();
                    let repo_path = working_dir_for_index.clone();
                    let session_id = claude_sid_stdout.clone();
                    tauri::async_runtime::spawn(async move {
                        match crate::graph::indexer::index_repo(&gdb, &repo_path, &session_id).await {
                            Ok(result) => {
                                log::info!(
                                    "Auto-indexed repo '{}' after session completion: {} files, {} modules, {} functions, {} classes, {} edges",
                                    repo_path, result.total_files, result.modules_created,
                                    result.functions_created, result.classes_created,
                                    result.edges_created
                                );
                            }
                            Err(e) => {
                                log::warn!(
                                    "Auto-index failed for '{}': {}",
                                    repo_path, e
                                );
                            }
                        }
                    });
                }

                // Notify workflow engine of phase completion (fire-and-forget)
                let app_for_workflow = app_handle.clone();
                let sid_for_workflow = claude_sid_stdout.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(db) = app_for_workflow.try_state::<DbState>() {
                        let phase_info: Option<(String, String)> = {
                            if let Ok(conn) = db.lock() {
                                conn.query_row(
                                    "SELECT pr.id, pr.pipeline_run_id FROM phase_run pr \
                                     WHERE pr.session_id = ?1 AND pr.status = 'running' LIMIT 1",
                                    rusqlite::params![sid_for_workflow],
                                    |row| Ok((row.get(0)?, row.get(1)?)),
                                )
                                .ok()
                            } else {
                                None
                            }
                        };

                        if let Some((phase_run_id, pipeline_run_id)) = phase_info {
                            let runner = crate::workflow::runner::WorkflowRunner::new(
                                app_for_workflow,
                            );
                            let _ = runner
                                .on_phase_complete(&pipeline_run_id, &phase_run_id)
                                .await;
                        }
                    }
                });
            }

            log_to_audit(&app_handle, &agent_event);

            // Emit in unified envelope format
            let envelope = serde_json::json!({
                "type": "agent_event",
                "source": "cli-claude",
                "sessionId": &claude_sid_stdout,
                "event": &agent_event,
            });
            let _ = app_handle.emit("agent-stream", &envelope);
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
            "agent-stream",
            serde_json::json!({
                "type": "status",
                "source": "cli-claude",
                "sessionId": &claude_sid_stdout,
                "status": "done",
                "exit_code": exit_code,
                "invocation_id": &inv_id,
            }),
        );

        update_session_status_in_db(&app_handle, &claude_sid_stdout, "idle");
    });

    // Spawn a background thread to read stderr
    let app_handle_err = app.clone();
    let claude_sid_stderr = session_id.clone();

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
                agent_session_id: Some(claude_sid_stderr.clone()),
            };
            let envelope = serde_json::json!({
                "type": "agent_event",
                "source": "cli-claude",
                "sessionId": &claude_sid_stderr,
                "event": &error_event,
            });
            let _ = app_handle_err.emit("agent-stream", &envelope);
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
    agent_session_id: String,
) -> Result<String, String> {
    start_claude(
        app,
        StartClaudeArgs {
            working_dir,
            message,
            system_prompt: None,
            conversation_id: Some(conversation_id),
            agent_session_id,
        },
    )
    .await
}

/// Cancel a running Claude CLI invocation by killing the process.
#[tauri::command]
pub async fn cancel_claude(app: AppHandle, agent_session_id: String) -> Result<(), String> {
    let processes = get_or_init_processes(&app);
    let mut procs = processes.lock().await;

    if let Some(mut child) = procs.remove(&agent_session_id) {
        child
            .kill()
            .map_err(|e| format!("Failed to kill claude process: {}", e))?;

        let _ = app.emit(
            "agent-stream",
            serde_json::json!({
                "type": "status",
                "source": "cli-claude",
                "sessionId": &agent_session_id,
                "status": "cancelled",
            }),
        );

        update_session_status_in_db(&app, &agent_session_id, "idle");
        Ok(())
    } else {
        Err(format!(
            "No active process for agent session: {}",
            agent_session_id
        ))
    }
}

// ── Session discovery types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodeSession {
    pub id: String,
    pub status: String,
    pub created_at: String,
    pub working_dir: String,
}

/// List running/backgrounded Claude Code sessions.
/// Runs `claude sessions list --json` and parses the output.
#[tauri::command]
pub async fn list_claude_code_sessions() -> Result<Vec<ClaudeCodeSession>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let output = Command::new("claude")
            .args(["sessions", "list", "--json"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| format_spawn_error(&e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(format!("Failed to list sessions: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let trimmed = stdout.trim();

        if trimmed.is_empty() || trimmed == "[]" {
            return Ok(Vec::new());
        }

        // Parse the JSON output — Claude CLI may return an array of session objects
        let raw: serde_json::Value =
            serde_json::from_str(trimmed).map_err(|e| format!("Failed to parse session list JSON: {}", e))?;

        let sessions = match raw {
            serde_json::Value::Array(arr) => arr
                .into_iter()
                .filter_map(|v| {
                    let id = v.get("id").or_else(|| v.get("sessionId"))
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .to_string();

                    if id.is_empty() {
                        return None;
                    }

                    let status = v.get("status")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();

                    let created_at = v.get("created_at")
                        .or_else(|| v.get("createdAt"))
                        .or_else(|| v.get("startedAt"))
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .to_string();

                    let working_dir = v.get("working_dir")
                        .or_else(|| v.get("workingDir"))
                        .or_else(|| v.get("cwd"))
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .to_string();

                    Some(ClaudeCodeSession {
                        id,
                        status,
                        created_at,
                        working_dir,
                    })
                })
                .collect(),
            _ => Vec::new(),
        };

        Ok(sessions)
    })
    .await
    .map_err(|e| format!("Session list task failed: {}", e))?
}

/// Attach to a backgrounded Claude Code session.
/// Runs `claude sessions resume <id>` piping output through the same event stream as `start_claude`.
#[tauri::command]
pub async fn attach_claude_code_session(
    app: AppHandle,
    session_id: String,
    agent_session_id: String,
) -> Result<String, String> {
    let invocation_id = uuid::Uuid::new_v4().to_string();

    let cli_args = vec![
        "sessions".to_string(),
        "resume".to_string(),
        session_id.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
    ];

    let mut child = Command::new("claude")
        .args(&cli_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format_spawn_error(&e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Store the child handle keyed by agent_session_id
    let processes = get_or_init_processes(&app);
    let agent_sid = agent_session_id.clone();
    {
        let mut procs = processes.lock().await;
        procs.insert(agent_sid.clone(), child);
    }

    update_session_status_in_db(&app, &agent_sid, "active");

    let _ = app.emit(
        "agent-stream",
        serde_json::json!({
            "type": "status",
            "source": "cli-claude",
            "sessionId": &agent_sid,
            "status": "working",
        }),
    );

    // Spawn stdout reader thread (same pattern as start_claude)
    let app_handle = app.clone();
    let inv_id = invocation_id.clone();
    let claude_sid_stdout = agent_sid.clone();
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

            line_buffer.push_str(&line);

            let agent_event = event_stream::parse_event(&line_buffer)
                .with_session_id(&claude_sid_stdout);
            line_buffer.clear();

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

                // Notify workflow engine of phase completion (fire-and-forget)
                let app_for_workflow = app_handle.clone();
                let sid_for_workflow = claude_sid_stdout.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(db) = app_for_workflow.try_state::<DbState>() {
                        let phase_info: Option<(String, String)> = {
                            if let Ok(conn) = db.lock() {
                                conn.query_row(
                                    "SELECT pr.id, pr.pipeline_run_id FROM phase_run pr \
                                     WHERE pr.session_id = ?1 AND pr.status = 'running' LIMIT 1",
                                    rusqlite::params![sid_for_workflow],
                                    |row| Ok((row.get(0)?, row.get(1)?)),
                                )
                                .ok()
                            } else {
                                None
                            }
                        };

                        if let Some((phase_run_id, pipeline_run_id)) = phase_info {
                            let runner = crate::workflow::runner::WorkflowRunner::new(
                                app_for_workflow,
                            );
                            let _ = runner
                                .on_phase_complete(&pipeline_run_id, &phase_run_id)
                                .await;
                        }
                    }
                });
            }

            log_to_audit(&app_handle, &agent_event);

            // Emit in unified envelope format
            let envelope = serde_json::json!({
                "type": "agent_event",
                "source": "cli-claude",
                "sessionId": &claude_sid_stdout,
                "event": &agent_event,
            });
            let _ = app_handle.emit("agent-stream", &envelope);
        }

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
            "agent-stream",
            serde_json::json!({
                "type": "status",
                "source": "cli-claude",
                "sessionId": &claude_sid_stdout,
                "status": "done",
                "exit_code": exit_code,
                "invocation_id": &inv_id,
            }),
        );

        update_session_status_in_db(&app_handle, &claude_sid_stdout, "idle");
    });

    // Spawn stderr reader thread
    let app_handle_err = app.clone();
    let claude_sid_stderr = agent_sid.clone();

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
                agent_session_id: Some(claude_sid_stderr.clone()),
            };
            let envelope = serde_json::json!({
                "type": "agent_event",
                "source": "cli-claude",
                "sessionId": &claude_sid_stderr,
                "event": &error_event,
            });
            let _ = app_handle_err.emit("agent-stream", &envelope);
        }
    });

    Ok(invocation_id)
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

/// Log an AgentEvent to the unified events table.
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

                // Determine kind and decision-specific fields
                let is_decision = event.event_type == AgentEventType::Decision;
                let kind = if is_decision { "decision" } else { "action" };
                let rationale = if is_decision {
                    Some("Auto-captured from agent stream".to_string())
                } else {
                    None
                };
                let confidence = if is_decision { Some(0.8) } else { None };
                let impact_category = if is_decision {
                    Some("architecture".to_string())
                } else {
                    None
                };
                let reversible = if is_decision { Some(1i32) } else { None };
                let related_files = if is_decision {
                    event
                        .metadata
                        .as_ref()
                        .and_then(|m| m.get("path"))
                        .and_then(|v| v.as_str())
                        .map(|p| serde_json::json!([p]).to_string())
                } else {
                    None
                };

                let _ = conn.execute(
                    "INSERT INTO events (id, session_id, timestamp, kind, action_type, detail, actor, metadata, rationale, confidence, impact_category, reversible, related_files, related_tickets)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'agent', ?7, ?8, ?9, ?10, ?11, ?12, NULL)",
                    rusqlite::params![
                        id,
                        session_id,
                        event.timestamp,
                        kind,
                        action_type,
                        event.content,
                        metadata_str,
                        rationale,
                        confidence,
                        impact_category,
                        reversible,
                        related_files,
                    ],
                );

                // Mirror to knowledge graph via unified populate_event (fire-and-forget async)
                if let Some(graph_db) = app.try_state::<surrealdb::Surreal<surrealdb::engine::local::Db>>() {
                    let gdb = graph_db.inner().clone();
                    let gid = id.clone();
                    let gsid = session_id.clone();
                    let gkind = kind.to_string();
                    let gat = action_type.clone();
                    let gdet = event.content.clone();
                    let gts = event.timestamp.clone();
                    let gmeta = metadata_str.clone();
                    let grationale = rationale.clone();
                    let gconfidence = confidence;
                    let gimpact = impact_category.clone();
                    let greversible = if is_decision { Some(true) } else { None };
                    let gfiles: Vec<String> = if is_decision {
                        event
                            .metadata
                            .as_ref()
                            .and_then(|m| m.get("path"))
                            .and_then(|v| v.as_str())
                            .map(|p| vec![p.to_string()])
                            .unwrap_or_default()
                    } else {
                        vec![]
                    };

                    tauri::async_runtime::spawn(async move {
                        let _ = crate::graph::population::populate_event(
                            &gdb,
                            &gid,
                            &gsid,
                            &gkind,
                            &gat,
                            &gdet,
                            "agent",
                            &gts,
                            gmeta.as_deref(),
                            grationale.as_deref(),
                            gconfidence,
                            gimpact.as_deref(),
                            greversible,
                            &gfiles,
                            &[],
                        )
                        .await;
                    });
                }
            }
        }
    }
}
