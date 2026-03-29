use chrono::Utc;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

/// Type alias for the managed database state.
/// Uses std::sync::Mutex (not tokio) because rusqlite::Connection is !Send.
pub type DbState = Mutex<Connection>;

/// Write a test row to the settings table.
/// Uses INSERT OR REPLACE to be idempotent.
#[tauri::command]
pub fn test_db_write(state: State<'_, DbState>) -> Result<String, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params!["test_key", "test_value"],
    )
    .map_err(|e| format!("Failed to write test row: {}", e))?;

    Ok("Write successful".to_string())
}

/// Read the test row back from the settings table.
#[tauri::command]
pub fn test_db_read(state: State<'_, DbState>) -> Result<String, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {}", e))?;

    let value: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            rusqlite::params!["test_key"],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to read test row: {}", e))?;

    Ok(value)
}

// ── Session Management ──

/// Create a new session and deactivate any existing active session.
#[tauri::command]
pub fn create_session(state: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;

    // Deactivate any currently active session
    conn.execute(
        "UPDATE sessions SET active = 0, ended_at = ?1 WHERE active = 1",
        rusqlite::params![Utc::now().to_rfc3339()],
    )
    .map_err(|e| format!("Failed to deactivate old session: {}", e))?;

    // Create new session
    let id = uuid::Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO sessions (id, started_at, active, system_prompt, active_repos, active_skills) VALUES (?1, ?2, 1, '', '[]', '[]')",
        rusqlite::params![id, started_at],
    )
    .map_err(|e| format!("Failed to create session: {}", e))?;

    Ok(serde_json::json!({ "id": id, "startedAt": started_at }))
}

/// End the active session.
#[tauri::command]
pub fn end_session(state: State<'_, DbState>) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    conn.execute(
        "UPDATE sessions SET active = 0, ended_at = ?1 WHERE active = 1",
        rusqlite::params![Utc::now().to_rfc3339()],
    )
    .map_err(|e| format!("Failed to end session: {}", e))?;
    Ok(())
}

/// Get the currently active session, or null if none.
#[tauri::command]
pub fn get_active_session(state: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    let result = conn.query_row(
        "SELECT id, started_at, system_prompt, active_repos, active_skills FROM sessions WHERE active = 1 LIMIT 1",
        [],
        |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "startedAt": row.get::<_, String>(1)?,
                "systemPrompt": row.get::<_, String>(2).unwrap_or_default(),
                "activeRepos": row.get::<_, String>(3).unwrap_or_else(|_| "[]".to_string()),
                "activeSkills": row.get::<_, String>(4).unwrap_or_else(|_| "[]".to_string()),
            }))
        },
    );
    match result {
        Ok(session) => Ok(session),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(serde_json::json!(null)),
        Err(e) => Err(format!("Failed to get active session: {}", e)),
    }
}

/// Update the active session's linked repos (JSON array of repo IDs).
#[tauri::command]
pub fn update_session_repos(
    state: State<'_, DbState>,
    repo_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    let json = serde_json::to_string(&repo_ids).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE sessions SET active_repos = ?1 WHERE active = 1",
        rusqlite::params![json],
    )
    .map_err(|e| format!("Failed to update session repos: {}", e))?;
    Ok(())
}

/// Update the active session's linked skills (JSON array of skill IDs).
#[tauri::command]
pub fn update_session_skills(
    state: State<'_, DbState>,
    skill_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    let json = serde_json::to_string(&skill_ids).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE sessions SET active_skills = ?1 WHERE active = 1",
        rusqlite::params![json],
    )
    .map_err(|e| format!("Failed to update session skills: {}", e))?;
    Ok(())
}

/// Update the active session's system prompt.
#[tauri::command]
pub fn update_session_prompt(
    state: State<'_, DbState>,
    system_prompt: String,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    conn.execute(
        "UPDATE sessions SET system_prompt = ?1 WHERE active = 1",
        rusqlite::params![system_prompt],
    )
    .map_err(|e| format!("Failed to update system prompt: {}", e))?;
    Ok(())
}

// ── Settings CRUD ──

/// Get a setting value by key. Returns null if not found.
#[tauri::command]
pub fn get_setting(state: State<'_, DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get(0),
    );
    match result {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get setting: {}", e)),
    }
}

