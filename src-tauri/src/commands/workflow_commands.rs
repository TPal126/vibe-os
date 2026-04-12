use tauri::AppHandle;
use crate::workflow::runner::WorkflowRunner;

/// Start executing a pipeline. Returns the pipeline_run_id.
#[tauri::command]
pub async fn start_pipeline(app: AppHandle, pipeline_id: String) -> Result<String, String> {
    let runner = WorkflowRunner::new(app);
    runner.start_pipeline(&pipeline_id).await
}

/// User confirms a gate — advance to the next phase.
#[tauri::command]
pub async fn advance_gate(app: AppHandle, pipeline_run_id: String) -> Result<(), String> {
    let runner = WorkflowRunner::new(app);
    runner.advance_gate(&pipeline_run_id).await
}

/// Get the current status of a pipeline run.
#[tauri::command]
pub async fn get_pipeline_run_status(
    app: AppHandle,
    pipeline_run_id: String,
) -> Result<crate::workflow::runner::PipelineRunStatus, String> {
    let runner = WorkflowRunner::new(app);
    runner.get_run_status(&pipeline_run_id).await
}
