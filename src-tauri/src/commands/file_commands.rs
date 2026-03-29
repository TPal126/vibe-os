use tauri::State;

use super::db_commands::DbState;

/// Read a file from disk and return its contents as a string.
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

/// Write content to a file on disk and log the action to audit_log
/// if there is an active session. Never fails the save due to missing session.
#[tauri::command]
pub fn write_file(state: State<'_, DbState>, path: String, content: String) -> Result<(), String> {
    // Write the file first -- this must succeed regardless of audit
    std::fs::write(&path, &content)
        .map_err(|e| format!("Failed to write file '{}': {}", path, e))?;

    // Attempt to insert an audit_log entry (best-effort, don't fail the save)
    let conn = state
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {}", e))?;

    let session_id: Option<String> = conn
        .query_row(
            "SELECT id FROM sessions WHERE active = 1 LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();

    if let Some(sid) = session_id {
        let id = uuid::Uuid::new_v4().to_string();
        let timestamp = chrono::Utc::now().to_rfc3339();
        let detail = format!("Saved file: {}", path);

        conn.execute(
            "INSERT INTO audit_log (id, session_id, timestamp, action_type, detail, actor, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![id, sid, timestamp, "FILE_SAVE", detail, "user", Option::<String>::None],
        )
        .map_err(|e| format!("Audit log insert failed: {}", e))?;
    }

    Ok(())
}
