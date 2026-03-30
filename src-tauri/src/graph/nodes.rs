use serde::Serialize;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// ── Generic CRUD via raw SurrealQL ──
// All operations use parameterized queries where possible,
// with owned String bindings for SurrealDB 3.x compatibility.

/// Create a node with a specific ID
pub async fn create_node<T: Serialize>(
    db: &Surreal<Db>,
    table: &str,
    id: &str,
    data: &T,
) -> Result<(), String> {
    let json = serde_json::to_string(data).map_err(|e| e.to_string())?;
    let query = format!("CREATE {table}:{id} CONTENT {json}");
    db.query(&query)
        .await
        .map_err(|e| format!("Failed to create {table}:{id}: {e}"))?
        .check()
        .map_err(|e| format!("Failed to create {table}:{id}: {e}"))?;
    Ok(())
}

/// Create a node with auto-generated ID, returns the ID string
pub async fn create_node_auto<T: Serialize>(
    db: &Surreal<Db>,
    table: &str,
    data: &T,
) -> Result<String, String> {
    let json = serde_json::to_string(data).map_err(|e| e.to_string())?;
    let query = format!("CREATE {table} CONTENT {json} RETURN id");
    let mut result = db
        .query(&query)
        .await
        .map_err(|e| format!("Failed to create {table}: {e}"))?;
    let rows: Vec<serde_json::Value> = result.take(0).map_err(|e| e.to_string())?;
    rows.first()
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("No record returned from CREATE {table}"))
}

/// Upsert a node (create or update)
pub async fn upsert_node<T: Serialize>(
    db: &Surreal<Db>,
    table: &str,
    id: &str,
    data: &T,
) -> Result<(), String> {
    let json = serde_json::to_string(data).map_err(|e| e.to_string())?;
    let query = format!("UPSERT {table}:{id} CONTENT {json}");
    db.query(&query)
        .await
        .map_err(|e| format!("Failed to upsert {table}:{id}: {e}"))?
        .check()
        .map_err(|e| format!("Failed to upsert {table}:{id}: {e}"))?;
    Ok(())
}

/// Get a node by ID, returning raw JSON
pub async fn get_node(
    db: &Surreal<Db>,
    table: &str,
    id: &str,
) -> Result<Option<serde_json::Value>, String> {
    let query = format!("SELECT * FROM {table}:{id}");
    let mut result = db
        .query(&query)
        .await
        .map_err(|e| format!("Failed to get {table}:{id}: {e}"))?;
    let rows: Vec<serde_json::Value> = result.take(0).map_err(|e| e.to_string())?;
    Ok(rows.into_iter().next())
}

/// Get all nodes from a table
pub async fn list_nodes(
    db: &Surreal<Db>,
    table: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let query = format!("SELECT * FROM {table}");
    let mut result = db
        .query(&query)
        .await
        .map_err(|e| format!("Failed to list {table}: {e}"))?;
    let rows: Vec<serde_json::Value> = result.take(0).map_err(|e| e.to_string())?;
    Ok(rows)
}

/// Delete a node by ID
pub async fn delete_node(
    db: &Surreal<Db>,
    table: &str,
    id: &str,
) -> Result<(), String> {
    let query = format!("DELETE {table}:{id}");
    db.query(&query)
        .await
        .map_err(|e| format!("Failed to delete {table}:{id}: {e}"))?;
    Ok(())
}

/// Query nodes by session ID
pub async fn nodes_by_session(
    db: &Surreal<Db>,
    table: &str,
    session_id: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let sid = session_id.to_string();
    let query = format!("SELECT * FROM {table} WHERE session_id = $sid ORDER BY created_at");
    let mut result = db
        .query(&query)
        .bind(("sid", sid))
        .await
        .map_err(|e| format!("Failed to query {table} by session: {e}"))?;
    let rows: Vec<serde_json::Value> = result.take(0).map_err(|e| e.to_string())?;
    Ok(rows)
}
