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
