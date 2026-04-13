mod test_helpers;
use test_helpers::create_test_db;
use app_lib::commands::project_commands::{create_project_db, delete_project_db};
use app_lib::commands::pipeline_commands::{
    create_pipeline_db, get_pipeline_phases_db, update_pipeline_phases_db,
    CreatePipelineArgs, CreatePhaseArgs,
};

#[test]
fn test_create_pipeline_with_ordered_phases() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "test-project", "/tmp/test", None).unwrap();

    let pipeline = create_pipeline_db(
        &conn,
        &CreatePipelineArgs {
            project_id: project.id.clone(),
            name: "Test Pipeline".into(),
            phases: vec![
                CreatePhaseArgs {
                    label: "Ideation".into(),
                    phase_type: "ideation".into(),
                    backend: "claude".into(),
                    framework: "superpowers".into(),
                    model: "opus".into(),
                    custom_prompt: None,
                    gate_after: "gated".into(),
                },
                CreatePhaseArgs {
                    label: "Planning".into(),
                    phase_type: "planning".into(),
                    backend: "codex".into(),
                    framework: "native".into(),
                    model: "gpt-4.1".into(),
                    custom_prompt: None,
                    gate_after: "auto".into(),
                },
                CreatePhaseArgs {
                    label: "Execution".into(),
                    phase_type: "execution".into(),
                    backend: "claude".into(),
                    framework: "gsd".into(),
                    model: "sonnet".into(),
                    custom_prompt: None,
                    gate_after: "gated".into(),
                },
            ],
        },
    )
    .unwrap();

    let phases = get_pipeline_phases_db(&conn, &pipeline.id).unwrap();
    assert_eq!(phases.len(), 3);
    assert_eq!(phases[0].label, "Ideation");
    assert_eq!(phases[0].position, 0);
    assert_eq!(phases[0].backend, "claude");
    assert_eq!(phases[1].label, "Planning");
    assert_eq!(phases[1].backend, "codex");
    assert_eq!(phases[2].label, "Execution");
    assert_eq!(phases[2].position, 2);
}

#[test]
fn test_delete_project_cascades_via_real_command() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "cascade-test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(
        &conn,
        &CreatePipelineArgs {
            project_id: project.id.clone(),
            name: "Test".into(),
            phases: vec![CreatePhaseArgs {
                label: "Phase 1".into(),
                phase_type: "ideation".into(),
                backend: "claude".into(),
                framework: "native".into(),
                model: "sonnet".into(),
                custom_prompt: None,
                gate_after: "auto".into(),
            }],
        },
    )
    .unwrap();

    // Add run data (direct SQL since run creation goes through the runner)
    let phases = get_pipeline_phases_db(&conn, &pipeline.id).unwrap();
    let run_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO pipeline_run (id, pipeline_id, status, started_at) VALUES (?1, ?2, 'completed', '2026-04-12T00:00:00Z')",
        rusqlite::params![run_id, pipeline.id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO phase_run (id, pipeline_run_id, phase_id, session_id, status, started_at) VALUES (?1, ?2, ?3, 'sess-1', 'completed', '2026-04-12T00:00:00Z')",
        rusqlite::params![uuid::Uuid::new_v4().to_string(), run_id, phases[0].id],
    )
    .unwrap();

    // Call real delete_project_db -- should cascade everything
    delete_project_db(&conn, &project.id).unwrap();

    // Verify complete cleanup
    for table in &[
        "projects",
        "pipeline",
        "pipeline_phase",
        "pipeline_run",
        "phase_run",
    ] {
        let count: i32 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM {}", table),
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            count, 0,
            "Table {} should be empty after cascade delete",
            table
        );
    }
}

#[test]
fn test_update_phases_replaces_all() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "replace-test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(
        &conn,
        &CreatePipelineArgs {
            project_id: project.id.clone(),
            name: "Test".into(),
            phases: vec![
                CreatePhaseArgs {
                    label: "Old Phase 1".into(),
                    phase_type: "ideation".into(),
                    backend: "claude".into(),
                    framework: "native".into(),
                    model: "sonnet".into(),
                    custom_prompt: None,
                    gate_after: "auto".into(),
                },
                CreatePhaseArgs {
                    label: "Old Phase 2".into(),
                    phase_type: "execution".into(),
                    backend: "claude".into(),
                    framework: "native".into(),
                    model: "sonnet".into(),
                    custom_prompt: None,
                    gate_after: "auto".into(),
                },
            ],
        },
    )
    .unwrap();

    // Call real update function
    update_pipeline_phases_db(
        &conn,
        &pipeline.id,
        &[CreatePhaseArgs {
            label: "New Single Phase".into(),
            phase_type: "verification".into(),
            backend: "codex".into(),
            framework: "native".into(),
            model: "gpt-4.1".into(),
            custom_prompt: None,
            gate_after: "gated".into(),
        }],
    )
    .unwrap();

    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM pipeline_phase WHERE pipeline_id = ?1",
            [&pipeline.id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);

    let label: String = conn
        .query_row(
            "SELECT label FROM pipeline_phase WHERE pipeline_id = ?1",
            [&pipeline.id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(label, "New Single Phase");
}
