use surrealdb::engine::local::Db;
use surrealdb::Surreal;

/// Run all schema definitions for the knowledge graph.
/// SurrealDB DEFINE statements are idempotent — safe to run on every startup.
pub async fn define_schema(db: &Surreal<Db>) -> Result<(), String> {
    // ── Node tables ──

    db.query(REPO_SCHEMA).await.map_err(err)?.check().map_err(err)?;
    db.query(MODULE_SCHEMA).await.map_err(err)?.check().map_err(err)?;
    db.query(FUNCTION_SCHEMA).await.map_err(err)?.check().map_err(err)?;
    db.query(CLASS_SCHEMA).await.map_err(err)?.check().map_err(err)?;
    db.query(TICKET_SCHEMA).await.map_err(err)?.check().map_err(err)?;
    db.query(SKILL_SCHEMA).await.map_err(err)?.check().map_err(err)?;
    db.query(DECISION_SCHEMA).await.map_err(err)?.check().map_err(err)?;
    db.query(ACTION_SCHEMA).await.map_err(err)?.check().map_err(err)?;
    db.query(TEST_SCHEMA).await.map_err(err)?.check().map_err(err)?;
    db.query(SESSION_SCHEMA).await.map_err(err)?.check().map_err(err)?;
    db.query(PROMPT_SCHEMA).await.map_err(err)?.check().map_err(err)?;

    // ── Edge tables ──

    db.query(STRUCTURAL_EDGES).await.map_err(err)?.check().map_err(err)?;
    db.query(REASONING_EDGES).await.map_err(err)?.check().map_err(err)?;
    db.query(WORK_EDGES).await.map_err(err)?.check().map_err(err)?;
    db.query(CONTEXT_EDGES).await.map_err(err)?.check().map_err(err)?;
    db.query(TEMPORAL_EDGES).await.map_err(err)?.check().map_err(err)?;

    // ── Indexes ──

    db.query(INDEXES).await.map_err(err)?.check().map_err(err)?;

    Ok(())
}

fn err<E: std::fmt::Display>(e: E) -> String {
    format!("Schema error: {}", e)
}

// ── Node Schemas ──

const REPO_SCHEMA: &str = "
DEFINE TABLE IF NOT EXISTS repo SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name           ON repo TYPE string;
DEFINE FIELD IF NOT EXISTS org            ON repo TYPE string;
DEFINE FIELD IF NOT EXISTS url            ON repo TYPE option<string>;
DEFINE FIELD IF NOT EXISTS branch         ON repo TYPE string;
DEFINE FIELD IF NOT EXISTS local_path     ON repo TYPE string;
DEFINE FIELD IF NOT EXISTS language       ON repo TYPE string;
DEFINE FIELD IF NOT EXISTS total_files    ON repo TYPE int;
DEFINE FIELD IF NOT EXISTS total_lines    ON repo TYPE int;
DEFINE FIELD IF NOT EXISTS active         ON repo TYPE bool;
DEFINE FIELD IF NOT EXISTS last_indexed   ON repo TYPE option<string>;
DEFINE FIELD IF NOT EXISTS created_at     ON repo TYPE string;
DEFINE FIELD IF NOT EXISTS updated_at     ON repo TYPE string;
DEFINE FIELD IF NOT EXISTS session_id     ON repo TYPE string;
DEFINE FIELD IF NOT EXISTS metadata       ON repo TYPE option<object>;
";

