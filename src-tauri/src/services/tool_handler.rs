use serde_json::json;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

use crate::graph::queries;

/// Handle a tool request from the sidecar and return a JSON result.
pub async fn handle_tool_request(
    graph_db: &Surreal<Db>,
    tool: &str,
    input: &serde_json::Value,
    session_id: &str,
) -> Result<serde_json::Value, String> {
    match tool {
        "vibe_graph_provenance" => {
            let function_id = input["functionId"]
                .as_str()
                .ok_or("Missing functionId")?;
            let trace = queries::get_provenance(graph_db, function_id).await
                .map_err(|e| e.to_string())?;
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&trace).unwrap_or_default()
                }]
            }))
        }

        "vibe_graph_impact" => {
            let function_id = input["functionId"]
                .as_str()
                .ok_or("Missing functionId")?;
            let impact = queries::get_impact(graph_db, function_id).await
                .map_err(|e| e.to_string())?;
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&impact).unwrap_or_default()
                }]
            }))
        }

        "vibe_record_decision" => {
            let decision = input["decision"].as_str().unwrap_or("");
            let rationale = input["rationale"].as_str().unwrap_or("");
            let confidence = input["confidence"].as_f64().unwrap_or(0.5);
            let impact_category = input["impactCategory"].as_str().unwrap_or("dx");
            let reversible = input["reversible"].as_bool().unwrap_or(true);
            let related_files: Vec<String> = input["relatedFiles"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let related_tickets: Vec<String> = input["relatedTickets"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            let id = format!("tool_{}", uuid::Uuid::new_v4().to_string().replace('-', "_"));
            let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

            crate::graph::population::populate_decision(
                graph_db,
                &id,
                session_id,
                decision,
                rationale,
                confidence,
                impact_category,
                reversible,
                &related_files,
                &related_tickets,
                &timestamp,
            )
            .await
            .map_err(|e| e.to_string())?;

            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": format!("Decision recorded: {}", decision)
                }]
            }))
        }

        "vibe_search_graph" => {
            let query_str = input["query"].as_str().ok_or("Missing query")?;
            // Search across key graph tables for matching nodes
            let q = format!(
                "SELECT id, 'decision' AS node_type, summary AS label FROM decision WHERE summary CONTAINS '{q}';
                 SELECT id, 'function' AS node_type, name AS label FROM fn_def WHERE name CONTAINS '{q}';
                 SELECT id, 'module' AS node_type, name AS label FROM module WHERE name CONTAINS '{q}';
                 SELECT id, 'ticket' AS node_type, key AS label FROM ticket WHERE key CONTAINS '{q}';
                 SELECT id, 'skill' AS node_type, name AS label FROM skill WHERE name CONTAINS '{q}';",
                q = query_str.replace('\'', "\\'")
            );
            let mut result = graph_db.query(&q).await.map_err(|e| e.to_string())?;
            let mut all_results: Vec<serde_json::Value> = Vec::new();
            for i in 0..5usize {
                let batch: Vec<serde_json::Value> = result.take(i).unwrap_or_default();
                all_results.extend(batch);
            }
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&all_results).unwrap_or_default()
                }]
            }))
        }

        "vibe_session_context" => {
            let sid = input["sessionId"].as_str().unwrap_or(session_id);
            let report = queries::get_session_report(graph_db, sid).await
                .map_err(|e| e.to_string())?;
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&report).unwrap_or_default()
                }]
            }))
        }

        "vibe_architecture" => {
            let _entry_point = input["entryPoint"].as_str().ok_or("Missing entryPoint")?;
            let topology = queries::get_topology(graph_db).await
                .map_err(|e| e.to_string())?;
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&topology).unwrap_or_default()
                }]
            }))
        }

        _ => Err(format!("Unknown tool: {}", tool)),
    }
}
