use std::path::{Path, PathBuf};
use std::fs;

/// Manages artifact storage and context handoff between pipeline phases.
pub struct ArtifactStore {
    base_dir: PathBuf, // ~/.vibe-os/artifacts/
}

impl ArtifactStore {
    pub fn new(app_data_dir: &Path) -> Self {
        let base_dir = app_data_dir.join("artifacts");
        Self { base_dir }
    }

    /// Get the artifact directory for a pipeline run.
    pub fn run_dir(&self, pipeline_run_id: &str) -> PathBuf {
        self.base_dir.join(pipeline_run_id)
    }

    /// Store an artifact file for a phase.
    pub fn store_artifact(
        &self,
        pipeline_run_id: &str,
        phase_type: &str,
        content: &str,
    ) -> Result<PathBuf, String> {
        let dir = self.run_dir(pipeline_run_id);
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create artifact dir: {}", e))?;

        let filename = match phase_type {
            "ideation" => "spec.md",
            "planning" => "plan.md",
            "execution" => "diff-summary.md",
            "verification" => "verification-report.md",
            "review" => "review-notes.md",
            _ => "output.md",
        };

        let path = dir.join(filename);
        fs::write(&path, content)
            .map_err(|e| format!("Failed to write artifact: {}", e))?;

        Ok(path)
    }

    /// Load an artifact's content.
    pub fn load_artifact(&self, path: &Path) -> Result<String, String> {
        fs::read_to_string(path)
            .map_err(|e| format!("Failed to read artifact: {}", e))
    }

    /// Build the framework_context string for the next phase.
    pub fn build_handoff_context(
        &self,
        project_goal: &str,
        previous_phase_label: &str,
        previous_phase_config: &str,
        summary: &str,
        artifact_path: Option<&Path>,
    ) -> String {
        let mut context = format!(
            "[Project Goal]: {}\n[Previous Phase]: {} ({})\n[Summary]: {}\n",
            project_goal, previous_phase_label, previous_phase_config, summary,
        );

        if let Some(path) = artifact_path {
            if let Ok(content) = self.load_artifact(path) {
                context.push_str(&format!("[Artifact]:\n{}\n", content));
            }
        }

        context
    }
}
