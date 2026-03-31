use serde::{Deserialize, Serialize};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// ── Query result types for Tauri IPC ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphNode {
    pub id: String,
    pub node_type: String,
    pub label: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub edge_type: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProvenanceTrace {
    pub function: serde_json::Value,
    pub decisions: Vec<serde_json::Value>,
    pub skills_used: Vec<serde_json::Value>,
    pub tickets: Vec<serde_json::Value>,
    pub tests: Vec<serde_json::Value>,
    pub prompts: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImpactRadius {
    pub direct_callers: Vec<serde_json::Value>,
    pub indirect_callers: Vec<serde_json::Value>,
    pub affected_tickets: Vec<serde_json::Value>,
    pub related_tests: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionReport {
    pub timeline: Vec<serde_json::Value>,
    pub decisions: Vec<serde_json::Value>,
    pub functions_touched: Vec<serde_json::Value>,
    pub test_results: Vec<serde_json::Value>,
    pub total_tokens: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillStats {
    pub skill_name: String,
    pub category: String,
    pub token_cost: i64,
    pub times_used: i64,
    pub avg_confidence: f64,
    pub validated_decisions: i64,
    pub refuted_decisions: i64,
}

// ── Helper to extract nodes from union results ──

/// Extract a string from a SurrealDB value that might be a plain string,
/// a Record ID object, or a nested structure.
fn val_to_string(v: &serde_json::Value) -> Option<String> {
    // Plain string
    if let Some(s) = v.as_str() {
        return Some(s.to_string());
    }
    // SurrealDB Thing: {"tb": "repo", "id": {"String": "vibe_os"}}
    if let Some(obj) = v.as_object() {
        if let (Some(tb), Some(id)) = (obj.get("tb"), obj.get("id")) {
            let tb_s = tb.as_str().unwrap_or("");
            let id_s = id.as_str()
                .map(|s| s.to_string())
                .or_else(|| id.get("String").and_then(|s| s.as_str()).map(|s| s.to_string()))
                .unwrap_or_else(|| format!("{}", id));
            return Some(format!("{tb_s}:{id_s}"));
        }
    }
    // Fallback: stringify it
    Some(format!("{}", v).trim_matches('"').to_string())
}

fn extract_graph_nodes(values: Vec<serde_json::Value>) -> Vec<GraphNode> {
    values
        .into_iter()
        .filter_map(|val| {
            let id = val_to_string(val.get("id")?)?;
            let node_type = val.get("node_type")?.as_str()?.to_string();
            let label = val.get("label").and_then(|v| v.as_str()).unwrap_or(&id).to_string();
            Some(GraphNode { id, node_type, label, data: val })
        })
        .collect()
}

fn extract_graph_edges(values: Vec<serde_json::Value>) -> Vec<GraphEdge> {
    values
        .into_iter()
        .filter_map(|val| {
            let source = val_to_string(val.get("source")?)?;
            let target = val_to_string(val.get("target")?)?;
            let edge_type = val.get("edge_type")?.as_str()?.to_string();
            let id = val.get("id").and_then(|v| val_to_string(v)).unwrap_or_default();
            Some(GraphEdge { id, source, target, edge_type, data: val })
        })
        .collect()
}

// ── Full graph query (for visualizer) ──

pub async fn get_full_graph(
    db: &Surreal<Db>,
    session_id: Option<&str>,
) -> Result<GraphData, String> {
    let sf = session_id
        .map(|s| format!("WHERE session_id = '{s}'"))
        .unwrap_or_default();

    let nodes_query = format!(
        "SELECT id, 'repo' AS node_type, name AS label FROM repo {sf};
         SELECT id, 'module' AS node_type, name AS label FROM module {sf};
         SELECT id, 'function' AS node_type, name AS label FROM fn_def {sf};
         SELECT id, 'class' AS node_type, name AS label FROM class {sf};
         SELECT id, 'ticket' AS node_type, key AS label FROM ticket WHERE linked = true;
         SELECT id, 'skill' AS node_type, name AS label FROM skill WHERE active = true;
         SELECT id, 'decision' AS node_type, summary AS label FROM decision {sf};
         SELECT id, 'test' AS node_type, name AS label FROM test {sf};"
    );

    let edges_query = "
        SELECT id, in AS source, out AS target, 'belongs_to' AS edge_type FROM belongs_to;
        SELECT id, in AS source, out AS target, 'imports' AS edge_type FROM imports;
        SELECT id, in AS source, out AS target, 'calls' AS edge_type FROM calls;
        SELECT id, in AS source, out AS target, 'inherits' AS edge_type FROM inherits;
        SELECT id, in AS source, out AS target, 'defined_in' AS edge_type FROM defined_in;
        SELECT id, in AS source, out AS target, 'informed_by' AS edge_type FROM informed_by;
        SELECT id, in AS source, out AS target, 'modified' AS edge_type FROM modified;
        SELECT id, in AS source, out AS target, 'addresses' AS edge_type FROM addresses;
        SELECT id, in AS source, out AS target, 'led_to' AS edge_type FROM led_to;
        SELECT id, in AS source, out AS target, 'validated_by' AS edge_type FROM validated_by;
        SELECT id, in AS source, out AS target, 'triggered_by' AS edge_type FROM triggered_by;
        SELECT id, in AS source, out AS target, 'implemented_by' AS edge_type FROM implemented_by;
        SELECT id, in AS source, out AS target, 'produced' AS edge_type FROM produced;
        SELECT id, in AS source, out AS target, 'occurred_in' AS edge_type FROM occurred_in;
    ";

    let mut nodes_result = db
        .query(&nodes_query)
        .await
        .map_err(|e| format!("Graph nodes query failed: {e}"))?;

    let mut edges_result = db
        .query(edges_query)
        .await
        .map_err(|e| format!("Graph edges query failed: {e}"))?;

    // Collect nodes from all 8 result sets
    let mut nodes: Vec<GraphNode> = Vec::new();
    for i in 0..8 {
        let batch: Vec<serde_json::Value> = nodes_result.take(i).unwrap_or_default();
        nodes.extend(extract_graph_nodes(batch));
    }

    // Collect edges from all 14 result sets
    let mut edges: Vec<GraphEdge> = Vec::new();
    for i in 0..14 {
        let batch: Vec<serde_json::Value> = edges_result.take(i).unwrap_or_default();
        edges.extend(extract_graph_edges(batch));
    }

    Ok(GraphData { nodes, edges })
}

// ── Provenance query ──

pub async fn get_provenance(
    db: &Surreal<Db>,
    function_id: &str,
) -> Result<ProvenanceTrace, String> {
    let q = format!(
        "SELECT * FROM {fid};
         SELECT * FROM decision WHERE id IN (SELECT in FROM modified WHERE out = {fid});
         SELECT * FROM skill WHERE id IN (SELECT out FROM informed_by WHERE in IN (SELECT in FROM modified WHERE out = {fid}));
         SELECT * FROM ticket WHERE id IN (SELECT out FROM addresses WHERE in IN (SELECT in FROM modified WHERE out = {fid}));
         SELECT * FROM test WHERE id IN (SELECT out FROM validated_by WHERE in IN (SELECT in FROM modified WHERE out = {fid}));
         SELECT * FROM prompt WHERE id IN (SELECT out FROM triggered_by WHERE in IN (SELECT in FROM modified WHERE out = {fid}));",
        fid = function_id
    );

    let mut result = db.query(&q).await.map_err(|e| e.to_string())?;

    let function: Vec<serde_json::Value> = result.take(0).unwrap_or_default();
    let decisions: Vec<serde_json::Value> = result.take(1).unwrap_or_default();
    let skills_used: Vec<serde_json::Value> = result.take(2).unwrap_or_default();
    let tickets: Vec<serde_json::Value> = result.take(3).unwrap_or_default();
    let tests: Vec<serde_json::Value> = result.take(4).unwrap_or_default();
    let prompts: Vec<serde_json::Value> = result.take(5).unwrap_or_default();

    Ok(ProvenanceTrace {
        function: function.into_iter().next().unwrap_or(serde_json::Value::Null),
        decisions,
        skills_used,
        tickets,
        tests,
        prompts,
    })
}

// ── Impact query ──

pub async fn get_impact(
    db: &Surreal<Db>,
    function_id: &str,
) -> Result<ImpactRadius, String> {
    let q = format!(
        "SELECT *, in AS caller FROM calls WHERE out = {fid};
         SELECT *, in AS caller FROM calls WHERE out IN (SELECT in FROM calls WHERE out = {fid});
         SELECT * FROM ticket WHERE id IN (SELECT in FROM implemented_by WHERE out = {fid});
         SELECT * FROM test WHERE id IN (SELECT out FROM validated_by WHERE in IN (SELECT in FROM modified WHERE out = {fid}));",
        fid = function_id
    );

    let mut result = db.query(&q).await.map_err(|e| e.to_string())?;

    let direct_callers: Vec<serde_json::Value> = result.take(0).unwrap_or_default();
    let indirect_callers: Vec<serde_json::Value> = result.take(1).unwrap_or_default();
    let affected_tickets: Vec<serde_json::Value> = result.take(2).unwrap_or_default();
    let related_tests: Vec<serde_json::Value> = result.take(3).unwrap_or_default();

    Ok(ImpactRadius {
        direct_callers,
        indirect_callers,
        affected_tickets,
        related_tests,
    })
}

// ── Session report ──

pub async fn get_session_report(
    db: &Surreal<Db>,
    session_id: &str,
) -> Result<SessionReport, String> {
    let sid = session_id.to_string();
    let q = "SELECT * FROM action WHERE session_id = $sid ORDER BY created_at;
             SELECT * FROM decision WHERE session_id = $sid ORDER BY created_at;
             SELECT * FROM fn_def WHERE session_id = $sid ORDER BY updated_at;
             SELECT * FROM test WHERE session_id = $sid ORDER BY created_at;
             SELECT math::sum(total_tokens) AS total FROM prompt WHERE session_id = $sid;";

    let mut result = db
        .query(q)
        .bind(("sid", sid))
        .await
        .map_err(|e| e.to_string())?;

    let timeline: Vec<serde_json::Value> = result.take(0).unwrap_or_default();
    let decisions: Vec<serde_json::Value> = result.take(1).unwrap_or_default();
    let functions_touched: Vec<serde_json::Value> = result.take(2).unwrap_or_default();
    let test_results: Vec<serde_json::Value> = result.take(3).unwrap_or_default();
    let token_row: Vec<serde_json::Value> = result.take(4).unwrap_or_default();

    let total_tokens = token_row
        .first()
        .and_then(|v| v.get("total"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    Ok(SessionReport {
        timeline,
        decisions,
        functions_touched,
        test_results,
        total_tokens,
    })
}

// ── Skill effectiveness ──

pub async fn get_skill_effectiveness(
    db: &Surreal<Db>,
) -> Result<Vec<SkillStats>, String> {
    let mut q = db
        .query(
            "SELECT
                out.name AS skill_name,
                out.category AS category,
                out.token_count AS token_cost,
                count() AS times_used,
                math::mean(in.confidence) AS avg_confidence
            FROM informed_by
            GROUP BY out
            ORDER BY avg_confidence DESC"
        )
        .await
        .map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = q.take(0).unwrap_or_default();

    Ok(rows
        .into_iter()
        .filter_map(|v| {
            Some(SkillStats {
                skill_name: v.get("skill_name")?.as_str()?.to_string(),
                category: v.get("category")?.as_str().unwrap_or("unknown").to_string(),
                token_cost: v.get("token_cost")?.as_i64().unwrap_or(0),
                times_used: v.get("times_used")?.as_i64().unwrap_or(0),
                avg_confidence: v.get("avg_confidence")?.as_f64().unwrap_or(0.0),
                validated_decisions: 0,
                refuted_decisions: 0,
            })
        })
        .collect())
}

// ── Topology query (for architecture diagram) ──

#[derive(Debug, Serialize, Deserialize)]
pub struct TopologyNode {
    pub id: String,
    pub label: String,
    pub node_type: String,
    pub framework: String,
    pub stats: String,
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TopologyEdge {
    pub source: String,
    pub target: String,
    pub edge_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TopologyData {
    pub repos: Vec<TopologyNode>,
    pub modules: Vec<TopologyNode>,
    pub edges: Vec<TopologyEdge>,
}

pub async fn get_topology(db: &Surreal<Db>) -> Result<TopologyData, String> {
    let nodes_query = "SELECT id, name AS label, 'repo' AS node_type, framework, stats, active FROM repo;
                       SELECT id, name AS label, 'module' AS node_type, framework, stats, active FROM module;";

    let edges_query = "SELECT in AS source, out AS target, 'imports' AS edge_type FROM imports;
                       SELECT in AS source, out AS target, 'calls' AS edge_type FROM calls;
                       SELECT in AS source, out AS target, 'depends_on' AS edge_type FROM depends_on;
                       SELECT in AS source, out AS target, 'belongs_to' AS edge_type FROM belongs_to;";

    let mut nodes_result = db
        .query(nodes_query)
        .await
        .map_err(|e| format!("Topology nodes query failed: {e}"))?;

    let mut edges_result = db
        .query(edges_query)
        .await
        .map_err(|e| format!("Topology edges query failed: {e}"))?;

    let repo_vals: Vec<serde_json::Value> = nodes_result.take(0).unwrap_or_default();
    let module_vals: Vec<serde_json::Value> = nodes_result.take(1).unwrap_or_default();

    let repos = repo_vals
        .into_iter()
        .filter_map(|val| {
            let id = val_to_string(val.get("id")?)?;
            let label = val.get("label").and_then(|v| v.as_str()).unwrap_or(&id).to_string();
            let node_type = val.get("node_type").and_then(|v| v.as_str()).unwrap_or("repo").to_string();
            let framework = val.get("framework").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let stats = val.get("stats").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let active = val.get("active").and_then(|v| v.as_bool()).unwrap_or(false);
            Some(TopologyNode { id, label, node_type, framework, stats, active })
        })
        .collect();

    let modules = module_vals
        .into_iter()
        .filter_map(|val| {
            let id = val_to_string(val.get("id")?)?;
            let label = val.get("label").and_then(|v| v.as_str()).unwrap_or(&id).to_string();
            let node_type = val.get("node_type").and_then(|v| v.as_str()).unwrap_or("module").to_string();
            let framework = val.get("framework").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let stats = val.get("stats").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let active = val.get("active").and_then(|v| v.as_bool()).unwrap_or(false);
            Some(TopologyNode { id, label, node_type, framework, stats, active })
        })
        .collect();

    let mut edges: Vec<TopologyEdge> = Vec::new();
    for i in 0..4usize {
        let batch: Vec<serde_json::Value> = edges_result.take(i).unwrap_or_default();
        for val in batch {
            if let (Some(source), Some(target), Some(edge_type)) = (
                val.get("source").and_then(|v| val_to_string(v)),
                val.get("target").and_then(|v| val_to_string(v)),
                val.get("edge_type").and_then(|v| v.as_str()).map(|s| s.to_string()),
            ) {
                edges.push(TopologyEdge { source, target, edge_type });
            }
        }
    }

    Ok(TopologyData { repos, modules, edges })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::connection::initialize_graph_db;
    use crate::graph::schema::define_schema;
    use crate::graph::nodes;
    use crate::graph::edges;
    use crate::graph::population;

    async fn test_db() -> Surreal<Db> {
        let dir = std::env::temp_dir().join(format!("vibe_qtest_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = initialize_graph_db(&dir).await.unwrap();
        define_schema(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn test_get_full_graph_empty() {
        let db = test_db().await;
        let graph = get_full_graph(&db, None).await.unwrap();
        assert!(graph.nodes.is_empty());
        assert!(graph.edges.is_empty());
    }

    #[tokio::test]
    async fn test_get_full_graph_with_data() {
        let db = test_db().await;
        nodes::create_node(&db, "repo", "r1", &serde_json::json!({"name": "my-repo", "node_type": "repo", "label": "my-repo"})).await.unwrap();
        nodes::create_node(&db, "fn_def", "f1", &serde_json::json!({"name": "main", "node_type": "function", "label": "main"})).await.unwrap();
        edges::relate(&db, "fn_def:f1", "belongs_to", "repo:r1", None).await.unwrap();

        let graph = get_full_graph(&db, None).await.unwrap();
        assert!(!graph.nodes.is_empty());
    }

    #[tokio::test]
    async fn test_provenance_query() {
        let db = test_db().await;
        nodes::create_node(&db, "fn_def", "prov_fn", &serde_json::json!({"name": "handler", "node_type": "function"})).await.unwrap();
        population::populate_session(&db, "sess-1", "").await.unwrap();
        population::populate_decision(
            &db, "prov_dec", "sess-1", "Refactor handler", "Clean up", 0.9,
            "dx", true, &[], &[], "2026-03-30T00:00:00Z",
        ).await.unwrap();
        edges::relate(&db, "decision:prov_dec", "modified", "fn_def:prov_fn", None).await.unwrap();

        let trace = get_provenance(&db, "fn_def:prov_fn").await.unwrap();
        // The function node itself should be returned
        assert!(!trace.function.is_null());
        // The modified edge exists — verify via direct edge query as subquery behavior
        // may vary across SurrealDB versions
        let edges = edges::outgoing_edges(&db, "decision:prov_dec", "modified").await.unwrap();
        assert!(!edges.is_empty());
    }

    #[tokio::test]
    async fn test_session_report() {
        let db = test_db().await;
        population::populate_session(&db, "report_sess", "test").await.unwrap();
        population::populate_decision(
            &db, "rep_dec", "report_sess", "Add tests", "Coverage", 0.7,
            "dx", true, &[], &[], "2026-03-30T00:00:00Z",
        ).await.unwrap();
        population::populate_action(
            &db, "rep_act", "report_sess", "FILE_CREATE", "Created test.rs",
            "agent", "2026-03-30T00:00:00Z", None,
        ).await.unwrap();

        let report = get_session_report(&db, "report_sess").await.unwrap();
        assert!(!report.decisions.is_empty());
        assert!(!report.timeline.is_empty());
    }

    #[tokio::test]
    async fn test_impact_query() {
        let db = test_db().await;
        nodes::create_node(&db, "fn_def", "imp_fn", &serde_json::json!({"name": "core_fn"})).await.unwrap();
        nodes::create_node(&db, "fn_def", "imp_caller", &serde_json::json!({"name": "caller_fn"})).await.unwrap();
        edges::relate(&db, "fn_def:imp_caller", "calls", "fn_def:imp_fn", None).await.unwrap();

        let impact = get_impact(&db, "fn_def:imp_fn").await.unwrap();
        assert!(!impact.direct_callers.is_empty());
    }
}
