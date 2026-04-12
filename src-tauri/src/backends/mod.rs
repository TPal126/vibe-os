pub mod claude;
pub mod codex;

#[cfg(any(test, feature = "test-fake"))]
pub mod fake;

use std::collections::HashMap;
use std::process::Child;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::sync::Mutex as TokioMutex;

/// Backend-agnostic arguments for spawning a CLI process.
#[derive(Debug, Clone)]
pub struct SpawnArgs {
    pub working_dir: String,
    pub message: String,
    pub system_prompt: Option<String>,
    pub session_id: String,
    pub model: Option<String>,
    pub framework_context: Option<String>,
    pub resume_id: Option<String>,
}

/// Managed state for active CLI processes across all backends.
pub type AgentProcesses = Arc<TokioMutex<HashMap<String, Child>>>;

/// Info about an installed CLI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliInfo {
    pub name: String,
    pub version: String,
}

/// Trait for CLI backend adapters (Claude, Codex, etc.)
/// Implementations in separate files — added in Plan 2.
pub trait BackendAdapter: Send + Sync {
    fn name(&self) -> &str;
    fn validate(&self) -> Result<CliInfo, String>;
    fn spawn(&self, args: SpawnArgs, app: &AppHandle) -> Result<String, String>;
    fn send_input(&self, session_id: &str, input: &str, app: &AppHandle) -> Result<(), String>;
    fn cancel(&self, session_id: &str, app: &AppHandle) -> Result<(), String>;
    fn supported_models(&self) -> Vec<ModelInfo>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub backend: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkManifest {
    pub id: String,
    pub name: String,
    pub supported_backends: Vec<String>,
    pub supported_phases: Vec<String>,
    pub features: FrameworkFeatures,
    pub phase_skills: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkFeatures {
    pub visual_companion: bool,
    pub interactive_questions: bool,
}

/// Load all framework manifests from the bundled frameworks/ directory.
pub fn load_manifests() -> Vec<FrameworkManifest> {
    let mut manifests = Vec::new();

    let search_dirs = [
        // Runtime: next to executable
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("frameworks"))),
        // Development: relative to Cargo manifest dir
        Some(std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("frameworks")),
    ];

    for dir in search_dirs.iter().flatten() {
        if dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map(|e| e == "json").unwrap_or(false) {
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            if let Ok(manifest) = serde_json::from_str::<FrameworkManifest>(&content) {
                                manifests.push(manifest);
                            }
                        }
                    }
                }
            }
            if !manifests.is_empty() {
                break;
            }
        }
    }

    manifests
}

#[tauri::command]
pub fn list_frameworks() -> Vec<FrameworkManifest> {
    load_manifests()
}
