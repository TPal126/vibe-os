mod test_helpers;
use test_helpers::create_test_db;
use app_lib::workflow::runner::WorkflowEngine;
use app_lib::commands::project_commands::create_project_db;
use app_lib::commands::pipeline_commands::{create_pipeline_db, CreatePipelineArgs, CreatePhaseArgs};

/// Noop factory: returns Ok(session_id) for any backend, simulating successful spawn.
fn noop_factory() -> Box<dyn Fn(&str, &app_lib::backends::SpawnArgs) -> Result<String, String> + Send + Sync> {
    Box::new(|_backend, args| Ok(args.session_id.clone()))
}

/// Helper: create a project + pipeline with the given phases.
fn setup_pipeline(conn: &rusqlite::Connection, phases: Vec<CreatePhaseArgs>) -> String {
    let project = create_project_db(conn, "test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(
        conn,
        &CreatePipelineArgs {
            project_id: project.id.clone(),
            name: "Test".into(),
            phases,
        },
    )
    .unwrap();
    pipeline.id
}

fn make_phase(label: &str, gate_after: &str) -> CreatePhaseArgs {
    CreatePhaseArgs {
        label: label.into(),
        phase_type: "ideation".into(),
        backend: "claude".into(),
        framework: "native".into(),
        model: "sonnet".into(),
        custom_prompt: None,
        gate_after: gate_after.into(),
    }
}

#[test]
fn test_start_pipeline_creates_run_and_first_phase() {
    let conn = create_test_db();
    let pipeline_id = setup_pipeline(
        &conn,
        vec![make_phase("Ideation", "auto"), make_phase("Execution", "gated")],
    );

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline_id).unwrap();

    // Verify pipeline_run created
    let status: String = conn
        .query_row(
            "SELECT status FROM pipeline_run WHERE id = ?1",
            [&run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(status, "running");

    // Verify first phase_run created
    let phase_status: String = conn
        .query_row(
            "SELECT status FROM phase_run WHERE pipeline_run_id = ?1",
            [&run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(phase_status, "running");
}

#[test]
fn test_on_phase_complete_auto_advances() {
    let conn = create_test_db();
    let pipeline_id = setup_pipeline(
        &conn,
        vec![make_phase("Phase 1", "auto"), make_phase("Phase 2", "auto")],
    );

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline_id).unwrap();

    // Find the running phase_run
    let phase_run_id: String = conn
        .query_row(
            "SELECT id FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
            [&run_id],
            |r| r.get(0),
        )
        .unwrap();

    // Complete it
    engine.on_phase_complete(&run_id, &phase_run_id).unwrap();

    // Phase 1 should be completed
    let p1_status: String = conn
        .query_row(
            "SELECT status FROM phase_run WHERE id = ?1",
            [&phase_run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(p1_status, "completed");

    // Phase 2 should be running (auto-advanced)
    let p2_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
            [&run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(p2_count, 1);
}

#[test]
fn test_on_phase_complete_gated_stops() {
    let conn = create_test_db();
    let pipeline_id = setup_pipeline(
        &conn,
        vec![make_phase("Phase 1", "gated"), make_phase("Phase 2", "auto")],
    );

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline_id).unwrap();

    let phase_run_id: String = conn
        .query_row(
            "SELECT id FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
            [&run_id],
            |r| r.get(0),
        )
        .unwrap();

    engine.on_phase_complete(&run_id, &phase_run_id).unwrap();

    // Phase 1 should be awaiting_gate
    let p1_status: String = conn
        .query_row(
            "SELECT status FROM phase_run WHERE id = ?1",
            [&phase_run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(p1_status, "awaiting_gate");

    // No Phase 2 running yet
    let running: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
            [&run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(running, 0);
}

#[test]
fn test_advance_gate_starts_next_phase() {
    let conn = create_test_db();
    let pipeline_id = setup_pipeline(
        &conn,
        vec![make_phase("Phase 1", "gated"), make_phase("Phase 2", "auto")],
    );

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline_id).unwrap();

    let pr_id: String = conn
        .query_row(
            "SELECT id FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
            [&run_id],
            |r| r.get(0),
        )
        .unwrap();

    // Complete -> awaiting_gate
    engine.on_phase_complete(&run_id, &pr_id).unwrap();

    // Advance gate
    engine.advance_gate(&run_id).unwrap();

    // Phase 2 should now be running
    let running_label: String = conn
        .query_row(
            "SELECT pp.label FROM phase_run pr \
             JOIN pipeline_phase pp ON pr.phase_id = pp.id \
             WHERE pr.pipeline_run_id = ?1 AND pr.status = 'running'",
            [&run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(running_label, "Phase 2");
}

#[test]
fn test_final_phase_completes_pipeline() {
    let conn = create_test_db();
    let pipeline_id = setup_pipeline(&conn, vec![make_phase("Only Phase", "auto")]);

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline_id).unwrap();

    let pr_id: String = conn
        .query_row(
            "SELECT id FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
            [&run_id],
            |r| r.get(0),
        )
        .unwrap();

    engine.on_phase_complete(&run_id, &pr_id).unwrap();

    let run_status: String = conn
        .query_row(
            "SELECT status FROM pipeline_run WHERE id = ?1",
            [&run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(run_status, "completed");
}

#[test]
fn test_get_run_status_returns_phases() {
    let conn = create_test_db();
    let pipeline_id = setup_pipeline(
        &conn,
        vec![make_phase("Phase 1", "auto"), make_phase("Phase 2", "auto")],
    );

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline_id).unwrap();

    let status = engine.get_run_status(&run_id).unwrap();
    assert_eq!(status.status, "running");
    assert!(status.current_phase.is_some());
    assert_eq!(status.current_phase.unwrap().label, "Phase 1");
}

#[test]
fn test_unknown_backend_fails_phase() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(
        &conn,
        &CreatePipelineArgs {
            project_id: project.id.clone(),
            name: "Test".into(),
            phases: vec![CreatePhaseArgs {
                label: "Bad Phase".into(),
                phase_type: "ideation".into(),
                backend: "nonexistent".into(),
                framework: "native".into(),
                model: "x".into(),
                custom_prompt: None,
                gate_after: "auto".into(),
            }],
        },
    )
    .unwrap();

    // Factory that rejects unknown backends
    let strict_factory: Box<
        dyn Fn(&str, &app_lib::backends::SpawnArgs) -> Result<String, String> + Send + Sync,
    > = Box::new(|backend, _args| Err(format!("Unknown backend: {}", backend)));

    let engine = WorkflowEngine::for_test(&conn, strict_factory);

    // start_pipeline will propagate the spawn error, but the phase_run row
    // was already inserted and then updated to "failed" before the error returns.
    let result = engine.start_pipeline(&pipeline.id);
    assert!(
        result.is_err(),
        "start_pipeline should fail when backend rejects"
    );

    // Phase should be marked failed in the DB
    let phase_status: String = conn
        .query_row(
            "SELECT status FROM phase_run WHERE pipeline_run_id IN (SELECT id FROM pipeline_run WHERE pipeline_id = ?1)",
            [&pipeline.id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(phase_status, "failed");
}
