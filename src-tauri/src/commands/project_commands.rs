use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

pub type DbState = Mutex<Connection>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub workspace_path: String,
    pub summary: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Create a new project record.
#[tauri::command]
pub fn create_project(
    state: State<'_, DbState>,
    name: String,
    workspace_path: String,
    summary: Option<String>,
) -> Result<ProjectRow, String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let summary_val = summary.unwrap_or_default();

    conn.execute(
        "INSERT INTO projects (id, name, workspace_path, summary, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        rusqlite::params![id, name, workspace_path, summary_val, now],
    )
    .map_err(|e| format!("Failed to create project: {}", e))?;

    Ok(ProjectRow {
        id,
        name,
        workspace_path,
        summary: summary_val,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// List all projects ordered by name.
#[tauri::command]
pub fn list_projects(state: State<'_, DbState>) -> Result<Vec<ProjectRow>, String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, workspace_path, summary, created_at, updated_at
             FROM projects ORDER BY name ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                workspace_path: row.get(2)?,
                summary: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query projects: {}", e))?;

    let mut projects = Vec::new();
    for row in rows {
        projects.push(row.map_err(|e| format!("Row error: {}", e))?);
    }

    Ok(projects)
}

/// Update a project's name and/or summary.
#[tauri::command]
pub fn update_project(
    state: State<'_, DbState>,
    id: String,
    name: Option<String>,
    summary: Option<String>,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    if let Some(name) = name {
        conn.execute(
            "UPDATE projects SET name = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![name, now, id],
        )
        .map_err(|e| format!("Update name failed: {}", e))?;
    }
    if let Some(summary) = summary {
        conn.execute(
            "UPDATE projects SET summary = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![summary, now, id],
        )
        .map_err(|e| format!("Update summary failed: {}", e))?;
    }

    Ok(())
}

/// Delete a project and cascade-delete all related pipeline data.
/// Deletion order: phase_runs → pipeline_runs → pipeline_phases → pipelines → project.
#[tauri::command]
pub fn delete_project(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    // Delete phase_runs for all pipeline_runs belonging to this project's pipelines
    conn.execute(
        "DELETE FROM phase_run WHERE pipeline_run_id IN (
             SELECT pr.id FROM pipeline_run pr
             JOIN pipeline p ON p.id = pr.pipeline_id
             WHERE p.project_id = ?1
         )",
        rusqlite::params![id],
    )
    .map_err(|e| format!("Failed to delete phase_runs: {}", e))?;

    // Delete pipeline_runs for this project's pipelines
    conn.execute(
        "DELETE FROM pipeline_run WHERE pipeline_id IN (
             SELECT id FROM pipeline WHERE project_id = ?1
         )",
        rusqlite::params![id],
    )
    .map_err(|e| format!("Failed to delete pipeline_runs: {}", e))?;

    // Delete pipeline_phases for this project's pipelines
    conn.execute(
        "DELETE FROM pipeline_phase WHERE pipeline_id IN (
             SELECT id FROM pipeline WHERE project_id = ?1
         )",
        rusqlite::params![id],
    )
    .map_err(|e| format!("Failed to delete pipeline_phases: {}", e))?;

    // Delete pipelines for this project
    conn.execute(
        "DELETE FROM pipeline WHERE project_id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| format!("Failed to delete pipelines: {}", e))?;

    // Delete the project itself
    let rows_affected = conn
        .execute("DELETE FROM projects WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| format!("Failed to delete project: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Project '{}' not found", id));
    }

    Ok(())
}
