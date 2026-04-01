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

/// Retrieve audit log entries for a specific session, ordered newest first.
/// Defaults to 500 entries if no limit is specified.
#[tauri::command]
pub fn get_session_audit(
    state: State<'_, DbState>,
    session_id: String,
    limit: Option<i64>,
) -> Result<Vec<AuditEntry>, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    let lim = limit.unwrap_or(500);
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, timestamp, action_type, detail, actor, metadata
             FROM audit_log WHERE session_id = ?1 ORDER BY timestamp DESC LIMIT ?2",
        )
        .map_err(|e| format!("Query failed: {}", e))?;

    let entries = stmt
        .query_map(rusqlite::params![session_id, lim], |row| {
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
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entries)
}

/// Export audit log entries for a session to a file (JSON or CSV).
#[tauri::command]
pub fn export_audit_log(
    state: State<'_, DbState>,
    session_id: String,
    format: String,
    output_path: String,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, timestamp, action_type, detail, actor, metadata
             FROM audit_log WHERE session_id = ?1 ORDER BY timestamp ASC",
        )
        .map_err(|e| format!("Query failed: {}", e))?;

    let entries: Vec<AuditEntry> = stmt
        .query_map([&session_id], |row| {
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
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let content = match format.as_str() {
        "csv" => {
            let mut csv =
                String::from("id,timestamp,action_type,detail,actor,metadata\n");
            for e in &entries {
                csv.push_str(&format!(
                    "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
                    e.id,
                    e.timestamp,
                    e.action_type,
                    e.detail.replace('"', "\"\""),
                    e.actor,
                    e.metadata
                        .as_deref()
                        .unwrap_or("")
                        .replace('"', "\"\""),
                ));
            }
            csv
        }
        _ => serde_json::to_string_pretty(&entries)
            .map_err(|e| format!("JSON serialization failed: {}", e))?,
    };

    std::fs::write(&output_path, content)
        .map_err(|e| format!("Failed to write export file: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::initialize_db;

    fn test_db() -> rusqlite::Connection {
        let dir = std::env::temp_dir().join(format!("vibe_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        initialize_db(&dir.join("test.db")).unwrap()
    }

    #[test]
    fn test_log_and_retrieve_audit() {
        let conn = test_db();
        let session_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO sessions (id, started_at, active) VALUES (?1, datetime('now'), 1)",
            rusqlite::params![session_id],
        ).unwrap();

        for i in 0..2 {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO audit_log (id, session_id, timestamp, action_type, detail, actor) VALUES (?1, ?2, datetime('now'), ?3, ?4, ?5)",
                rusqlite::params![id, session_id, "FILE_CREATE", format!("Created file {}", i), "agent"],
            ).unwrap();
        }

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM audit_log WHERE session_id = ?1", [&session_id], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_audit_limit() {
        let conn = test_db();
        let session_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO sessions (id, started_at, active) VALUES (?1, datetime('now'), 1)",
            rusqlite::params![session_id],
        ).unwrap();

        for i in 0..10 {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO audit_log (id, session_id, timestamp, action_type, detail, actor) VALUES (?1, ?2, datetime('now'), ?3, ?4, ?5)",
                rusqlite::params![id, session_id, "TEST_RUN", format!("Test {}", i), "agent"],
            ).unwrap();
        }

        let mut stmt = conn.prepare("SELECT id FROM audit_log WHERE session_id = ?1 ORDER BY timestamp DESC LIMIT 5").unwrap();
        let rows: Vec<String> = stmt.query_map([&session_id], |row| row.get(0)).unwrap().filter_map(|r| r.ok()).collect();
        assert_eq!(rows.len(), 5);
    }

    #[test]
    fn test_export_audit_csv_format() {
        let conn = test_db();
        let session_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO sessions (id, started_at, active) VALUES (?1, datetime('now'), 1)",
            rusqlite::params![session_id],
        ).unwrap();

        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO audit_log (id, session_id, timestamp, action_type, detail, actor) VALUES (?1, ?2, '2026-03-30T00:00:00Z', 'FILE_CREATE', 'Created main.rs', 'agent')",
            rusqlite::params![id, session_id],
        ).unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, session_id, timestamp, action_type, detail, actor, metadata FROM audit_log WHERE session_id = ?1"
        ).unwrap();
        let entries: Vec<super::AuditEntry> = stmt
            .query_map([&session_id], |row| {
                Ok(super::AuditEntry {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    timestamp: row.get(2)?,
                    action_type: row.get(3)?,
                    detail: row.get(4)?,
                    actor: row.get(5)?,
                    metadata: row.get(6)?,
                })
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        let mut csv = String::from("id,timestamp,action_type,detail,actor,metadata\n");
        for e in &entries {
            csv.push_str(&format!("\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
                e.id, e.timestamp, e.action_type, e.detail, e.actor, e.metadata.as_deref().unwrap_or("")));
        }
        assert!(csv.contains("FILE_CREATE"));
        assert!(csv.contains("Created main.rs"));
    }
}
