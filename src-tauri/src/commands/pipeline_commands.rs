use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

pub type DbState = Mutex<Connection>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PipelineRow {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PipelinePhaseRow {
    pub id: String,
    pub pipeline_id: String,
    pub position: i64,
    pub label: String,
    pub phase_type: String,
    pub backend: String,
    pub framework: String,
    pub model: String,
    pub custom_prompt: Option<String>,
    pub gate_after: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePhaseArgs {
    pub label: String,
    pub phase_type: String,
    pub backend: String,
    pub framework: String,
    pub model: String,
    pub custom_prompt: Option<String>,
    pub gate_after: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePipelineArgs {
    pub project_id: String,
    pub name: String,
    pub phases: Vec<CreatePhaseArgs>,
}

/// Create a pipeline and all its phases in order.
#[tauri::command]
pub fn create_pipeline(
    state: State<'_, DbState>,
    args: CreatePipelineArgs,
) -> Result<PipelineRow, String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    let pipeline_id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    conn.execute(
        "INSERT INTO pipeline (id, project_id, name, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)",
        rusqlite::params![pipeline_id, args.project_id, args.name, now],
    )
    .map_err(|e| format!("Failed to create pipeline: {}", e))?;

    for (position, phase) in args.phases.iter().enumerate() {
        let phase_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO pipeline_phase
                 (id, pipeline_id, position, label, phase_type, backend, framework, model, custom_prompt, gate_after)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                phase_id,
                pipeline_id,
                position as i64,
                phase.label,
                phase.phase_type,
                phase.backend,
                phase.framework,
                phase.model,
                phase.custom_prompt,
                phase.gate_after,
            ],
        )
        .map_err(|e| format!("Failed to insert phase at position {}: {}", position, e))?;
    }

    Ok(PipelineRow {
        id: pipeline_id,
        project_id: args.project_id,
        name: args.name,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Get the pipeline for a project (returns the first/only pipeline).
#[tauri::command]
pub fn get_project_pipeline(
    state: State<'_, DbState>,
    project_id: String,
) -> Result<Option<PipelineRow>, String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    let result = conn.query_row(
        "SELECT id, project_id, name, created_at, updated_at
         FROM pipeline WHERE project_id = ?1 LIMIT 1",
        rusqlite::params![project_id],
        |row| {
            Ok(PipelineRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    );

    match result {
        Ok(row) => Ok(Some(row)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get project pipeline: {}", e)),
    }
}

/// Get all phases for a pipeline, ordered by position.
#[tauri::command]
pub fn get_pipeline_phases(
    state: State<'_, DbState>,
    pipeline_id: String,
) -> Result<Vec<PipelinePhaseRow>, String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, pipeline_id, position, label, phase_type, backend, framework, model, custom_prompt, gate_after
             FROM pipeline_phase WHERE pipeline_id = ?1 ORDER BY position ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![pipeline_id], |row| {
            Ok(PipelinePhaseRow {
                id: row.get(0)?,
                pipeline_id: row.get(1)?,
                position: row.get(2)?,
                label: row.get(3)?,
                phase_type: row.get(4)?,
                backend: row.get(5)?,
                framework: row.get(6)?,
                model: row.get(7)?,
                custom_prompt: row.get(8)?,
                gate_after: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to query pipeline phases: {}", e))?;

    let mut phases = Vec::new();
    for row in rows {
        phases.push(row.map_err(|e| format!("Row error: {}", e))?);
    }

    Ok(phases)
}

/// Replace all phases for a pipeline by deleting existing ones and re-inserting.
#[tauri::command]
pub fn update_pipeline_phases(
    state: State<'_, DbState>,
    pipeline_id: String,
    phases: Vec<CreatePhaseArgs>,
) -> Result<Vec<PipelinePhaseRow>, String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    // Delete all existing phases for this pipeline
    conn.execute(
        "DELETE FROM pipeline_phase WHERE pipeline_id = ?1",
        rusqlite::params![pipeline_id],
    )
    .map_err(|e| format!("Failed to delete existing phases: {}", e))?;

    // Update the pipeline's updated_at timestamp
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        "UPDATE pipeline SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, pipeline_id],
    )
    .map_err(|e| format!("Failed to update pipeline timestamp: {}", e))?;

    // Insert new phases in order
    let mut inserted = Vec::new();
    for (position, phase) in phases.iter().enumerate() {
        let phase_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO pipeline_phase
                 (id, pipeline_id, position, label, phase_type, backend, framework, model, custom_prompt, gate_after)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                phase_id,
                pipeline_id,
                position as i64,
                phase.label,
                phase.phase_type,
                phase.backend,
                phase.framework,
                phase.model,
                phase.custom_prompt,
                phase.gate_after,
            ],
        )
        .map_err(|e| format!("Failed to insert phase at position {}: {}", position, e))?;

        inserted.push(PipelinePhaseRow {
            id: phase_id,
            pipeline_id: pipeline_id.clone(),
            position: position as i64,
            label: phase.label.clone(),
            phase_type: phase.phase_type.clone(),
            backend: phase.backend.clone(),
            framework: phase.framework.clone(),
            model: phase.model.clone(),
            custom_prompt: phase.custom_prompt.clone(),
            gate_after: phase.gate_after.clone(),
        });
    }

    Ok(inserted)
}

/// Delete a pipeline and all its phases and runs.
/// Deletion order: phase_runs → pipeline_runs → pipeline_phases → pipeline.
#[tauri::command]
pub fn delete_pipeline(state: State<'_, DbState>, pipeline_id: String) -> Result<(), String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    // Delete phase_runs for all runs of this pipeline
    conn.execute(
        "DELETE FROM phase_run WHERE pipeline_run_id IN (
             SELECT id FROM pipeline_run WHERE pipeline_id = ?1
         )",
        rusqlite::params![pipeline_id],
    )
    .map_err(|e| format!("Failed to delete phase_runs: {}", e))?;

    // Delete pipeline_runs
    conn.execute(
        "DELETE FROM pipeline_run WHERE pipeline_id = ?1",
        rusqlite::params![pipeline_id],
    )
    .map_err(|e| format!("Failed to delete pipeline_runs: {}", e))?;

    // Delete pipeline_phases
    conn.execute(
        "DELETE FROM pipeline_phase WHERE pipeline_id = ?1",
        rusqlite::params![pipeline_id],
    )
    .map_err(|e| format!("Failed to delete pipeline_phases: {}", e))?;

    // Delete the pipeline itself
    let rows_affected = conn
        .execute(
            "DELETE FROM pipeline WHERE id = ?1",
            rusqlite::params![pipeline_id],
        )
        .map_err(|e| format!("Failed to delete pipeline: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Pipeline '{}' not found", pipeline_id));
    }

    Ok(())
}
