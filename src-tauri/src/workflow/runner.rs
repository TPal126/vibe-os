use std::sync::Mutex;

use chrono::Utc;
use rusqlite::{params, Connection};
use tauri::{AppHandle, Emitter, Manager};

use crate::backends::claude::ClaudeAdapter;
use crate::backends::codex::CodexAdapter;
use crate::backends::{BackendAdapter, SpawnArgs};

// ── Return types ──

#[derive(Debug, Clone, serde::Serialize)]
pub struct PipelineRunStatus {
    pub pipeline_run_id: String,
    pub status: String,
    pub current_phase: Option<PhaseRunInfo>,
    pub completed_phases: Vec<PhaseRunInfo>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PhaseRunInfo {
    pub phase_run_id: String,
    pub phase_id: String,
    pub label: String,
    pub status: String,
    pub artifact_path: Option<String>,
    pub summary: Option<String>,
}

// ── WorkflowRunner ──

pub struct WorkflowRunner {
    app: AppHandle,
}

impl WorkflowRunner {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    /// Start a pipeline run: insert pipeline_run, then kick off the first phase.
    pub async fn start_pipeline(&self, pipeline_id: &str) -> Result<String, String> {
        let (pipeline_run_id, first_phase_id) = {
            let db = self.app.state::<Mutex<Connection>>();
            let conn = db.lock().map_err(|e| format!("DB lock: {}", e))?;

            // Fetch all phases ordered by position
            let mut stmt = conn
                .prepare(
                    "SELECT id FROM pipeline_phase WHERE pipeline_id = ?1 ORDER BY position ASC",
                )
                .map_err(|e| format!("Query pipeline_phase: {}", e))?;

            let phase_ids: Vec<String> = stmt
                .query_map(params![pipeline_id], |row| row.get::<_, String>(0))
                .map_err(|e| format!("Fetch phases: {}", e))?
                .filter_map(|r| r.ok())
                .collect();

            if phase_ids.is_empty() {
                return Err(format!(
                    "No phases found for pipeline '{}'",
                    pipeline_id
                ));
            }

            let pipeline_run_id = uuid::Uuid::new_v4().to_string();
            let now = Utc::now().to_rfc3339();

            conn.execute(
                "INSERT INTO pipeline_run (id, pipeline_id, status, started_at) VALUES (?1, ?2, ?3, ?4)",
                params![pipeline_run_id, pipeline_id, "running", now],
            )
            .map_err(|e| format!("Insert pipeline_run: {}", e))?;

            let first_phase_id = phase_ids[0].clone();
            (pipeline_run_id, first_phase_id)
        }; // conn and db dropped here

        self.start_phase(&pipeline_run_id, &first_phase_id, None)
            .await?;

        Ok(pipeline_run_id)
    }

