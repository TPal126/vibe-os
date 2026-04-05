use surrealdb::engine::local::Db;
use surrealdb::Surreal;

/// Run all schema definitions for the knowledge graph.
/// All tables are SCHEMALESS to avoid type coercion issues.
/// Field definitions are omitted — SCHEMALESS accepts any JSON content.
pub async fn define_schema(db: &Surreal<Db>) -> Result<(), String> {
    db.query(NODE_TABLES).await.map_err(err)?.check().map_err(err)?;
    db.query(EDGE_TABLES).await.map_err(err)?.check().map_err(err)?;
    db.query(INDEXES).await.map_err(err)?.check().map_err(err)?;
    Ok(())
}

fn err<E: std::fmt::Display>(e: E) -> String {
    format!("Schema error: {}", e)
}

const NODE_TABLES: &str = "
DEFINE TABLE IF NOT EXISTS repo SCHEMALESS;
DEFINE TABLE IF NOT EXISTS module SCHEMALESS;
DEFINE TABLE IF NOT EXISTS fn_def SCHEMALESS;
DEFINE TABLE IF NOT EXISTS class SCHEMALESS;
DEFINE TABLE IF NOT EXISTS ticket SCHEMALESS;
DEFINE TABLE IF NOT EXISTS skill SCHEMALESS;
DEFINE TABLE IF NOT EXISTS decision SCHEMALESS;
DEFINE TABLE IF NOT EXISTS action SCHEMALESS;
DEFINE TABLE IF NOT EXISTS test SCHEMALESS;
DEFINE TABLE IF NOT EXISTS session SCHEMALESS;
DEFINE TABLE IF NOT EXISTS prompt SCHEMALESS;
DEFINE TABLE IF NOT EXISTS event SCHEMALESS;
";

const EDGE_TABLES: &str = "
DEFINE TABLE IF NOT EXISTS belongs_to SCHEMALESS;
DEFINE TABLE IF NOT EXISTS imports SCHEMALESS;
DEFINE TABLE IF NOT EXISTS calls SCHEMALESS;
DEFINE TABLE IF NOT EXISTS inherits SCHEMALESS;
DEFINE TABLE IF NOT EXISTS defined_in SCHEMALESS;
DEFINE TABLE IF NOT EXISTS informed_by SCHEMALESS;
DEFINE TABLE IF NOT EXISTS modified SCHEMALESS;
DEFINE TABLE IF NOT EXISTS addresses SCHEMALESS;
DEFINE TABLE IF NOT EXISTS led_to SCHEMALESS;
DEFINE TABLE IF NOT EXISTS validated_by SCHEMALESS;
DEFINE TABLE IF NOT EXISTS triggered_by SCHEMALESS;
DEFINE TABLE IF NOT EXISTS implemented_by SCHEMALESS;
DEFINE TABLE IF NOT EXISTS linked_to SCHEMALESS;
DEFINE TABLE IF NOT EXISTS depends_on SCHEMALESS;
DEFINE TABLE IF NOT EXISTS updated_by SCHEMALESS;
DEFINE TABLE IF NOT EXISTS included_in SCHEMALESS;
DEFINE TABLE IF NOT EXISTS contextualized SCHEMALESS;
DEFINE TABLE IF NOT EXISTS produced SCHEMALESS;
DEFINE TABLE IF NOT EXISTS occurred_in SCHEMALESS;
DEFINE TABLE IF NOT EXISTS followed SCHEMALESS;
DEFINE TABLE IF NOT EXISTS session_uses_repo SCHEMALESS;
DEFINE TABLE IF NOT EXISTS project_contains_repo SCHEMALESS;
DEFINE TABLE IF NOT EXISTS branched_from SCHEMALESS;
";

const INDEXES: &str = "
DEFINE INDEX IF NOT EXISTS idx_action_session ON action FIELDS session_id;
DEFINE INDEX IF NOT EXISTS idx_decision_session ON decision FIELDS session_id;
DEFINE INDEX IF NOT EXISTS idx_prompt_session ON prompt FIELDS session_id;
DEFINE INDEX IF NOT EXISTS idx_test_session ON test FIELDS session_id;
DEFINE INDEX IF NOT EXISTS idx_module_repo ON module FIELDS repo_id;
DEFINE INDEX IF NOT EXISTS idx_fn_module ON fn_def FIELDS module_id;
DEFINE INDEX IF NOT EXISTS idx_fn_repo ON fn_def FIELDS repo_id;
DEFINE INDEX IF NOT EXISTS idx_class_module ON class FIELDS module_id;
DEFINE INDEX IF NOT EXISTS idx_skill_active ON skill FIELDS active;
DEFINE INDEX IF NOT EXISTS idx_repo_active ON repo FIELDS active;
DEFINE INDEX IF NOT EXISTS idx_event_session ON event FIELDS session_id;
DEFINE INDEX IF NOT EXISTS idx_event_kind ON event FIELDS kind;
DEFINE INDEX IF NOT EXISTS idx_repo_source ON repo FIELDS source;
DEFINE INDEX IF NOT EXISTS idx_repo_parent ON repo FIELDS parent_id;
";
