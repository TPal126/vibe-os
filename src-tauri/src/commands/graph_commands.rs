use surrealdb::engine::local::Db;
use surrealdb::Surreal;

use crate::graph::queries;
use crate::graph::nodes;
use crate::graph::edges;
use crate::graph::indexer;

// ── Graph query commands ──

#[tauri::command]
pub async fn graph_get_full(
    db: tauri::State<'_, Surreal<Db>>,
    session_id: Option<String>,
) -> Result<queries::GraphData, String> {
    queries::get_full_graph(&db, session_id.as_deref()).await
}

#[tauri::command]
pub async fn graph_get_provenance(
    db: tauri::State<'_, Surreal<Db>>,
    function_id: String,
) -> Result<queries::ProvenanceTrace, String> {
    queries::get_provenance(&db, &function_id).await
}

#[tauri::command]
pub async fn graph_get_impact(
    db: tauri::State<'_, Surreal<Db>>,
    function_id: String,
) -> Result<queries::ImpactRadius, String> {
    queries::get_impact(&db, &function_id).await
}

#[tauri::command]
pub async fn graph_get_session_report(
    db: tauri::State<'_, Surreal<Db>>,
    session_id: String,
) -> Result<queries::SessionReport, String> {
    queries::get_session_report(&db, &session_id).await
}

#[tauri::command]
pub async fn graph_get_skill_effectiveness(
    db: tauri::State<'_, Surreal<Db>>,
) -> Result<Vec<queries::SkillStats>, String> {
    queries::get_skill_effectiveness(&db).await
}

#[tauri::command]
pub async fn graph_search(
    db: tauri::State<'_, Surreal<Db>>,
    query: String,
    node_types: Vec<String>,
) -> Result<Vec<queries::GraphNode>, String> {
    let type_filter = if node_types.is_empty() {
        String::new()
    } else {
        let types: Vec<String> = node_types.iter().map(|t| format!("'{t}'")).collect();
        format!("AND node_type IN [{}]", types.join(", "))
    };

    // Escape single quotes in the search query for safe SQL interpolation
    let q = query.replace('\'', "''");

    let sql = format!(
        "SELECT id, 'repo' AS node_type, name AS label FROM repo WHERE name CONTAINS '{q}';
         SELECT id, 'module' AS node_type, name AS label FROM module WHERE name CONTAINS '{q}';
         SELECT id, 'function' AS node_type, name AS label FROM fn_def WHERE name CONTAINS '{q}';
         SELECT id, 'class' AS node_type, name AS label FROM class WHERE name CONTAINS '{q}';
         SELECT id, 'decision' AS node_type, summary AS label FROM decision WHERE summary CONTAINS '{q}';
         SELECT id, 'skill' AS node_type, name AS label FROM skill WHERE name CONTAINS '{q}';
         SELECT id, 'ticket' AS node_type, key AS label FROM ticket WHERE key CONTAINS '{q}' OR title CONTAINS '{q}';"
    );

    let mut result = db
        .query(&sql)
        .await
        .map_err(|e| e.to_string())?;

    let mut nodes: Vec<queries::GraphNode> = Vec::new();
    for i in 0..7 {
        let batch: Vec<serde_json::Value> = result.take(i).unwrap_or_default();
        for val in batch {
            if let (Some(id), Some(node_type), Some(label)) = (
                val.get("id").and_then(|v| v.as_str()),
                val.get("node_type").and_then(|v| v.as_str()),
                val.get("label").and_then(|v| v.as_str()),
            ) {
                nodes.push(queries::GraphNode {
                    id: id.to_string(),
                    node_type: node_type.to_string(),
                    label: label.to_string(),
                    data: val.clone(),
                });
            }
        }
    }

    Ok(nodes)
}

// ── Node CRUD commands ──

#[tauri::command]
pub async fn graph_create_node(
    db: tauri::State<'_, Surreal<Db>>,
    table: String,
    id: Option<String>,
    data: serde_json::Value,
) -> Result<String, String> {
    if let Some(id) = id {
        nodes::create_node(&db, &table, &id, &data).await?;
        Ok(format!("{table}:{id}"))
    } else {
        nodes::create_node_auto(&db, &table, &data).await
    }
}

#[tauri::command]
pub async fn graph_upsert_node(
    db: tauri::State<'_, Surreal<Db>>,
    table: String,
    id: String,
    data: serde_json::Value,
) -> Result<(), String> {
    nodes::upsert_node(&db, &table, &id, &data).await
}

#[tauri::command]
pub async fn graph_get_node(
    db: tauri::State<'_, Surreal<Db>>,
    table: String,
    id: String,
) -> Result<Option<serde_json::Value>, String> {
    nodes::get_node(&db, &table, &id).await
}

#[tauri::command]
pub async fn graph_list_nodes(
    db: tauri::State<'_, Surreal<Db>>,
    table: String,
) -> Result<Vec<serde_json::Value>, String> {
    nodes::list_nodes(&db, &table).await
}

#[tauri::command]
pub async fn graph_delete_node(
    db: tauri::State<'_, Surreal<Db>>,
    table: String,
    id: String,
) -> Result<(), String> {
    nodes::delete_node(&db, &table, &id).await
}

// ── Edge commands ──

#[tauri::command]
pub async fn graph_relate(
    db: tauri::State<'_, Surreal<Db>>,
    from: String,
    edge_table: String,
    to: String,
    data: Option<edges::EdgeData>,
) -> Result<(), String> {
    edges::relate(&db, &from, &edge_table, &to, data.as_ref()).await
}

#[tauri::command]
pub async fn graph_index_repo(
    db: tauri::State<'_, Surreal<Db>>,
    repo_path: String,
    session_id: String,
) -> Result<indexer::IndexResult, String> {
    indexer::index_repo(&db, &repo_path, &session_id).await
}

#[tauri::command]
pub async fn graph_get_edges(
    db: tauri::State<'_, Surreal<Db>>,
    from: String,
    edge_table: String,
) -> Result<Vec<serde_json::Value>, String> {
    edges::outgoing_edges(&db, &from, &edge_table).await
}
