use std::io::BufRead;

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

use crate::services::sidecar::{
    self, SidecarCommand, SidecarEvent, SidecarState,
};
use crate::services::tool_handler;
use crate::graph;

/// Start the sidecar process if not already running.
#[tauri::command]
pub async fn ensure_sidecar(app: AppHandle) -> Result<String, String> {
    let state = app.state::<SidecarState>();
    let mut guard = state.lock().await;

    if guard.as_ref().map(|s| s.ready).unwrap_or(false) {
        return Ok("already_running".to_string());
    }

    let mut child = sidecar::spawn_sidecar()?;

    // Read the first line — should be {"type":"ready"}
    let stdout = sidecar::read_sidecar_stdout(&mut child)
        .ok_or("Failed to get sidecar stdout")?;

    // Store the process (without stdout — we'll take it for the reader thread)
    *guard = Some(sidecar::SidecarProcess { child, ready: false });
    drop(guard);

    // Spawn background reader thread
    let app_handle = app.clone();
    let sidecar_state = app.state::<SidecarState>().inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        for line in stdout.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };

            if line.trim().is_empty() {
                continue;
            }

            let event: SidecarEvent = match serde_json::from_str(&line) {
                Ok(e) => e,
                Err(err) => {
                    eprintln!("[sidecar] Parse error: {} for line: {}", err, line);
                    continue;
                }
            };

            match &event {
                SidecarEvent::Ready => {
                    let _ = app_handle.emit("agent-event", json!({
                        "type": "sidecar_ready"
                    }));
                }

                SidecarEvent::SdkMessage { session_id, message } => {
                    let _ = app_handle.emit("agent-event", json!({
                        "type": "sdk_message",
                        "sessionId": session_id,
                        "message": message,
                    }));
                }

                SidecarEvent::ToolRequest { request_id, tool, input } => {
                    // Handle tool request asynchronously
                    let app2 = app_handle.clone();
                    let state2 = sidecar_state.clone();
                    let rid = request_id.clone();
                    let tool_name = tool.clone();
                    let tool_input = input.clone();

                    tauri::async_runtime::spawn(async move {
                        let graph_db = app2.state::<surrealdb::Surreal<surrealdb::engine::local::Db>>();
                        let result = tool_handler::handle_tool_request(
                            &graph_db,
                            &tool_name,
                            &tool_input,
                            "", // session_id — extracted from context
                        )
                        .await;

                        let response = SidecarCommand::ToolResponse {
                            request_id: rid,
                            result: result.unwrap_or_else(|e| json!({
                                "content": [{"type": "text", "text": format!("Error: {}", e)}]
                            })),
                        };

                        let mut guard = state2.lock().await;
                        if let Some(ref mut proc) = *guard {
                            let _ = sidecar::send_to_sidecar(&mut proc.child, &response);
                        }
                    });
                }

                SidecarEvent::SessionEnded { session_id } => {
                    let _ = app_handle.emit("agent-event", json!({
                        "type": "session_ended",
                        "sessionId": session_id,
                    }));
                }

                SidecarEvent::Error { session_id, error } => {
                    let _ = app_handle.emit("agent-event", json!({
                        "type": "error",
                        "sessionId": session_id,
                        "error": error,
                    }));
                }
            }
        }
    });

    Ok("started".to_string())
}

/// Start an agent session.
#[tauri::command]
pub async fn start_agent(
    app: AppHandle,
    session_id: String,
    prompt: String,
    workspace_path: String,
) -> Result<(), String> {
    // Ensure sidecar is running
    ensure_sidecar(app.clone()).await?;

    // Assemble graph context
    let graph_db = app.state::<surrealdb::Surreal<surrealdb::engine::local::Db>>();
    let graph_context = assemble_graph_context(&graph_db, &prompt, &session_id).await;

    // Build the start command
    let cmd = SidecarCommand::Start {
        session_id: session_id.clone(),
        prompt,
        system_prompt: graph_context,
        options: json!({
            "cwd": workspace_path,
            "model": "sonnet",
            "permissionMode": "acceptEdits",
            "tools": { "type": "preset", "preset": "claude_code" },
            "maxTurns": 50,
            "settingSources": ["project"],
            "effort": "high",
        }),
    };

    let state = app.state::<SidecarState>();
    let mut guard = state.lock().await;
    if let Some(ref mut proc) = *guard {
        sidecar::send_to_sidecar(&mut proc.child, &cmd)?;
    } else {
        return Err("Sidecar not running".to_string());
    }

    Ok(())
}