const MODULE_SCHEMA: &str = "
DEFINE TABLE IF NOT EXISTS module SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name           ON module TYPE string;
DEFINE FIELD IF NOT EXISTS file_path      ON module TYPE string;
DEFINE FIELD IF NOT EXISTS repo_id        ON module TYPE record<repo>;
DEFINE FIELD IF NOT EXISTS line_count     ON module TYPE int;
DEFINE FIELD IF NOT EXISTS docstring      ON module TYPE option<string>;
DEFINE FIELD IF NOT EXISTS imports        ON module TYPE array<string>;
DEFINE FIELD IF NOT EXISTS hash           ON module TYPE string;
DEFINE FIELD IF NOT EXISTS created_at     ON module TYPE string;
DEFINE FIELD IF NOT EXISTS updated_at     ON module TYPE string;
DEFINE FIELD IF NOT EXISTS session_id     ON module TYPE string;
DEFINE FIELD IF NOT EXISTS metadata       ON module TYPE option<object>;
";

const FUNCTION_SCHEMA: &str = "
DEFINE TABLE IF NOT EXISTS fn_def SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name           ON fn_def TYPE string;
DEFINE FIELD IF NOT EXISTS qualified_name ON fn_def TYPE string;
DEFINE FIELD IF NOT EXISTS module_id      ON fn_def TYPE record<module>;
DEFINE FIELD IF NOT EXISTS repo_id        ON fn_def TYPE record<repo>;
DEFINE FIELD IF NOT EXISTS file_path      ON fn_def TYPE string;
DEFINE FIELD IF NOT EXISTS line_start     ON fn_def TYPE int;
DEFINE FIELD IF NOT EXISTS line_end       ON fn_def TYPE int;
DEFINE FIELD IF NOT EXISTS signature      ON fn_def TYPE string;
DEFINE FIELD IF NOT EXISTS docstring      ON fn_def TYPE option<string>;
DEFINE FIELD IF NOT EXISTS params         ON fn_def TYPE array<object>;
DEFINE FIELD IF NOT EXISTS return_type    ON fn_def TYPE option<string>;
DEFINE FIELD IF NOT EXISTS is_async       ON fn_def TYPE bool;
DEFINE FIELD IF NOT EXISTS is_method      ON fn_def TYPE bool;
DEFINE FIELD IF NOT EXISTS class_name     ON fn_def TYPE option<string>;
DEFINE FIELD IF NOT EXISTS complexity     ON fn_def TYPE option<int>;
DEFINE FIELD IF NOT EXISTS created_at     ON fn_def TYPE string;
DEFINE FIELD IF NOT EXISTS updated_at     ON fn_def TYPE string;
DEFINE FIELD IF NOT EXISTS session_id     ON fn_def TYPE string;
DEFINE FIELD IF NOT EXISTS metadata       ON fn_def TYPE option<object>;
";

const CLASS_SCHEMA: &str = "
DEFINE TABLE IF NOT EXISTS class SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name           ON class TYPE string;
DEFINE FIELD IF NOT EXISTS qualified_name ON class TYPE string;
DEFINE FIELD IF NOT EXISTS module_id      ON class TYPE record<module>;
DEFINE FIELD IF NOT EXISTS repo_id        ON class TYPE record<repo>;
DEFINE FIELD IF NOT EXISTS file_path      ON class TYPE string;
DEFINE FIELD IF NOT EXISTS line_start     ON class TYPE int;
DEFINE FIELD IF NOT EXISTS line_end       ON class TYPE int;
DEFINE FIELD IF NOT EXISTS bases          ON class TYPE array<string>;
DEFINE FIELD IF NOT EXISTS docstring      ON class TYPE option<string>;
DEFINE FIELD IF NOT EXISTS method_count   ON class TYPE int;
DEFINE FIELD IF NOT EXISTS created_at     ON class TYPE string;
DEFINE FIELD IF NOT EXISTS updated_at     ON class TYPE string;
DEFINE FIELD IF NOT EXISTS session_id     ON class TYPE string;
DEFINE FIELD IF NOT EXISTS metadata       ON class TYPE option<object>;
";

