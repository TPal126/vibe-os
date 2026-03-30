use serde::{Deserialize, Serialize};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// ── Edge data structs ──

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct EdgeData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub import_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub call_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relevance: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub change_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diff_stats: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relationship: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completion: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dependency_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field_changed: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_contribution: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sequence_num: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gap_ms: Option<i64>,
}

// ── RELATE operations ──

/// Create a directed edge between two records.
/// `from` and `to` are full record IDs like "repo:trv_superpowers"
pub async fn relate(
    db: &Surreal<Db>,
    from: &str,
    edge_table: &str,
    to: &str,
    data: Option<&EdgeData>,
) -> Result<(), String> {
    let query = if data.is_some() {
        format!("RELATE {from}->{edge_table}->{to} SET created_at = time::now(), {}",
            build_set_clause(data.unwrap()))
    } else {
        format!("RELATE {from}->{edge_table}->{to} SET created_at = time::now()")
    };

    db.query(&query)
        .await
        .map_err(|e| format!("Failed to relate {from}->{edge_table}->{to}: {e}"))?
        .check()
        .map_err(|e| format!("Failed to relate {from}->{edge_table}->{to}: {e}"))?;
    Ok(())
}

/// Get all outgoing edges of a given type from a node
pub async fn outgoing_edges(
    db: &Surreal<Db>,
    from: &str,
    edge_table: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let query = format!("SELECT * FROM {from}->{edge_table}");
    let mut result = db
        .query(&query)
        .await
        .map_err(|e| format!("Failed to query edges from {from}: {e}"))?;
    let rows: Vec<serde_json::Value> = result.take(0).map_err(|e| e.to_string())?;
    Ok(rows)
}

/// Get all incoming edges of a given type to a node
pub async fn incoming_edges(
    db: &Surreal<Db>,
    to: &str,
    edge_table: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let query = format!("SELECT * FROM {to}<-{edge_table}");
    let mut result = db
        .query(&query)
        .await
        .map_err(|e| format!("Failed to query edges to {to}: {e}"))?;
    let rows: Vec<serde_json::Value> = result.take(0).map_err(|e| e.to_string())?;
    Ok(rows)
}

/// Traverse: follow edges and return connected node data
pub async fn traverse(
    db: &Surreal<Db>,
    from: &str,
    edge_table: &str,
    target_fields: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let query = format!("SELECT ->{edge_table}->{target_fields} FROM {from}");
    let mut result = db
        .query(&query)
        .await
        .map_err(|e| format!("Failed to traverse from {from}: {e}"))?;
    let rows: Vec<serde_json::Value> = result.take(0).map_err(|e| e.to_string())?;
    Ok(rows)
}

/// Delete all edges of a given type from a specific source node
pub async fn delete_edges_from(
    db: &Surreal<Db>,
    from: &str,
    edge_table: &str,
) -> Result<(), String> {
    let query = format!("DELETE {from}->{edge_table}");
    db.query(&query)
        .await
        .map_err(|e| format!("Failed to delete edges: {e}"))?;
    Ok(())
}

// ── Helpers ──

fn build_set_clause(data: &EdgeData) -> String {
    let mut parts = Vec::new();
    if let Some(v) = &data.import_type { parts.push(format!("import_type = '{v}'")); }
    if let Some(v) = data.call_count { parts.push(format!("call_count = {v}")); }
    if let Some(v) = data.relevance { parts.push(format!("relevance = {v}")); }
    if let Some(v) = &data.change_type { parts.push(format!("change_type = '{v}'")); }
    if let Some(v) = &data.relationship { parts.push(format!("relationship = '{v}'")); }
    if let Some(v) = &data.result { parts.push(format!("result = '{v}'")); }
    if let Some(v) = data.completion { parts.push(format!("completion = {v}")); }
    if let Some(v) = &data.dependency_type { parts.push(format!("dependency_type = '{v}'")); }
    if let Some(v) = &data.field_changed { parts.push(format!("field_changed = '{v}'")); }
    if let Some(v) = &data.old_value { parts.push(format!("old_value = '{v}'")); }
    if let Some(v) = &data.new_value { parts.push(format!("new_value = '{v}'")); }
    if let Some(v) = data.token_contribution { parts.push(format!("token_contribution = {v}")); }
    if let Some(v) = &data.index_summary { parts.push(format!("index_summary = '{v}'")); }
    if let Some(v) = data.sequence_num { parts.push(format!("sequence_num = {v}")); }
    if let Some(v) = data.gap_ms { parts.push(format!("gap_ms = {v}")); }
    if parts.is_empty() {
        String::new()
    } else {
        parts.join(", ")
    }
}
