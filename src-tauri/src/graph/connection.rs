use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;
use std::path::Path;

/// Initialize the embedded SurrealDB instance at the given path.
/// Returns a `Surreal<Db>` handle that is Send + Sync + Clone
/// and can be managed as Tauri state.
pub async fn initialize_graph_db(data_dir: &Path) -> Result<Surreal<Db>, String> {
    let graph_path = data_dir.join("graph");

    // Ensure the directory exists
    std::fs::create_dir_all(&graph_path)
        .map_err(|e| format!("Failed to create graph DB directory: {}", e))?;

    let path_str = graph_path
        .to_str()
        .ok_or_else(|| "Graph DB path contains invalid UTF-8".to_string())?;

    // Connect to embedded SurrealKV
    let db: Surreal<Db> = Surreal::new::<SurrealKv>(path_str)
        .await
        .map_err(|e| format!("Failed to connect to graph DB: {}", e))?;

    // Select namespace and database
    db.use_ns("vibeos")
        .use_db("graph")
        .await
        .map_err(|e| format!("Failed to select graph namespace: {}", e))?;

    Ok(db)
}
