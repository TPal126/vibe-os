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
DEFINE TABLE repo SCHEMAFULL;
DEFINE FIELD name           ON repo TYPE string;
DEFINE FIELD org            ON repo TYPE string;
DEFINE FIELD url            ON repo TYPE option<string>;
DEFINE FIELD branch         ON repo TYPE string;
DEFINE FIELD local_path     ON repo TYPE string;
DEFINE FIELD language       ON repo TYPE string;
DEFINE FIELD total_files    ON repo TYPE int;
DEFINE FIELD total_lines    ON repo TYPE int;
DEFINE FIELD active         ON repo TYPE bool;
DEFINE FIELD last_indexed   ON repo TYPE option<datetime>;
DEFINE FIELD created_at     ON repo TYPE datetime;
DEFINE FIELD updated_at     ON repo TYPE datetime;
DEFINE FIELD session_id     ON repo TYPE string;
DEFINE FIELD metadata       ON repo TYPE option<object>;
";

const MODULE_SCHEMA: &str = "
DEFINE TABLE module SCHEMAFULL;
DEFINE FIELD name           ON module TYPE string;
DEFINE FIELD file_path      ON module TYPE string;
DEFINE FIELD repo_id        ON module TYPE record<repo>;
DEFINE FIELD line_count     ON module TYPE int;
DEFINE FIELD docstring      ON module TYPE option<string>;
DEFINE FIELD imports        ON module TYPE array<string>;
DEFINE FIELD hash           ON module TYPE string;
DEFINE FIELD created_at     ON module TYPE datetime;
DEFINE FIELD updated_at     ON module TYPE datetime;
DEFINE FIELD session_id     ON module TYPE string;
DEFINE FIELD metadata       ON module TYPE option<object>;
";

const FUNCTION_SCHEMA: &str = "
DEFINE TABLE fn_def SCHEMAFULL;
DEFINE FIELD name           ON fn_def TYPE string;
DEFINE FIELD qualified_name ON fn_def TYPE string;
DEFINE FIELD module_id      ON fn_def TYPE record<module>;
DEFINE FIELD repo_id        ON fn_def TYPE record<repo>;
DEFINE FIELD file_path      ON fn_def TYPE string;
DEFINE FIELD line_start     ON fn_def TYPE int;
DEFINE FIELD line_end       ON fn_def TYPE int;
DEFINE FIELD signature      ON fn_def TYPE string;
DEFINE FIELD docstring      ON fn_def TYPE option<string>;
DEFINE FIELD params         ON fn_def TYPE array<object>;
DEFINE FIELD return_type    ON fn_def TYPE option<string>;
DEFINE FIELD is_async       ON fn_def TYPE bool;
DEFINE FIELD is_method      ON fn_def TYPE bool;
DEFINE FIELD class_name     ON fn_def TYPE option<string>;
DEFINE FIELD complexity     ON fn_def TYPE option<int>;
DEFINE FIELD created_at     ON fn_def TYPE datetime;
DEFINE FIELD updated_at     ON fn_def TYPE datetime;
DEFINE FIELD session_id     ON fn_def TYPE string;
DEFINE FIELD metadata       ON fn_def TYPE option<object>;
";

const CLASS_SCHEMA: &str = "
DEFINE TABLE class SCHEMAFULL;
DEFINE FIELD name           ON class TYPE string;
DEFINE FIELD qualified_name ON class TYPE string;
DEFINE FIELD module_id      ON class TYPE record<module>;
DEFINE FIELD repo_id        ON class TYPE record<repo>;
DEFINE FIELD file_path      ON class TYPE string;
DEFINE FIELD line_start     ON class TYPE int;
DEFINE FIELD line_end       ON class TYPE int;
DEFINE FIELD bases          ON class TYPE array<string>;
DEFINE FIELD docstring      ON class TYPE option<string>;
DEFINE FIELD method_count   ON class TYPE int;
DEFINE FIELD created_at     ON class TYPE datetime;
DEFINE FIELD updated_at     ON class TYPE datetime;
DEFINE FIELD session_id     ON class TYPE string;
DEFINE FIELD metadata       ON class TYPE option<object>;
";

