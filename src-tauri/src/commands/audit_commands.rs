use serde::Serialize;
use tauri::State;

use super::db_commands::DbState;

/// A single audit log entry returned to the frontend.
#[derive(Serialize)]
pub struct AuditEntry {
    pub id: String,
    pub session_id: String,
    pub timestamp: String,
    pub action_type: String,
    pub detail: String,
    pub actor: String,
    pub metadata: Option<String>,
}

/// Log a custom action to the audit trail.
/// Requires an active session -- returns error if none found.
#[tauri::command]
pub fn log_action(
    state: State<'_, DbState>,
    action_type: String,
    detail: String,
    actor: String,
    metadata: Option<String>,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {}", e))?;

    let session_id: String = conn
        .query_row(
            "SELECT id FROM sessions WHERE active = 1 LIMIT 1",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "No active session found -- cannot log action".to_string())?;

    let id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO audit_log (id, session_id, timestamp, action_type, detail, actor, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, session_id, timestamp, action_type, detail, actor, metadata],
    )
    .map_err(|e| format!("Failed to insert audit log: {}", e))?;

    Ok(())
}

/// Retrieve recent audit log entries, ordered newest first.
/// Defaults to 100 entries if no limit is specified.
#[tauri::command]
pub fn get_audit_log(
    state: State<'_, DbState>,
    limit: Option<i64>,
) -> Result<Vec<AuditEntry>, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {}", e))?;

    let max = limit.unwrap_or(100);

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, timestamp, action_type, detail, actor, metadata
             FROM audit_log
             ORDER BY timestamp DESC
             LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare audit query: {}", e))?;

    let entries = stmt
        .query_map(rusqlite::params![max], |row| {
            Ok(AuditEntry {
                id: row.get(0)?,
                session_id: row.get(1)?,
                timestamp: row.get(2)?,
                action_type: row.get(3)?,
                detail: row.get(4)?,
                actor: row.get(5)?,
                metadata: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to query audit log: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read audit rows: {}", e))?;

    Ok(entries)
}