const TICKET_SCHEMA: &str = "
DEFINE TABLE IF NOT EXISTS ticket SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS key            ON ticket TYPE string;
DEFINE FIELD IF NOT EXISTS title          ON ticket TYPE string;
DEFINE FIELD IF NOT EXISTS description    ON ticket TYPE option<string>;
DEFINE FIELD IF NOT EXISTS status         ON ticket TYPE string;
DEFINE FIELD IF NOT EXISTS priority       ON ticket TYPE string;
DEFINE FIELD IF NOT EXISTS assignee       ON ticket TYPE option<string>;
DEFINE FIELD IF NOT EXISTS story_points   ON ticket TYPE option<int>;
DEFINE FIELD IF NOT EXISTS sprint         ON ticket TYPE option<string>;
DEFINE FIELD IF NOT EXISTS labels         ON ticket TYPE array<string>;
DEFINE FIELD IF NOT EXISTS jira_url       ON ticket TYPE string;
DEFINE FIELD IF NOT EXISTS linked         ON ticket TYPE bool;
DEFINE FIELD IF NOT EXISTS created_at     ON ticket TYPE string;
DEFINE FIELD IF NOT EXISTS updated_at     ON ticket TYPE string;
DEFINE FIELD IF NOT EXISTS session_id     ON ticket TYPE string;
DEFINE FIELD IF NOT EXISTS metadata       ON ticket TYPE option<object>;
";

const SKILL_SCHEMA: &str = "
DEFINE TABLE IF NOT EXISTS skill SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name           ON skill TYPE string;
DEFINE FIELD IF NOT EXISTS file_path      ON skill TYPE string;
DEFINE FIELD IF NOT EXISTS category       ON skill TYPE string;
DEFINE FIELD IF NOT EXISTS content_hash   ON skill TYPE string;
DEFINE FIELD IF NOT EXISTS token_count    ON skill TYPE int;
DEFINE FIELD IF NOT EXISTS active         ON skill TYPE bool;
DEFINE FIELD IF NOT EXISTS source         ON skill TYPE string;
DEFINE FIELD IF NOT EXISTS created_at     ON skill TYPE string;
DEFINE FIELD IF NOT EXISTS updated_at     ON skill TYPE string;
DEFINE FIELD IF NOT EXISTS session_id     ON skill TYPE string;
DEFINE FIELD IF NOT EXISTS metadata       ON skill TYPE option<object>;
";

const DECISION_SCHEMA: &str = "
DEFINE TABLE IF NOT EXISTS decision SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS summary        ON decision TYPE string;
DEFINE FIELD IF NOT EXISTS rationale      ON decision TYPE string;
DEFINE FIELD IF NOT EXISTS confidence     ON decision TYPE float;
DEFINE FIELD IF NOT EXISTS impact         ON decision TYPE string;
DEFINE FIELD IF NOT EXISTS reversible     ON decision TYPE bool;
DEFINE FIELD IF NOT EXISTS alternatives   ON decision TYPE array<string>;
DEFINE FIELD IF NOT EXISTS chosen         ON decision TYPE string;
DEFINE FIELD IF NOT EXISTS outcome        ON decision TYPE option<string>;
DEFINE FIELD IF NOT EXISTS agent_model    ON decision TYPE string;
DEFINE FIELD IF NOT EXISTS prompt_tokens  ON decision TYPE option<int>;
DEFINE FIELD IF NOT EXISTS created_at     ON decision TYPE string;
DEFINE FIELD IF NOT EXISTS updated_at     ON decision TYPE string;
DEFINE FIELD IF NOT EXISTS session_id     ON decision TYPE string;
DEFINE FIELD IF NOT EXISTS metadata       ON decision TYPE option<object>;
";