    /// Start a single phase within a pipeline run.
    async fn start_phase(
        &self,
        pipeline_run_id: &str,
        phase_id: &str,
        previous_context: Option<String>,
    ) -> Result<String, String> {
        let (phase_run_id, backend, args) = {
            let db = self.app.state::<Mutex<Connection>>();
            let conn = db.lock().map_err(|e| format!("DB lock: {}", e))?;

            // 1. Fetch phase config
            let (backend, framework, model, custom_prompt, _label, phase_type): (
                String,
                String,
                String,
                Option<String>,
                String,
                String,
            ) = conn
                .query_row(
                    "SELECT backend, framework, model, custom_prompt, label, phase_type \
                     FROM pipeline_phase WHERE id = ?1",
                    params![phase_id],
                    |row| {
                        Ok((
                            row.get(0)?,
                            row.get(1)?,
                            row.get(2)?,
                            row.get(3)?,
                            row.get(4)?,
                            row.get(5)?,
                        ))
                    },
                )
                .map_err(|e| format!("Query pipeline_phase config: {}", e))?;

            // 2. Resolve workspace_path: pipeline_run -> pipeline -> project -> workspace_path
            let pipeline_id: String = conn
                .query_row(
                    "SELECT pipeline_id FROM pipeline_run WHERE id = ?1",
                    params![pipeline_run_id],
                    |row| row.get(0),
                )
                .map_err(|e| format!("Query pipeline_run: {}", e))?;

            let project_id: String = conn
                .query_row(
                    "SELECT project_id FROM pipeline WHERE id = ?1",
                    params![pipeline_id],
                    |row| row.get(0),
                )
                .map_err(|e| format!("Query pipeline: {}", e))?;

            let workspace_path: String = conn
                .query_row(
                    "SELECT workspace_path FROM projects WHERE id = ?1",
                    params![project_id],
                    |row| row.get(0),
                )
                .map_err(|e| format!("Query projects: {}", e))?;

            // 3. Generate IDs
            let phase_run_id = uuid::Uuid::new_v4().to_string();
            let session_id = uuid::Uuid::new_v4().to_string();

            // 4. Build SpawnArgs
            let message = custom_prompt
                .filter(|p| !p.is_empty())
                .unwrap_or_else(|| format!("Run {} phase using {} framework", phase_type, framework));

            let args = SpawnArgs {
                working_dir: workspace_path,
                message,
                system_prompt: None,
                session_id: session_id.clone(),
                model: if model.is_empty() { None } else { Some(model) },
                framework_context: previous_context,
                resume_id: None,
            };

            // 5. Insert phase_run
            let now = Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO phase_run (id, pipeline_run_id, phase_id, session_id, status, started_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![phase_run_id, pipeline_run_id, phase_id, session_id, "running", now],
            )
            .map_err(|e| format!("Insert phase_run: {}", e))?;

            (phase_run_id, backend, args)
        }; // conn and db dropped here

        // 6. Dispatch to the right adapter
        let spawn_result = match backend.as_str() {
            "claude" => {
                let adapter = ClaudeAdapter;
                adapter.spawn(args, &self.app)
            }
            "codex" => {
                let adapter = CodexAdapter;
                adapter.spawn(args, &self.app)
            }
            other => Err(format!("Unknown backend: {}", other)),
        };

        // If spawn failed, mark phase_run as failed
        if let Err(ref err) = spawn_result {
            let db = self.app.state::<Mutex<Connection>>();
            if let Ok(conn) = db.lock() {
                let now = Utc::now().to_rfc3339();
                let _ = conn.execute(
                    "UPDATE phase_run SET status = 'failed', summary = ?1, completed_at = ?2 WHERE id = ?3",
                    params![err, now, phase_run_id],
                );
            }
            return Err(err.clone());
        }

        Ok(phase_run_id)
    }

