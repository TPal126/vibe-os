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

fn extract_graph_nodes(values: Vec<serde_json::Value>) -> Vec<GraphNode> {
    values
        .into_iter()
        .filter_map(|val| {
            let id = val.get("id")?.as_str()?.to_string();
            let node_type = val.get("node_type")?.as_str()?.to_string();
            let label = val.get("label")?.as_str()?.to_string();
            Some(GraphNode { id, node_type, label, data: val })
        })
        .collect()
}

fn extract_graph_edges(values: Vec<serde_json::Value>) -> Vec<GraphEdge> {
    values
        .into_iter()
        .filter_map(|val| {
            let source = val.get("source")?.as_str()?.to_string();
            let target = val.get("target")?.as_str()?.to_string();
            let edge_type = val.get("edge_type")?.as_str()?.to_string();
            let id = val.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
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
         SELECT id, 'function' AS node_type, name AS label FROM function {sf};
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
             SELECT * FROM function WHERE session_id = $sid ORDER BY updated_at;
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