const ACTION_SCHEMA: &str = "
DEFINE TABLE IF NOT EXISTS action SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS action_type    ON action TYPE string;
DEFINE FIELD IF NOT EXISTS detail         ON action TYPE string;
DEFINE FIELD IF NOT EXISTS actor          ON action TYPE string;
DEFINE FIELD IF NOT EXISTS duration_ms    ON action TYPE option<int>;
DEFINE FIELD IF NOT EXISTS token_cost     ON action TYPE option<int>;
DEFINE FIELD IF NOT EXISTS success        ON action TYPE bool DEFAULT true;
DEFINE FIELD IF NOT EXISTS error_message  ON action TYPE option<string>;
DEFINE FIELD IF NOT EXISTS created_at     ON action TYPE string;
DEFINE FIELD IF NOT EXISTS session_id     ON action TYPE string;
DEFINE FIELD IF NOT EXISTS metadata       ON action TYPE option<object>;
";

const TEST_SCHEMA: &str = "
DEFINE TABLE IF NOT EXISTS test SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name           ON test TYPE string;
DEFINE FIELD IF NOT EXISTS file_path      ON test TYPE string;
DEFINE FIELD IF NOT EXISTS module_id      ON test TYPE option<record<module>>;
DEFINE FIELD IF NOT EXISTS status         ON test TYPE string;
DEFINE FIELD IF NOT EXISTS duration_ms    ON test TYPE option<int>;
DEFINE FIELD IF NOT EXISTS error_output   ON test TYPE option<string>;
DEFINE FIELD IF NOT EXISTS run_number     ON test TYPE int;
DEFINE FIELD IF NOT EXISTS created_at     ON test TYPE string;
DEFINE FIELD IF NOT EXISTS session_id     ON test TYPE string;
DEFINE FIELD IF NOT EXISTS metadata       ON test TYPE option<object>;
";

const SESSION_SCHEMA: &str = "
DEFINE TABLE IF NOT EXISTS session SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS started_at     ON session TYPE string;
DEFINE FIELD IF NOT EXISTS ended_at       ON session TYPE option<string>;
DEFINE FIELD IF NOT EXISTS system_prompt  ON session TYPE string;
DEFINE FIELD IF NOT EXISTS total_tokens   ON session TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS total_decisions ON session TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS total_actions  ON session TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS total_files_changed ON session TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS metadata       ON session TYPE option<object>;
";

const PROMPT_SCHEMA: &str = "
DEFINE TABLE IF NOT EXISTS prompt SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS purpose        ON prompt TYPE string;
DEFINE FIELD IF NOT EXISTS system_text    ON prompt TYPE string;
DEFINE FIELD IF NOT EXISTS task_text      ON prompt TYPE string;
DEFINE FIELD IF NOT EXISTS skill_text     ON prompt TYPE string;
DEFINE FIELD IF NOT EXISTS repo_text      ON prompt TYPE string;
DEFINE FIELD IF NOT EXISTS user_message   ON prompt TYPE string;
DEFINE FIELD IF NOT EXISTS total_tokens   ON prompt TYPE int;
DEFINE FIELD IF NOT EXISTS model          ON prompt TYPE string;
DEFINE FIELD IF NOT EXISTS created_at     ON prompt TYPE string;
DEFINE FIELD IF NOT EXISTS session_id     ON prompt TYPE string;
DEFINE FIELD IF NOT EXISTS metadata       ON prompt TYPE option<object>;
";

// ── Edge Schemas ──

const STRUCTURAL_EDGES: &str = "
DEFINE TABLE IF NOT EXISTS belongs_to SCHEMALESS;
DEFINE TABLE IF NOT EXISTS imports SCHEMALESS;
DEFINE FIELD IF NOT EXISTS import_type ON imports TYPE option<string>;
DEFINE TABLE IF NOT EXISTS calls SCHEMALESS;
DEFINE FIELD IF NOT EXISTS call_count ON calls TYPE int DEFAULT 1;
DEFINE TABLE IF NOT EXISTS inherits SCHEMALESS;
DEFINE TABLE IF NOT EXISTS defined_in SCHEMALESS;
";