/// Send a follow-up message to an existing session.
#[tauri::command]
pub async fn send_agent_message(
    app: AppHandle,
    session_id: String,
    prompt: String,
) -> Result<(), String> {
    let cmd = SidecarCommand::Send {
        session_id,
        prompt,
    };

    let state = app.state::<SidecarState>();
    let mut guard = state.lock().await;
    if let Some(ref mut proc) = *guard {
        sidecar::send_to_sidecar(&mut proc.child, &cmd)?;
    } else {
        return Err("Sidecar not running".to_string());
    }

    Ok(())
}

/// Cancel an active agent session.
#[tauri::command]
pub async fn cancel_agent(
    app: AppHandle,
    session_id: String,
) -> Result<(), String> {
    let cmd = SidecarCommand::Cancel { session_id };

    let state = app.state::<SidecarState>();
    let mut guard = state.lock().await;
    if let Some(ref mut proc) = *guard {
        sidecar::send_to_sidecar(&mut proc.child, &cmd)?;
    } else {
        return Err("Sidecar not running".to_string());
    }

    Ok(())
}

/// Get sidecar status.
#[tauri::command]
pub async fn get_sidecar_status(app: AppHandle) -> Result<String, String> {
    let state = app.state::<SidecarState>();
    let guard = state.lock().await;
    match &*guard {
        Some(proc) if proc.ready => Ok("ready".to_string()),
        Some(_) => Ok("starting".to_string()),
        None => Ok("stopped".to_string()),
    }
}

/// Assemble graph context from SurrealDB for the system prompt.
async fn assemble_graph_context(
    graph_db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    user_message: &str,
    session_id: &str,
) -> String {
    let mut context_parts: Vec<String> = Vec::new();

    // Extract file/function references from the user message
    let file_refs = extract_references(user_message);

    // Query provenance for each reference
    for ref_id in &file_refs {
        if let Ok(trace) = graph::queries::get_provenance(graph_db, ref_id).await {
            if !trace.decisions.is_empty() || !trace.tests.is_empty() {
                context_parts.push(format!(
                    "## Provenance: {}\n{}",
                    ref_id,
                    format_provenance(&trace)
                ));
            }
        }
    }

    // Query session history
    if let Ok(report) = graph::queries::get_session_report(graph_db, session_id).await {
        if !report.decisions.is_empty() || !report.timeline.is_empty() {
            context_parts.push(format!(
                "## Session History\n- {} actions, {} decisions, {} tokens used",
                report.timeline.len(),
                report.decisions.len(),
                report.total_tokens,
            ));
        }
    }

    if context_parts.is_empty() {
        String::new()
    } else {
        format!("\n\n# VIBE OS Context\n\n{}", context_parts.join("\n\n"))
    }
}

fn extract_references(message: &str) -> Vec<String> {
    let mut refs = Vec::new();

    // Match file paths like src/foo/bar.ts, components/MyComponent.tsx
    let path_re = regex::Regex::new(r"(?:^|[\s`(])([a-zA-Z][\w/.-]*\.\w{1,5})(?:[\s`),:]|$)").unwrap();
    for cap in path_re.captures_iter(message) {
        if let Some(m) = cap.get(1) {
            refs.push(m.as_str().to_string());
        }
    }

    refs
}

fn format_provenance(trace: &graph::queries::ProvenanceTrace) -> String {
    let mut out = String::new();

    if !trace.decisions.is_empty() {
        out.push_str("### Recent decisions\n");
        for d in &trace.decisions {
            let summary = d["summary"].as_str().unwrap_or("(no summary)");
            let confidence = d["confidence"].as_f64().unwrap_or(0.0);
            out.push_str(&format!("- {} (confidence: {:.1})\n", summary, confidence));
        }
    }

    if !trace.tests.is_empty() {
        out.push_str("### Test coverage\n");
        for t in &trace.tests {
            let name = t["name"].as_str().unwrap_or("(unknown test)");
            let status = t["status"].as_str().unwrap_or("unknown");
            out.push_str(&format!("- {}: {}\n", name, status));
        }
    }

    out
}