const TICKET_SCHEMA: &str = "
DEFINE TABLE ticket SCHEMAFULL;
DEFINE FIELD key            ON ticket TYPE string;
DEFINE FIELD title          ON ticket TYPE string;
DEFINE FIELD description    ON ticket TYPE option<string>;
DEFINE FIELD status         ON ticket TYPE string;
DEFINE FIELD priority       ON ticket TYPE string;
DEFINE FIELD assignee       ON ticket TYPE option<string>;
DEFINE FIELD story_points   ON ticket TYPE option<int>;
DEFINE FIELD sprint         ON ticket TYPE option<string>;
DEFINE FIELD labels         ON ticket TYPE array<string>;
DEFINE FIELD jira_url       ON ticket TYPE string;
DEFINE FIELD linked         ON ticket TYPE bool;
DEFINE FIELD created_at     ON ticket TYPE datetime;
DEFINE FIELD updated_at     ON ticket TYPE datetime;
DEFINE FIELD session_id     ON ticket TYPE string;
DEFINE FIELD metadata       ON ticket TYPE option<object>;
";

const SKILL_SCHEMA: &str = "
DEFINE TABLE skill SCHEMAFULL;
DEFINE FIELD name           ON skill TYPE string;
DEFINE FIELD file_path      ON skill TYPE string;
DEFINE FIELD category       ON skill TYPE string;
DEFINE FIELD content_hash   ON skill TYPE string;
DEFINE FIELD token_count    ON skill TYPE int;
DEFINE FIELD active         ON skill TYPE bool;
DEFINE FIELD source         ON skill TYPE string;
DEFINE FIELD created_at     ON skill TYPE datetime;
DEFINE FIELD updated_at     ON skill TYPE datetime;
DEFINE FIELD session_id     ON skill TYPE string;
DEFINE FIELD metadata       ON skill TYPE option<object>;
";

const DECISION_SCHEMA: &str = "
DEFINE TABLE decision SCHEMAFULL;
DEFINE FIELD summary        ON decision TYPE string;
DEFINE FIELD rationale      ON decision TYPE string;
DEFINE FIELD confidence     ON decision TYPE float;
DEFINE FIELD impact         ON decision TYPE string;
DEFINE FIELD reversible     ON decision TYPE bool;
DEFINE FIELD alternatives   ON decision TYPE array<string>;
DEFINE FIELD chosen         ON decision TYPE string;
DEFINE FIELD outcome        ON decision TYPE option<string>;
DEFINE FIELD agent_model    ON decision TYPE string;
DEFINE FIELD prompt_tokens  ON decision TYPE option<int>;
DEFINE FIELD created_at     ON decision TYPE datetime;
DEFINE FIELD updated_at     ON decision TYPE datetime;
DEFINE FIELD session_id     ON decision TYPE string;
DEFINE FIELD metadata       ON decision TYPE option<object>;
";

const ACTION_SCHEMA: &str = "
DEFINE TABLE action SCHEMAFULL;
DEFINE FIELD action_type    ON action TYPE string;
DEFINE FIELD detail         ON action TYPE string;
DEFINE FIELD actor          ON action TYPE string;
DEFINE FIELD duration_ms    ON action TYPE option<int>;
DEFINE FIELD token_cost     ON action TYPE option<int>;
DEFINE FIELD success        ON action TYPE bool DEFAULT true;
DEFINE FIELD error_message  ON action TYPE option<string>;
DEFINE FIELD created_at     ON action TYPE datetime;
DEFINE FIELD session_id     ON action TYPE string;
DEFINE FIELD metadata       ON action TYPE option<object>;
";

const TEST_SCHEMA: &str = "
DEFINE TABLE test SCHEMAFULL;
DEFINE FIELD name           ON test TYPE string;
DEFINE FIELD file_path      ON test TYPE string;
DEFINE FIELD module_id      ON test TYPE option<record<module>>;
DEFINE FIELD status         ON test TYPE string;
DEFINE FIELD duration_ms    ON test TYPE option<int>;
DEFINE FIELD error_output   ON test TYPE option<string>;
DEFINE FIELD run_number     ON test TYPE int;
DEFINE FIELD created_at     ON test TYPE datetime;
DEFINE FIELD session_id     ON test TYPE string;
DEFINE FIELD metadata       ON test TYPE option<object>;
";

const SESSION_SCHEMA: &str = "
DEFINE TABLE session SCHEMAFULL;
DEFINE FIELD started_at     ON session TYPE datetime;
DEFINE FIELD ended_at       ON session TYPE option<datetime>;
DEFINE FIELD system_prompt  ON session TYPE string;
DEFINE FIELD total_tokens   ON session TYPE int DEFAULT 0;
DEFINE FIELD total_decisions ON session TYPE int DEFAULT 0;
DEFINE FIELD total_actions  ON session TYPE int DEFAULT 0;
DEFINE FIELD total_files_changed ON session TYPE int DEFAULT 0;
DEFINE FIELD metadata       ON session TYPE option<object>;
";