const REASONING_EDGES: &str = "
DEFINE TABLE IF NOT EXISTS informed_by SCHEMALESS;
DEFINE FIELD IF NOT EXISTS relevance ON informed_by TYPE option<float>;
DEFINE TABLE IF NOT EXISTS modified SCHEMALESS;
DEFINE FIELD IF NOT EXISTS change_type ON modified TYPE option<string>;
DEFINE FIELD IF NOT EXISTS diff_stats ON modified TYPE option<object>;
DEFINE TABLE IF NOT EXISTS addresses SCHEMALESS;
DEFINE TABLE IF NOT EXISTS led_to SCHEMALESS;
DEFINE FIELD IF NOT EXISTS relationship ON led_to TYPE option<string>;
DEFINE TABLE IF NOT EXISTS validated_by SCHEMALESS;
DEFINE FIELD IF NOT EXISTS result ON validated_by TYPE option<string>;
DEFINE TABLE IF NOT EXISTS triggered_by SCHEMALESS;
";

const WORK_EDGES: &str = "
DEFINE TABLE IF NOT EXISTS implemented_by SCHEMALESS;
DEFINE FIELD IF NOT EXISTS completion ON implemented_by TYPE option<float>;
DEFINE TABLE IF NOT EXISTS linked_to SCHEMALESS;
DEFINE TABLE IF NOT EXISTS depends_on SCHEMALESS;
DEFINE FIELD IF NOT EXISTS dependency_type ON depends_on TYPE option<string>;
DEFINE TABLE IF NOT EXISTS updated_by SCHEMALESS;
DEFINE FIELD IF NOT EXISTS field_changed ON updated_by TYPE option<string>;
DEFINE FIELD IF NOT EXISTS old_value ON updated_by TYPE option<string>;
DEFINE FIELD IF NOT EXISTS new_value ON updated_by TYPE option<string>;
";

const CONTEXT_EDGES: &str = "
DEFINE TABLE IF NOT EXISTS included_in SCHEMALESS;
DEFINE FIELD IF NOT EXISTS token_contribution ON included_in TYPE option<int>;
DEFINE TABLE IF NOT EXISTS contextualized SCHEMALESS;
DEFINE FIELD IF NOT EXISTS index_summary ON contextualized TYPE option<string>;
DEFINE TABLE IF NOT EXISTS produced SCHEMALESS;
";

const TEMPORAL_EDGES: &str = "
DEFINE TABLE IF NOT EXISTS occurred_in SCHEMALESS;
DEFINE FIELD IF NOT EXISTS sequence_num ON occurred_in TYPE option<int>;
DEFINE TABLE IF NOT EXISTS followed SCHEMALESS;
DEFINE FIELD IF NOT EXISTS gap_ms ON followed TYPE option<int>;
";

// ── Indexes ──

const INDEXES: &str = "
DEFINE INDEX IF NOT EXISTS idx_action_session_time ON action FIELDS session_id, created_at;
DEFINE INDEX IF NOT EXISTS idx_decision_session_time ON decision FIELDS session_id, created_at;
DEFINE INDEX IF NOT EXISTS idx_prompt_session ON prompt FIELDS session_id;
DEFINE INDEX IF NOT EXISTS idx_test_session ON test FIELDS session_id;

DEFINE INDEX IF NOT EXISTS idx_module_repo ON module FIELDS repo_id;
DEFINE INDEX IF NOT EXISTS idx_function_module ON fn_def FIELDS module_id;
DEFINE INDEX IF NOT EXISTS idx_function_repo ON fn_def FIELDS repo_id;
DEFINE INDEX IF NOT EXISTS idx_class_module ON class FIELDS module_id;

DEFINE INDEX IF NOT EXISTS idx_ticket_status ON ticket FIELDS status;
DEFINE INDEX IF NOT EXISTS idx_ticket_linked ON ticket FIELDS linked;
DEFINE INDEX IF NOT EXISTS idx_skill_active ON skill FIELDS active;
DEFINE INDEX IF NOT EXISTS idx_repo_active ON repo FIELDS active;
";
