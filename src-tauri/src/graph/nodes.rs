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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::connection::initialize_graph_db;
    use crate::graph::schema::define_schema;

    async fn test_db() -> Surreal<Db> {
        let dir = std::env::temp_dir().join(format!("vibe_graph_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = initialize_graph_db(&dir).await.unwrap();
        define_schema(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn test_create_and_get_node() {
        let db = test_db().await;
        let data = serde_json::json!({
            "name": "my-repo",
            "language": "Rust",
            "active": true,
        });
        create_node(&db, "repo", "test_repo", &data).await.unwrap();
        let node = get_node(&db, "repo", "test_repo").await.unwrap();
        assert!(node.is_some());
        assert_eq!(node.unwrap()["name"], "my-repo");
    }

    #[tokio::test]
    async fn test_upsert_node() {
        let db = test_db().await;
        let data1 = serde_json::json!({"name": "v1", "active": true});
        create_node(&db, "repo", "upsert_test", &data1).await.unwrap();

        let data2 = serde_json::json!({"name": "v2", "active": false});
        upsert_node(&db, "repo", "upsert_test", &data2).await.unwrap();

        let node = get_node(&db, "repo", "upsert_test").await.unwrap().unwrap();
        assert_eq!(node["name"], "v2");
    }

    #[tokio::test]
    async fn test_list_nodes() {
        let db = test_db().await;
        create_node(&db, "skill", "s1", &serde_json::json!({"name": "skill-a"})).await.unwrap();
        create_node(&db, "skill", "s2", &serde_json::json!({"name": "skill-b"})).await.unwrap();
        let nodes = list_nodes(&db, "skill").await.unwrap();
        assert_eq!(nodes.len(), 2);
    }

    #[tokio::test]
    async fn test_delete_node() {
        let db = test_db().await;
        create_node(&db, "repo", "del_test", &serde_json::json!({"name": "doomed"})).await.unwrap();
        delete_node(&db, "repo", "del_test").await.unwrap();
        let node = get_node(&db, "repo", "del_test").await.unwrap();
        assert!(node.is_none());
    }
}
