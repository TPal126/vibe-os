use surrealdb::engine::local::Db;
use surrealdb::Surreal;

/// Populate a decision node in the graph + edges to skills/tickets/files.
pub async fn populate_decision(
    db: &Surreal<Db>,
    id: &str,
    session_id: &str,
    summary: &str,
    rationale: &str,
    confidence: f64,
    impact: &str,
    reversible: bool,
    related_files: &[String],
    related_tickets: &[String],
    timestamp: &str,
) -> Result<(), String> {
    let safe_id = sanitize_id(id);

    let dec_json = serde_json::json!({
        "summary": summary,
        "rationale": rationale,
        "confidence": confidence,
        "impact": impact,
        "reversible": reversible,
        "alternatives": [],
        "chosen": summary,
        "agent_model": "claude",
        "created_at": timestamp,
        "updated_at": timestamp,
        "session_id": session_id,
    });

    db.query(&format!(
        "CREATE decision:{safe_id} CONTENT {}",
        serde_json::to_string(&dec_json).unwrap()
    ))
    .await
    .map_err(|e| format!("Failed to create decision node: {e}"))?;

    // Edge: decision -> session
    db.query(&format!(
        "RELATE decision:{safe_id}->occurred_in->session:{sid} SET created_at = time::now()",
        sid = sanitize_id(session_id)
    ))
    .await
    .ok();

    // Edges: decision -> modified -> fn_def/module (by matching file paths)
    for file in related_files {
        let mod_id = sanitize_id(&file.replace('\\', "/").replace('/', "_").replace('.', "_"));
        db.query(&format!(
            "RELATE decision:{safe_id}->modified->module:{mod_id} SET change_type = 'edit', created_at = time::now()"
        ))
        .await
        .ok();
    }

    // Edges: decision -> addresses -> ticket
    for ticket_key in related_tickets {
        let ticket_id = sanitize_id(ticket_key);
        db.query(&format!(
            "RELATE decision:{safe_id}->addresses->ticket:{ticket_id} SET created_at = time::now()"
        ))
        .await
        .ok();
    }

    // Edges: decision -> informed_by -> active skills
    let mut skill_result = db
        .query("SELECT id FROM skill WHERE active = true")
        .await
        .map_err(|e| e.to_string())?;
    let skills: Vec<serde_json::Value> = skill_result.take(0).unwrap_or_default();
    for skill in skills {
        if let Some(skill_id) = skill.get("id").and_then(|v| v.as_str()) {
            db.query(&format!(
                "RELATE decision:{safe_id}->informed_by->{skill_id} SET created_at = time::now()"
            ))
            .await
            .ok();
        }
    }

    Ok(())
}

/// Populate an action (audit entry) node in the graph.
pub async fn populate_action(
    db: &Surreal<Db>,
    id: &str,
    session_id: &str,
    action_type: &str,
    detail: &str,
    actor: &str,
    timestamp: &str,
    metadata: Option<&str>,
) -> Result<(), String> {
    let safe_id = sanitize_id(id);

    let action_json = serde_json::json!({
        "action_type": action_type,
        "detail": detail,
        "actor": actor,
        "success": true,
        "created_at": timestamp,
        "session_id": session_id,
        "metadata": metadata.and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok()),
    });

    db.query(&format!(
        "CREATE action:{safe_id} CONTENT {}",
        serde_json::to_string(&action_json).unwrap()
    ))
    .await
    .map_err(|e| format!("Failed to create action node: {e}"))?;

    // Edge: action -> session
    db.query(&format!(
        "RELATE action:{safe_id}->occurred_in->session:{sid} SET created_at = time::now()",
        sid = sanitize_id(session_id)
    ))
    .await
    .ok();

    Ok(())
}

/// Populate a skill node from skill data.
pub async fn populate_skill(
    db: &Surreal<Db>,
    name: &str,
    file_path: &str,
    category: &str,
    token_count: i64,
    active: bool,
    session_id: &str,
) -> Result<(), String> {
    let safe_id = sanitize_id(name);
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let skill_json = serde_json::json!({
        "name": name,
        "file_path": file_path,
        "category": category,
        "content_hash": "",
        "token_count": token_count,
        "active": active,
        "source": "user",
        "created_at": now,
        "updated_at": now,
        "session_id": session_id,
    });

    // Upsert via DELETE + CREATE (avoids conflict on re-toggle)
    db.query(&format!("DELETE skill:{safe_id}")).await.ok();
    db.query(&format!(
        "CREATE skill:{safe_id} CONTENT {}",
        serde_json::to_string(&skill_json).unwrap()
    ))
    .await
    .map_err(|e| format!("Failed to create skill node: {e}"))?;

    Ok(())
}

/// Populate a session node.
pub async fn populate_session(
    db: &Surreal<Db>,
    session_id: &str,
    system_prompt: &str,
) -> Result<(), String> {
    let safe_id = sanitize_id(session_id);
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let session_json = serde_json::json!({
        "started_at": now,
        "system_prompt": system_prompt,
        "total_tokens": 0,
        "total_decisions": 0,
        "total_actions": 0,
        "total_files_changed": 0,
    });

    db.query(&format!(
        "CREATE session:{safe_id} CONTENT {}",
        serde_json::to_string(&session_json).unwrap()
    ))
    .await
    .ok(); // ok to fail if already exists

    Ok(())
}

