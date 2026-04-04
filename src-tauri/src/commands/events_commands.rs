use serde::Serialize;
use tauri::State;

use super::db_commands::DbState;

/// A unified event entry that merges actions and decisions.
#[derive(Debug, Serialize, Clone)]
pub struct VibeEvent {
    pub id: String,
    pub session_id: String,
    pub timestamp: String,
    pub kind: String,
    pub action_type: Option<String>,
    pub detail: Option<String>,
    pub actor: Option<String>,
    pub metadata: Option<String>,
    pub rationale: Option<String>,
    pub confidence: Option<f64>,
    pub impact_category: Option<String>,
    pub reversible: Option<bool>,
    pub related_files: Option<String>,
    pub related_tickets: Option<String>,
}

/// Insert a unified event into the events table.
#[tauri::command]
pub fn log_event(
    state: State<'_, DbState>,
    session_id: String,
    kind: String,
    action_type: Option<String>,
    detail: Option<String>,
    actor: Option<String>,
    metadata: Option<String>,
    rationale: Option<String>,
    confidence: Option<f64>,
    impact_category: Option<String>,
    reversible: Option<bool>,
    related_files: Option<String>,
    related_tickets: Option<String>,
) -> Result<VibeEvent, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {}", e))?;

    let id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO events (id, session_id, timestamp, kind, action_type, detail, actor, metadata, rationale, confidence, impact_category, reversible, related_files, related_tickets)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        rusqlite::params![
            id,
            session_id,
            timestamp,
            kind,
            action_type,
            detail,
            actor,
            metadata,
            rationale,
            confidence,
            impact_category,
            reversible.map(|b| b as i32),
            related_files,
            related_tickets,
        ],
    )
    .map_err(|e| format!("Failed to insert event: {}", e))?;

    Ok(VibeEvent {
        id,
        session_id,
        timestamp,
        kind,
        action_type,
        detail,
        actor,
        metadata,
        rationale,
        confidence,
        impact_category,
        reversible,
        related_files,
        related_tickets,
    })
}

