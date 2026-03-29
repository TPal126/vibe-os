use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use super::db_commands::DbState;

#[derive(Debug, Serialize, Clone)]
pub struct Decision {
    pub id: String,
    pub session_id: String,
    pub timestamp: String,
    pub decision: String,
    pub rationale: String,
    pub confidence: f64,
    pub impact_category: String,
    pub reversible: bool,
    pub related_files: Vec<String>,
    pub related_tickets: Vec<String>,
}

pub fn insert_decision(conn: &Connection, decision: &Decision) -> Result<(), String> {
    conn.execute(
        "INSERT INTO decisions (id, session_id, timestamp, decision, rationale, confidence, impact_category, reversible, related_files, related_tickets)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            decision.id,
            decision.session_id,
            decision.timestamp,
            decision.decision,
            decision.rationale,
            decision.confidence,
            decision.impact_category,
            decision.reversible as i32,
            serde_json::to_string(&decision.related_files).unwrap_or_default(),
            serde_json::to_string(&decision.related_tickets).unwrap_or_default(),
        ],
    )
    .map_err(|e| format!("Failed to insert decision: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn record_decision(
    state: State<'_, DbState>,
    session_id: String,
    decision: String,
    rationale: String,
    confidence: f64,
    impact_category: String,
    reversible: bool,
    related_files: Vec<String>,
    related_tickets: Vec<String>,
) -> Result<Decision, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    let id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();

    let dec = Decision {
        id: id.clone(),
        session_id,
        timestamp,
        decision,
        rationale,
        confidence,
        impact_category,
        reversible,
        related_files,
        related_tickets,
    };

    insert_decision(&conn, &dec)?;
    Ok(dec)
}

#[tauri::command]
pub fn get_session_decisions(
    state: State<'_, DbState>,
    session_id: String,
) -> Result<Vec<Decision>, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, timestamp, decision, rationale, confidence, impact_category, reversible, related_files, related_tickets
             FROM decisions WHERE session_id = ?1 ORDER BY timestamp DESC",
        )
        .map_err(|e| format!("Query prepare failed: {}", e))?;

    let decisions = stmt
        .query_map([&session_id], |row| {
            Ok(Decision {
                id: row.get(0)?,
                session_id: row.get(1)?,
                timestamp: row.get(2)?,
                decision: row.get(3)?,
                rationale: row.get(4)?,
                confidence: row.get(5)?,
                impact_category: row.get(6)?,
                reversible: row.get::<_, i32>(7)? != 0,
                related_files: serde_json::from_str(
                    &row.get::<_, String>(8).unwrap_or_default(),
                )
                .unwrap_or_default(),
                related_tickets: serde_json::from_str(
                    &row.get::<_, String>(9).unwrap_or_default(),
                )
                .unwrap_or_default(),
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(decisions)
}

#[tauri::command]
pub fn export_decisions(
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
            "SELECT id, session_id, timestamp, decision, rationale, confidence, impact_category, reversible, related_files, related_tickets
             FROM decisions WHERE session_id = ?1 ORDER BY timestamp ASC",
        )
        .map_err(|e| format!("Query failed: {}", e))?;

    let decisions: Vec<Decision> = stmt
        .query_map([&session_id], |row| {
            Ok(Decision {
                id: row.get(0)?,
                session_id: row.get(1)?,
                timestamp: row.get(2)?,
                decision: row.get(3)?,
                rationale: row.get(4)?,
                confidence: row.get(5)?,
                impact_category: row.get(6)?,
                reversible: row.get::<_, i32>(7)? != 0,
                related_files: serde_json::from_str(
                    &row.get::<_, String>(8).unwrap_or_default(),
                )
                .unwrap_or_default(),
                related_tickets: serde_json::from_str(
                    &row.get::<_, String>(9).unwrap_or_default(),
                )
                .unwrap_or_default(),
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let content = match format.as_str() {
        "csv" => {
            let mut csv = String::from(
                "id,timestamp,decision,rationale,confidence,impact_category,reversible\n",
            );
            for d in &decisions {
                csv.push_str(&format!(
                    "\"{}\",\"{}\",\"{}\",\"{}\",{},{},{}\n",
                    d.id,
                    d.timestamp,
                    d.decision.replace('"', "\"\""),
                    d.rationale.replace('"', "\"\""),
                    d.confidence,
                    d.impact_category,
                    d.reversible
                ));
            }
            csv
        }
        _ => serde_json::to_string_pretty(&decisions)
            .map_err(|e| format!("JSON serialization failed: {}", e))?,
    };

    std::fs::write(&output_path, content)
        .map_err(|e| format!("Failed to write export file: {}", e))?;

    Ok(())
}