const PROMPT_SCHEMA: &str = "
DEFINE TABLE prompt SCHEMAFULL;
DEFINE FIELD purpose        ON prompt TYPE string;
DEFINE FIELD system_text    ON prompt TYPE string;
DEFINE FIELD task_text      ON prompt TYPE string;
DEFINE FIELD skill_text     ON prompt TYPE string;
DEFINE FIELD repo_text      ON prompt TYPE string;
DEFINE FIELD user_message   ON prompt TYPE string;
DEFINE FIELD total_tokens   ON prompt TYPE int;
DEFINE FIELD model          ON prompt TYPE string;
DEFINE FIELD created_at     ON prompt TYPE datetime;
DEFINE FIELD session_id     ON prompt TYPE string;
DEFINE FIELD metadata       ON prompt TYPE option<object>;
";

// ── Edge Schemas ──

const STRUCTURAL_EDGES: &str = "
DEFINE TABLE belongs_to SCHEMALESS;
DEFINE TABLE imports SCHEMALESS;
DEFINE FIELD import_type ON imports TYPE option<string>;
DEFINE TABLE calls SCHEMALESS;
DEFINE FIELD call_count ON calls TYPE int DEFAULT 1;
DEFINE TABLE inherits SCHEMALESS;
DEFINE TABLE defined_in SCHEMALESS;
";

const REASONING_EDGES: &str = "
DEFINE TABLE informed_by SCHEMALESS;
DEFINE FIELD relevance ON informed_by TYPE option<float>;
DEFINE TABLE modified SCHEMALESS;
DEFINE FIELD change_type ON modified TYPE option<string>;
DEFINE FIELD diff_stats ON modified TYPE option<object>;
DEFINE TABLE addresses SCHEMALESS;
DEFINE TABLE led_to SCHEMALESS;
DEFINE FIELD relationship ON led_to TYPE option<string>;
DEFINE TABLE validated_by SCHEMALESS;
DEFINE FIELD result ON validated_by TYPE option<string>;
DEFINE TABLE triggered_by SCHEMALESS;
";

const WORK_EDGES: &str = "
DEFINE TABLE implemented_by SCHEMALESS;
DEFINE FIELD completion ON implemented_by TYPE option<float>;
DEFINE TABLE linked_to SCHEMALESS;
DEFINE TABLE depends_on SCHEMALESS;
DEFINE FIELD dependency_type ON depends_on TYPE option<string>;
DEFINE TABLE updated_by SCHEMALESS;
DEFINE FIELD field_changed ON updated_by TYPE option<string>;
DEFINE FIELD old_value ON updated_by TYPE option<string>;
DEFINE FIELD new_value ON updated_by TYPE option<string>;
";

const CONTEXT_EDGES: &str = "
DEFINE TABLE included_in SCHEMALESS;
DEFINE FIELD token_contribution ON included_in TYPE option<int>;
DEFINE TABLE contextualized SCHEMALESS;
DEFINE FIELD index_summary ON contextualized TYPE option<string>;
DEFINE TABLE produced SCHEMALESS;
";

const TEMPORAL_EDGES: &str = "
DEFINE TABLE occurred_in SCHEMALESS;
DEFINE FIELD sequence_num ON occurred_in TYPE option<int>;
DEFINE TABLE followed SCHEMALESS;
DEFINE FIELD gap_ms ON followed TYPE option<int>;
";

// ── Indexes ──

const INDEXES: &str = "
DEFINE INDEX idx_action_session_time ON action FIELDS session_id, created_at;
DEFINE INDEX idx_decision_session_time ON decision FIELDS session_id, created_at;
DEFINE INDEX idx_prompt_session ON prompt FIELDS session_id;
DEFINE INDEX idx_test_session ON test FIELDS session_id;

DEFINE INDEX idx_module_repo ON module FIELDS repo_id;
DEFINE INDEX idx_function_module ON fn_def FIELDS module_id;
DEFINE INDEX idx_function_repo ON fn_def FIELDS repo_id;
DEFINE INDEX idx_class_module ON class FIELDS module_id;

DEFINE INDEX idx_ticket_status ON ticket FIELDS status;
DEFINE INDEX idx_ticket_linked ON ticket FIELDS linked;
DEFINE INDEX idx_skill_active ON skill FIELDS active;
DEFINE INDEX idx_repo_active ON repo FIELDS active;
";