/// Query unified events with optional kind filter.
/// Defaults to 100 entries if no limit is specified.
#[tauri::command]
pub fn get_events(
    state: State<'_, DbState>,
    session_id: String,
    kind: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<VibeEvent>, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {}", e))?;

    let max = limit.unwrap_or(100);

    let (query, params): (&str, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(ref kind_filter) = kind {
        (
            "SELECT id, session_id, timestamp, kind, action_type, detail, actor, metadata, rationale, confidence, impact_category, reversible, related_files, related_tickets
             FROM events WHERE session_id = ?1 AND kind = ?2 ORDER BY timestamp DESC LIMIT ?3",
            vec![
                Box::new(session_id.clone()) as Box<dyn rusqlite::types::ToSql>,
                Box::new(kind_filter.clone()),
                Box::new(max),
            ],
        )
    } else {
        (
            "SELECT id, session_id, timestamp, kind, action_type, detail, actor, metadata, rationale, confidence, impact_category, reversible, related_files, related_tickets
             FROM events WHERE session_id = ?1 ORDER BY timestamp DESC LIMIT ?2",
            vec![
                Box::new(session_id.clone()) as Box<dyn rusqlite::types::ToSql>,
                Box::new(max),
            ],
        )
    };

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Query prepare failed: {}", e))?;

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let events = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(VibeEvent {
                id: row.get(0)?,
                session_id: row.get(1)?,
                timestamp: row.get(2)?,
                kind: row.get(3)?,
                action_type: row.get(4)?,
                detail: row.get(5)?,
                actor: row.get(6)?,
                metadata: row.get(7)?,
                rationale: row.get(8)?,
                confidence: row.get(9)?,
                impact_category: row.get(10)?,
                reversible: row.get::<_, Option<i32>>(11)?.map(|v| v != 0),
                related_files: row.get(12)?,
                related_tickets: row.get(13)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(events)
}

/// Export events for a session to a file (JSON or CSV).
#[tauri::command]
pub fn export_events(
    state: State<'_, DbState>,
    session_id: String,
    format: String,
    output_path: String,
) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, timestamp, kind, action_type, detail, actor, metadata, rationale, confidence, impact_category, reversible, related_files, related_tickets
             FROM events WHERE session_id = ?1 ORDER BY timestamp ASC",
        )
        .map_err(|e| format!("Query prepare failed: {}", e))?;

    let events: Vec<VibeEvent> = stmt
        .query_map([&session_id], |row| {
            Ok(VibeEvent {
                id: row.get(0)?,
                session_id: row.get(1)?,
                timestamp: row.get(2)?,
                kind: row.get(3)?,
                action_type: row.get(4)?,
                detail: row.get(5)?,
                actor: row.get(6)?,
                metadata: row.get(7)?,
                rationale: row.get(8)?,
                confidence: row.get(9)?,
                impact_category: row.get(10)?,
                reversible: row.get::<_, Option<i32>>(11)?.map(|v| v != 0),
                related_files: row.get(12)?,
                related_tickets: row.get(13)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let content = match format.as_str() {
        "csv" => {
            let mut csv = String::from(
                "id,timestamp,kind,action_type,detail,actor,metadata,rationale,confidence,impact_category,reversible,related_files,related_tickets\n",
            );
            for e in &events {
                csv.push_str(&format!(
                    "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",{},\"{}\",{},\"{}\",\"{}\"\n",
                    e.id,
                    e.timestamp,
                    e.kind,
                    e.action_type.as_deref().unwrap_or(""),
                    e.detail.as_deref().unwrap_or("").replace('"', "\"\""),
                    e.actor.as_deref().unwrap_or(""),
                    e.metadata.as_deref().unwrap_or("").replace('"', "\"\""),
                    e.rationale.as_deref().unwrap_or("").replace('"', "\"\""),
                    e.confidence.map(|c| c.to_string()).unwrap_or_default(),
                    e.impact_category.as_deref().unwrap_or(""),
                    e.reversible.map(|b| if b { "1" } else { "0" }.to_string()).unwrap_or_default(),
                    e.related_files.as_deref().unwrap_or(""),
                    e.related_tickets.as_deref().unwrap_or(""),
                ));
            }
            csv
        }
        _ => serde_json::to_string_pretty(&events)
            .map_err(|e| format!("JSON serialization failed: {}", e))?,
    };

    std::fs::write(&output_path, content)
        .map_err(|e| format!("Failed to write export file: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::initialize_db;
    use rusqlite::Connection;

    fn test_db() -> Connection {
        let dir = std::env::temp_dir().join(format!("vibe_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        initialize_db(&dir.join("test.db")).unwrap()
    }

    fn insert_test_event(conn: &Connection, session_id: &str, kind: &str) -> String {
        conn.execute(
            "INSERT OR IGNORE INTO sessions (id, started_at, active) VALUES (?1, datetime('now'), 1)",
            rusqlite::params![session_id],
        )
        .unwrap();

        let id = uuid::Uuid::new_v4().to_string();
        let timestamp = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO events (id, session_id, timestamp, kind, action_type, detail, actor)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![id, session_id, timestamp, kind, "FILE_CREATE", "Created main.rs", "agent"],
        )
        .unwrap();
        id
    }

    #[test]
    fn test_insert_and_query_event() {
        let conn = test_db();
        let id = insert_test_event(&conn, "sess-1", "action");

        let mut stmt = conn
            .prepare("SELECT id, kind, action_type, detail, actor FROM events WHERE session_id = ?1")
            .unwrap();
        let rows: Vec<(String, String, String, String, String)> = stmt
            .query_map(["sess-1"], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].0, id);
        assert_eq!(rows[0].1, "action");
        assert_eq!(rows[0].2, "FILE_CREATE");
        assert_eq!(rows[0].3, "Created main.rs");
        assert_eq!(rows[0].4, "agent");
    }

    #[test]
    fn test_events_kind_filter() {
        let conn = test_db();
        insert_test_event(&conn, "sess-1", "action");
        insert_test_event(&conn, "sess-1", "decision");
        insert_test_event(&conn, "sess-1", "action");

        let count_all: i64 = conn
            .query_row("SELECT COUNT(*) FROM events WHERE session_id = ?1", ["sess-1"], |row| row.get(0))
            .unwrap();
        assert_eq!(count_all, 3);

        let count_actions: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM events WHERE session_id = ?1 AND kind = ?2",
                rusqlite::params!["sess-1", "action"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_actions, 2);

        let count_decisions: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM events WHERE session_id = ?1 AND kind = ?2",
                rusqlite::params!["sess-1", "decision"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_decisions, 1);
    }

    #[test]
    fn test_events_scoped_to_session() {
        let conn = test_db();
        insert_test_event(&conn, "sess-1", "action");
        insert_test_event(&conn, "sess-2", "action");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM events WHERE session_id = ?1", ["sess-1"], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_insert_decision_event() {
        let conn = test_db();
        conn.execute(
            "INSERT INTO sessions (id, started_at, active) VALUES (?1, datetime('now'), 1)",
            rusqlite::params!["sess-1"],
        )
        .unwrap();

        let id = uuid::Uuid::new_v4().to_string();
        let timestamp = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO events (id, session_id, timestamp, kind, detail, actor, rationale, confidence, impact_category, reversible, related_files, related_tickets)
             VALUES (?1, ?2, ?3, 'decision', ?4, 'agent', ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                id, "sess-1", timestamp,
                "Use REST over GraphQL",
                "Simpler for CRUD",
                0.85,
                "architecture",
                1,
                r#"["src/routes.rs"]"#,
                r#"["VIBE-42"]"#,
            ],
        )
        .unwrap();

        let (kind, detail, rationale, confidence, reversible): (String, String, String, f64, i32) = conn
            .query_row(
                "SELECT kind, detail, rationale, confidence, reversible FROM events WHERE id = ?1",
                [&id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .unwrap();

        assert_eq!(kind, "decision");
        assert_eq!(detail, "Use REST over GraphQL");
        assert_eq!(rationale, "Simpler for CRUD");
        assert!((confidence - 0.85).abs() < 0.001);
        assert_eq!(reversible, 1);
    }
}