/// Save a setting value by key. Uses INSERT OR REPLACE for upsert.
#[tauri::command]
pub fn save_setting(
    state: State<'_, DbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    )
    .map_err(|e| format!("Failed to save setting: {}", e))?;
    Ok(())
}

/// Delete a setting by key.
#[tauri::command]
pub fn delete_setting(state: State<'_, DbState>, key: String) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    conn.execute(
        "DELETE FROM settings WHERE key = ?1",
        rusqlite::params![key],
    )
    .map_err(|e| format!("Failed to delete setting: {}", e))?;
    Ok(())
}

// ── Claude Session Management ──

/// Create a new Claude session record. Does NOT deactivate other sessions
/// (multiple Claude sessions can be active simultaneously).
#[tauri::command]
pub fn create_claude_session(
    state: State<'_, DbState>,
    session_id: String,
    name: String,
) -> Result<serde_json::Value, String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    let id = uuid::Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO claude_sessions (id, session_id, name, status, created_at) VALUES (?1, ?2, ?3, 'idle', ?4)",
        rusqlite::params![id, session_id, name, created_at],
    )
    .map_err(|e| format!("Failed to create claude session: {}", e))?;

    Ok(serde_json::json!({
        "id": id,
        "sessionId": session_id,
        "name": name,
        "status": "idle",
        "conversationId": null,
        "createdAt": created_at,
        "endedAt": null,
    }))
}

/// List all Claude sessions for a given app session, ordered by created_at desc.
#[tauri::command]
pub fn list_claude_sessions(
    state: State<'_, DbState>,
    session_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, name, status, conversation_id, created_at, ended_at
             FROM claude_sessions WHERE session_id = ?1 ORDER BY created_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![session_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "sessionId": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "status": row.get::<_, String>(3)?,
                "conversationId": row.get::<_, Option<String>>(4)?,
                "createdAt": row.get::<_, String>(5)?,
                "endedAt": row.get::<_, Option<String>>(6)?,
            }))
        })
        .map_err(|e| format!("Failed to query claude sessions: {}", e))?;

    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row.map_err(|e| format!("Row error: {}", e))?);
    }

    Ok(sessions)
}

/// Get a single Claude session by its ID.
#[tauri::command]
pub fn get_claude_session(
    state: State<'_, DbState>,
    claude_session_id: String,
) -> Result<serde_json::Value, String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    conn.query_row(
        "SELECT id, session_id, name, status, conversation_id, created_at, ended_at
         FROM claude_sessions WHERE id = ?1",
        rusqlite::params![claude_session_id],
        |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "sessionId": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "status": row.get::<_, String>(3)?,
                "conversationId": row.get::<_, Option<String>>(4)?,
                "createdAt": row.get::<_, String>(5)?,
                "endedAt": row.get::<_, Option<String>>(6)?,
            }))
        },
    )
    .map_err(|e| format!("Failed to get claude session: {}", e))
}

/// Mark a Claude session as closed and set ended_at timestamp.
/// Does NOT kill the process -- the frontend should call cancel_claude first
/// if the session is active.
#[tauri::command]
pub fn close_claude_session(
    state: State<'_, DbState>,
    claude_session_id: String,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    conn.execute(
        "UPDATE claude_sessions SET status = 'closed', ended_at = ?1 WHERE id = ?2",
        rusqlite::params![Utc::now().to_rfc3339(), claude_session_id],
    )
    .map_err(|e| format!("Failed to close claude session: {}", e))?;

    Ok(())
}

/// Update the status of a Claude session. Validates against allowed status values.
#[tauri::command]
pub fn update_claude_session_status(
    state: State<'_, DbState>,
    claude_session_id: String,
    status: String,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    // Validate status
    let valid_statuses = ["idle", "active", "input_needed", "closed"];
    if !valid_statuses.contains(&status.as_str()) {
        return Err(format!(
            "Invalid status '{}'. Must be one of: {:?}",
            status, valid_statuses
        ));
    }

    conn.execute(
        "UPDATE claude_sessions SET status = ?1 WHERE id = ?2",
        rusqlite::params![status, claude_session_id],
    )
    .map_err(|e| format!("Failed to update claude session status: {}", e))?;

    Ok(())
}