    /// Called when a phase finishes. Advances to next phase or completes the run.
    pub async fn on_phase_complete(
        &self,
        pipeline_run_id: &str,
        phase_run_id: &str,
    ) -> Result<(), String> {
        // Collect all needed data in a single DB scope
        let (gate_after, label, session_id, next_phase_id, summary, artifact_path, pipeline_id) = {
            let db = self.app.state::<Mutex<Connection>>();
            let conn = db.lock().map_err(|e| format!("DB lock: {}", e))?;

            // 1. Mark phase_run as completed
            let now = Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE phase_run SET status = 'completed', completed_at = ?1 WHERE id = ?2",
                params![now, phase_run_id],
            )
            .map_err(|e| format!("Update phase_run: {}", e))?;

            // 2. Get phase_id and session_id from phase_run
            let (phase_id, session_id): (String, String) = conn
                .query_row(
                    "SELECT phase_id, session_id FROM phase_run WHERE id = ?1",
                    params![phase_run_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .map_err(|e| format!("Query phase_run: {}", e))?;

            // 3. Get gate_after, position, pipeline_id, label from pipeline_phase
            let (gate_after, position, pipeline_id, label): (String, i64, String, String) = conn
                .query_row(
                    "SELECT gate_after, position, pipeline_id, label FROM pipeline_phase WHERE id = ?1",
                    params![phase_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                )
                .map_err(|e| format!("Query pipeline_phase: {}", e))?;

            // 4. Look for the next phase
            let next_phase_id: Option<String> = conn
                .query_row(
                    "SELECT id FROM pipeline_phase WHERE pipeline_id = ?1 AND position > ?2 ORDER BY position ASC LIMIT 1",
                    params![pipeline_id, position],
                    |row| row.get(0),
                )
                .ok();

            // Get summary and artifact_path for handoff context
            let (summary, artifact_path): (Option<String>, Option<String>) = conn
                .query_row(
                    "SELECT summary, artifact_path FROM phase_run WHERE id = ?1",
                    params![phase_run_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .map_err(|e| format!("Query phase_run for handoff: {}", e))?;

            (gate_after, label, session_id, next_phase_id, summary, artifact_path, pipeline_id)
        }; // conn and db dropped here

        // Suppress unused variable warning — pipeline_id used for clarity in data fetch
        let _ = &pipeline_id;

        match (gate_after.as_str(), next_phase_id) {
            ("auto", Some(next_id)) => {
                // Build handoff context and auto-advance
                let context = build_handoff_context(&label, summary.as_deref(), artifact_path.as_deref());
                self.start_phase(pipeline_run_id, &next_id, Some(context))
                    .await?;
            }
            ("gated", Some(next_id)) | (_, Some(next_id)) => {
                // Update phase_run status to awaiting_gate
                {
                    let db = self.app.state::<Mutex<Connection>>();
                    let conn = db.lock().map_err(|e| format!("DB lock: {}", e))?;
                    conn.execute(
                        "UPDATE phase_run SET status = 'awaiting_gate' WHERE id = ?1",
                        params![phase_run_id],
                    )
                    .map_err(|e| format!("Update phase_run gate: {}", e))?;
                }

                // Emit PhaseTransition event
                let now = Utc::now().to_rfc3339();
                let _ = self.app.emit(
                    "agent-stream",
                    serde_json::json!({
                        "type": "agent_event",
                        "source": "workflow",
                        "sessionId": session_id,
                        "event": {
                            "event_type": "phase_transition",
                            "content": format!("Phase '{}' complete. Review and continue.", label),
                            "metadata": {
                                "gate": "awaiting",
                                "next_phase_id": next_id,
                                "pipeline_run_id": pipeline_run_id,
                                "phase_run_id": phase_run_id,
                            },
                            "timestamp": now,
                        }
                    }),
                );
            }
            (_, None) => {
                // No more phases — mark pipeline_run as completed
                let db = self.app.state::<Mutex<Connection>>();
                let conn = db.lock().map_err(|e| format!("DB lock: {}", e))?;
                let now = Utc::now().to_rfc3339();
                conn.execute(
                    "UPDATE pipeline_run SET status = 'completed', completed_at = ?1 WHERE id = ?2",
                    params![now, pipeline_run_id],
                )
                .map_err(|e| format!("Update pipeline_run: {}", e))?;
            }
        }

        Ok(())
    }

    /// Advance past a gated phase to the next phase.
    pub async fn advance_gate(&self, pipeline_run_id: &str) -> Result<(), String> {
        let (next_phase_id, label, summary, artifact_path) = {
            let db = self.app.state::<Mutex<Connection>>();
            let conn = db.lock().map_err(|e| format!("DB lock: {}", e))?;

            // 1. Find the phase_run that is awaiting_gate
            let (awaiting_phase_run_id, phase_id, summary, artifact_path): (
                String,
                String,
                Option<String>,
                Option<String>,
            ) = conn
                .query_row(
                    "SELECT id, phase_id, summary, artifact_path FROM phase_run \
                     WHERE pipeline_run_id = ?1 AND status = 'awaiting_gate' LIMIT 1",
                    params![pipeline_run_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                )
                .map_err(|_| {
                    format!(
                        "No phase awaiting gate for pipeline run '{}'",
                        pipeline_run_id
                    )
                })?;

            // 2. Get position, pipeline_id, label from pipeline_phase
            let (position, pipeline_id, label): (i64, String, String) = conn
                .query_row(
                    "SELECT position, pipeline_id, label FROM pipeline_phase WHERE id = ?1",
                    params![phase_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .map_err(|e| format!("Query pipeline_phase: {}", e))?;

            // 3. Find the next phase
            let next_phase_id: String = conn
                .query_row(
                    "SELECT id FROM pipeline_phase WHERE pipeline_id = ?1 AND position > ?2 ORDER BY position ASC LIMIT 1",
                    params![pipeline_id, position],
                    |row| row.get(0),
                )
                .map_err(|_| "No next phase found to advance to".to_string())?;

            // 4. Update the awaiting phase_run to "gate_passed"
            let now = Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE phase_run SET status = 'gate_passed', completed_at = ?1 WHERE id = ?2",
                params![now, awaiting_phase_run_id],
            )
            .map_err(|e| format!("Update phase_run gate_passed: {}", e))?;

            (next_phase_id, label, summary, artifact_path)
        }; // conn and db dropped here

        // 5. Build handoff context and start next phase
        let context = build_handoff_context(&label, summary.as_deref(), artifact_path.as_deref());
        self.start_phase(pipeline_run_id, &next_phase_id, Some(context))
            .await?;

        Ok(())
    }

    /// Get the current status of a pipeline run with all phase details.
    pub async fn get_run_status(
        &self,
        pipeline_run_id: &str,
    ) -> Result<PipelineRunStatus, String> {
        let db = self.app.state::<Mutex<Connection>>();
        let conn = db.lock().map_err(|e| format!("DB lock: {}", e))?;

        // 1. Get pipeline_run status
        let status: String = conn
            .query_row(
                "SELECT status FROM pipeline_run WHERE id = ?1",
                params![pipeline_run_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Query pipeline_run: {}", e))?;

        // 2. Fetch all phase_runs with their labels
        let mut stmt = conn
            .prepare(
                "SELECT pr.id, pr.phase_id, pp.label, pr.status, pr.artifact_path, pr.summary \
                 FROM phase_run pr \
                 JOIN pipeline_phase pp ON pr.phase_id = pp.id \
                 WHERE pr.pipeline_run_id = ?1 \
                 ORDER BY pp.position ASC",
            )
            .map_err(|e| format!("Prepare phase_run query: {}", e))?;

        let phase_runs: Vec<PhaseRunInfo> = stmt
            .query_map(params![pipeline_run_id], |row| {
                Ok(PhaseRunInfo {
                    phase_run_id: row.get(0)?,
                    phase_id: row.get(1)?,
                    label: row.get(2)?,
                    status: row.get(3)?,
                    artifact_path: row.get(4)?,
                    summary: row.get(5)?,
                })
            })
            .map_err(|e| format!("Fetch phase_runs: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        // 3. Split into current and completed
        let mut current_phase: Option<PhaseRunInfo> = None;
        let mut completed_phases: Vec<PhaseRunInfo> = Vec::new();

        for pr in phase_runs {
            match pr.status.as_str() {
                "running" | "awaiting_gate" => {
                    current_phase = Some(pr);
                }
                _ => {
                    completed_phases.push(pr);
                }
            }
        }

        Ok(PipelineRunStatus {
            pipeline_run_id: pipeline_run_id.to_string(),
            status,
            current_phase,
            completed_phases,
        })
    }
}

/// Build a handoff context string from the completed phase's info.
fn build_handoff_context(
    label: &str,
    summary: Option<&str>,
    artifact_path: Option<&str>,
) -> String {
    let mut context = format!("[Previous Phase]: {}\n", label);

    if let Some(s) = summary {
        if !s.is_empty() {
            context.push_str(&format!("[Summary]: {}\n", s));
        }
    }

    if let Some(path) = artifact_path {
        if !path.is_empty() {
            // Try to read the artifact file for richer context
            if let Ok(content) = std::fs::read_to_string(path) {
                let truncated = if content.len() > 8000 {
                    format!("{}...(truncated)", &content[..8000])
                } else {
                    content
                };
                context.push_str(&format!("[Artifact]:\n{}\n", truncated));
            } else {
                context.push_str(&format!("[Artifact Path]: {}\n", path));
            }
        }
    }

    context
}