/// Bulk sync: pull all decisions from SQLite and mirror to graph.
pub async fn sync_decisions_from_sqlite(
    db: &Surreal<Db>,
    decisions: Vec<serde_json::Value>,
) -> Result<i64, String> {
    let mut count = 0i64;
    for dec in decisions {
        let id = dec.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
        let session_id = dec.get("session_id").and_then(|v| v.as_str()).unwrap_or("");
        let summary = dec.get("decision").and_then(|v| v.as_str()).unwrap_or("");
        let rationale = dec.get("rationale").and_then(|v| v.as_str()).unwrap_or("");
        let confidence = dec.get("confidence").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let impact = dec.get("impact_category").and_then(|v| v.as_str()).unwrap_or("unknown");
        let reversible = dec.get("reversible").and_then(|v| v.as_bool()).unwrap_or(true);
        let timestamp = dec.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");

        let files: Vec<String> = dec
            .get("related_files")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();
        let tickets: Vec<String> = dec
            .get("related_tickets")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        if populate_decision(
            db, id, session_id, summary, rationale, confidence,
            impact, reversible, &files, &tickets, timestamp,
        )
        .await
        .is_ok()
        {
            count += 1;
        }
    }
    Ok(count)
}

/// Bulk sync: pull all audit entries from SQLite and mirror to graph.
pub async fn sync_audit_from_sqlite(
    db: &Surreal<Db>,
    entries: Vec<serde_json::Value>,
) -> Result<i64, String> {
    let mut count = 0i64;
    for entry in entries {
        let id = entry.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
        let session_id = entry.get("session_id").and_then(|v| v.as_str()).unwrap_or("");
        let action_type = entry.get("action_type").and_then(|v| v.as_str()).unwrap_or("");
        let detail = entry.get("detail").and_then(|v| v.as_str()).unwrap_or("");
        let actor = entry.get("actor").and_then(|v| v.as_str()).unwrap_or("system");
        let timestamp = entry.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
        let metadata = entry.get("metadata").and_then(|v| v.as_str());

        if populate_action(db, id, session_id, action_type, detail, actor, timestamp, metadata)
            .await
            .is_ok()
        {
            count += 1;
        }
    }
    Ok(count)
}

fn sanitize_id(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '_' })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::connection::initialize_graph_db;
    use crate::graph::schema::define_schema;
    use crate::graph::nodes;

    async fn test_db() -> Surreal<Db> {
        let dir = std::env::temp_dir().join(format!("vibe_pop_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = initialize_graph_db(&dir).await.unwrap();
        define_schema(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn test_populate_decision() {
        let db = test_db().await;
        populate_session(&db, "sess-1", "test prompt").await.unwrap();
        populate_decision(
            &db, "dec_1", "sess-1", "Use REST", "Simpler", 0.85,
            "architecture", true, &["src/routes.rs".to_string()], &["VIBE-42".to_string()],
            "2026-03-30T00:00:00Z",
        ).await.unwrap();

        let node = nodes::get_node(&db, "decision", "dec_1").await.unwrap();
        assert!(node.is_some());
        assert_eq!(node.unwrap()["summary"], "Use REST");
    }

    #[tokio::test]
    async fn test_populate_action() {
        let db = test_db().await;
        populate_session(&db, "sess-1", "test prompt").await.unwrap();
        populate_action(
            &db, "act_1", "sess-1", "FILE_CREATE", "Created main.rs",
            "agent", "2026-03-30T00:00:00Z", None,
        ).await.unwrap();

        let node = nodes::get_node(&db, "action", "act_1").await.unwrap();
        assert!(node.is_some());
        assert_eq!(node.unwrap()["action_type"], "FILE_CREATE");
    }

    #[tokio::test]
    async fn test_populate_skill() {
        let db = test_db().await;
        populate_skill(&db, "test_skill", "/path/skill.md", "core", 500, true, "sess-1").await.unwrap();

        let node = nodes::get_node(&db, "skill", "test_skill").await.unwrap();
        assert!(node.is_some());
        assert_eq!(node.unwrap()["token_count"], 500);
    }

    #[tokio::test]
    async fn test_populate_session() {
        let db = test_db().await;
        populate_session(&db, "sess_1", "You are a helpful assistant").await.unwrap();

        let node = nodes::get_node(&db, "session", "sess_1").await.unwrap();
        assert!(node.is_some());
        assert_eq!(node.unwrap()["system_prompt"], "You are a helpful assistant");
    }

    #[tokio::test]
    async fn test_sync_decisions_from_sqlite() {
        let db = test_db().await;
        populate_session(&db, "sess-1", "").await.unwrap();

        let decisions = vec![serde_json::json!({
            "id": "d1",
            "session_id": "sess-1",
            "decision": "Use Zustand",
            "rationale": "Simple state management",
            "confidence": 0.9,
            "impact_category": "dx",
            "reversible": true,
            "timestamp": "2026-03-30T00:00:00Z",
            "related_files": [],
            "related_tickets": [],
        })];

        let count = sync_decisions_from_sqlite(&db, decisions).await.unwrap();
        assert_eq!(count, 1);
        let node = nodes::get_node(&db, "decision", "d1").await.unwrap();
        assert!(node.is_some());
    }
}
