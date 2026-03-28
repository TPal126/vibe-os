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
