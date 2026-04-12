use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::Mutex;

use chrono::Utc;
use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager};

use crate::services::codex_event_stream;
use crate::services::event_stream::{AgentEvent, AgentEventType};

use super::{AgentProcesses, BackendAdapter, CliInfo, ModelInfo, SpawnArgs};

/// Codex CLI backend adapter.
///
/// Wraps the `codex` CLI (`codex exec --json`) and emits events on
/// the `"agent-stream"` channel using the unified envelope format.
pub struct CodexAdapter;

impl BackendAdapter for CodexAdapter {
    fn name(&self) -> &str {
        "codex"
    }

    fn validate(&self) -> Result<CliInfo, String> {
        let output = Command::new("codex")
            .arg("--version")
            .output()
            .map_err(|e| format_spawn_error(&e))?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(CliInfo {
                name: "codex".to_string(),
                version: if version.is_empty() {
                    "unknown".to_string()
                } else {
                    version
                },
            })
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Err(format!("Codex CLI returned an error: {}", stderr))
        }
    }

    fn spawn(&self, args: SpawnArgs, app: &AppHandle) -> Result<String, String> {
        let invocation_id = uuid::Uuid::new_v4().to_string();

        // Build CLI arguments: codex exec --json [-m model] <prompt>
        let mut cli_args: Vec<String> = vec!["exec".to_string(), "--json".to_string()];

        if let Some(ref model) = args.model {
            if !model.is_empty() {
                cli_args.push("-m".to_string());
                cli_args.push(model.clone());
            }
        }

        // Codex has no --system-prompt flag, so prepend system prompt and
        // framework context to the message itself.
        let effective_message = build_message_with_context(
            &args.message,
            args.system_prompt.as_deref(),
            args.framework_context.as_deref(),
        );

        cli_args.push(effective_message);

        eprintln!(
            "[vibe-os][codex-adapter] Spawning: codex {}",
            cli_args.join(" ")
        );
        eprintln!(
            "[vibe-os][codex-adapter] Working dir: {}",
            &args.working_dir
        );
        eprintln!(
            "[vibe-os][codex-adapter] Session ID: {}",
            &args.session_id
        );

        // Spawn the process
        let mut child = Command::new("codex")
            .args(&cli_args)
            .current_dir(&args.working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                eprintln!("[vibe-os][codex-adapter] Failed to spawn codex: {}", e);
                format_spawn_error(&e)
            })?;

        eprintln!(
            "[vibe-os][codex-adapter] Process spawned (pid: {:?})",
            child.id()
        );

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

        // Store in AgentProcesses managed state
        let processes: AgentProcesses = app
            .try_state::<AgentProcesses>()
            .map(|s| s.inner().clone())
            .ok_or("AgentProcesses state not registered")?;

        let session_id = args.session_id.clone();
        {
            let rt = tauri::async_runtime::handle();
            rt.block_on(async {
                let mut procs = processes.lock().await;
                procs.insert(session_id.clone(), child);
            });
        }

        // Emit "working" status envelope
        let _ = app.emit(
            "agent-stream",
            serde_json::json!({
                "type": "status",
                "source": "cli-codex",
                "sessionId": &session_id,
                "status": "working",
            }),
        );

        // Spawn stdout reader thread
        let app_handle = app.clone();
        let inv_id = invocation_id.clone();
        let sid_stdout = session_id.clone();
        let processes_clone = processes.clone();

        std::thread::spawn(move || {
            eprintln!(
                "[vibe-os][codex-adapter] Stdout reader started for session {}",
                &sid_stdout
            );
            let reader = BufReader::new(stdout);
            let mut line_count = 0u64;

            for line_result in reader.lines() {
                let line = match line_result {
                    Ok(l) => l,
                    Err(e) => {
                        eprintln!("[vibe-os][codex-adapter] Stdout read error: {}", e);
                        break;
                    }
                };
                line_count += 1;
                if line_count <= 5 {
                    eprintln!(
                        "[vibe-os][codex-adapter] Stdout line {}: {}...",
                        line_count,
                        &line[..line.len().min(120)]
                    );
                }

                if line.trim().is_empty() {
                    continue;
                }

                let agent_event = codex_event_stream::parse_event(&line)
                    .with_session_id(&sid_stdout);

                // Notify workflow engine of phase completion on Result events
                if agent_event.event_type == AgentEventType::Result {
                    let app_for_workflow = app_handle.clone();
                    let sid_for_workflow = sid_stdout.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Some(db) = app_for_workflow.try_state::<Mutex<Connection>>() {
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

                // Emit in unified envelope format
                let envelope = serde_json::json!({
                    "type": "agent_event",
                    "source": "cli-codex",
                    "sessionId": &sid_stdout,
                    "event": &agent_event,
                });
                let _ = app_handle.emit("agent-stream", &envelope);
            }

            // Process terminated — get exit code
            let exit_code = {
                let rt = tauri::async_runtime::handle();
                rt.block_on(async {
                    let mut procs = processes_clone.lock().await;
                    if let Some(mut child) = procs.remove(&sid_stdout) {
                        child.wait().ok().and_then(|s| s.code())
                    } else {
                        None
                    }
                })
            };

            // Emit "done" status envelope
            let _ = app_handle.emit(
                "agent-stream",
                serde_json::json!({
                    "type": "status",
                    "source": "cli-codex",
                    "sessionId": &sid_stdout,
                    "status": "done",
                    "exit_code": exit_code,
                    "invocation_id": &inv_id,
                }),
            );
        });

        // Spawn stderr reader thread
        let app_handle_err = app.clone();
        let sid_stderr = session_id.clone();

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
                    agent_session_id: Some(sid_stderr.clone()),
                };

                let envelope = serde_json::json!({
                    "type": "agent_event",
                    "source": "cli-codex",
                    "sessionId": &sid_stderr,
                    "event": &error_event,
                });
                let _ = app_handle_err.emit("agent-stream", &envelope);
            }
        });

        Ok(invocation_id)
    }

    fn send_input(&self, _session_id: &str, _input: &str, _app: &AppHandle) -> Result<(), String> {
        Err("Codex CLI does not support stdin input".to_string())
    }

    fn cancel(&self, session_id: &str, app: &AppHandle) -> Result<(), String> {
        let processes: AgentProcesses = app
            .try_state::<AgentProcesses>()
            .map(|s| s.inner().clone())
            .ok_or("AgentProcesses state not registered")?;

        let rt = tauri::async_runtime::handle();
        rt.block_on(async {
            let mut procs = processes.lock().await;
            if let Some(mut child) = procs.remove(session_id) {
                child
                    .kill()
                    .map_err(|e| format!("Failed to kill codex process: {}", e))?;

                let _ = app.emit(
                    "agent-stream",
                    serde_json::json!({
                        "type": "status",
                        "source": "cli-codex",
                        "sessionId": session_id,
                        "status": "cancelled",
                    }),
                );

                Ok(())
            } else {
                Err(format!(
                    "No active Codex process for session: {}",
                    session_id
                ))
            }
        })
    }

    fn supported_models(&self) -> Vec<ModelInfo> {
        vec![
            ModelInfo {
                id: "o3".to_string(),
                name: "o3".to_string(),
                backend: "codex".to_string(),
            },
            ModelInfo {
                id: "gpt-4.1".to_string(),
                name: "GPT-4.1".to_string(),
                backend: "codex".to_string(),
            },
            ModelInfo {
                id: "o4-mini".to_string(),
                name: "o4-mini".to_string(),
                backend: "codex".to_string(),
            },
        ]
    }
}

/// Prepend system prompt and framework context to the user message.
/// Codex has no --system-prompt flag, so we combine them into the message.
fn build_message_with_context(
    message: &str,
    system_prompt: Option<&str>,
    framework_context: Option<&str>,
) -> String {
    let mut parts: Vec<&str> = Vec::new();

    if let Some(ctx) = framework_context {
        if !ctx.is_empty() {
            parts.push(ctx);
        }
    }

    if let Some(prompt) = system_prompt {
        if !prompt.is_empty() {
            parts.push(prompt);
        }
    }

    if parts.is_empty() {
        message.to_string()
    } else {
        parts.push(message);
        parts.join("\n\n")
    }
}

fn format_spawn_error(e: &std::io::Error) -> String {
    let err_str = e.to_string().to_lowercase();
    if err_str.contains("not found")
        || err_str.contains("no such file")
        || err_str.contains("os error 2")
    {
        "Codex CLI not found. Install it with: npm install -g @openai/codex \
         (https://github.com/openai/codex)"
            .to_string()
    } else {
        format!(
            "Failed to spawn Codex CLI: {}. \
             Ensure Codex CLI is installed: npm install -g @openai/codex",
            e
        )
    }
}
