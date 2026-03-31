use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex as TokioMutex;

// ── Structs ──

#[derive(Serialize, Clone)]
pub struct WorkspaceMeta {
    pub name: String,
    pub path: String,
    pub has_claude_md: bool,
    pub repo_count: usize,
    pub skill_count: usize,
}

#[derive(Serialize, Clone)]
pub struct FileTreeEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileTreeEntry>>,
    pub extension: Option<String>,
}

pub struct WorkspaceWatcherState {
    pub stop_signal: Option<std::sync::mpsc::Sender<()>>,
    pub workspace_path: Option<String>,
}

// ── Commands ──

/// Create a new workspace directory with standard subdirectories and a default CLAUDE.md.
#[tauri::command]
pub fn create_workspace(name: String) -> Result<WorkspaceMeta, String> {
    // Validate name: only alphanumeric, hyphens, underscores
    if name.is_empty() {
        return Err("Workspace name cannot be empty".to_string());
    }
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(
            "Workspace name can only contain letters, numbers, hyphens, and underscores"
                .to_string(),
        );
    }

    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let ws_path = home.join("vibe-workspaces").join(&name);

    if ws_path.exists() {
        return Err(format!(
            "Workspace '{}' already exists at {}",
            name,
            ws_path.display()
        ));
    }

    // Create subdirectories
    for sub in &["docs", "repos", "skills", "data", "output"] {
        fs::create_dir_all(ws_path.join(sub)).map_err(|e| {
            format!(
                "Failed to create {}/{}: {}",
                ws_path.display(),
                sub,
                e
            )
        })?;
    }

    // Write default CLAUDE.md
    let claude_md_content = format!(
        "# {} Workspace\n\n## System Prompt\n\nYou are an AI assistant working in the {} workspace.\n\n## Context\n\nAdd project-specific instructions here.\n",
        name, name
    );
    fs::write(ws_path.join("CLAUDE.md"), &claude_md_content)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;

    Ok(WorkspaceMeta {
        name,
        path: ws_path.to_string_lossy().to_string(),
        has_claude_md: true,
        repo_count: 0,
        skill_count: 0,
    })
}

/// Open an existing workspace directory and return its metadata.
#[tauri::command]
pub fn open_workspace(workspace_path: String) -> Result<WorkspaceMeta, String> {
    let ws_path = PathBuf::from(&workspace_path);

    if !ws_path.exists() || !ws_path.is_dir() {
        return Err(format!(
            "Workspace path does not exist or is not a directory: {}",
            workspace_path
        ));
    }

    let claude_md = ws_path.join("CLAUDE.md");
    if !claude_md.exists() {
        return Err(format!(
            "Not a valid workspace (no CLAUDE.md found): {}",
            workspace_path
        ));
    }

    let name = ws_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Count repos: subdirs in repos/ that contain .git/
    let repos_dir = ws_path.join("repos");
    let repo_count = if repos_dir.exists() {
        fs::read_dir(&repos_dir)
            .map(|entries| {
                entries
                    .flatten()
                    .filter(|e| {
                        let p = e.path();
                        p.is_dir() && p.join(".git").exists()
                    })
                    .count()
            })
            .unwrap_or(0)
    } else {
        0
    };

    // Count skills: .md files in skills/
    let skills_dir = ws_path.join("skills");
    let skill_count = if skills_dir.exists() {
        fs::read_dir(&skills_dir)
            .map(|entries| {
                entries
                    .flatten()
                    .filter(|e| {
                        e.path()
                            .extension()
                            .map_or(false, |ext| ext == "md")
                    })
                    .count()
            })
            .unwrap_or(0)
    } else {
        0
    };

    Ok(WorkspaceMeta {
        name,
        path: ws_path.to_string_lossy().to_string(),
        has_claude_md: true,
        repo_count,
        skill_count,
    })
}

/// Read the workspace file tree up to a configurable depth.
#[tauri::command]
pub fn read_workspace_tree(
    workspace_path: String,
    max_depth: Option<usize>,
) -> Result<Vec<FileTreeEntry>, String> {
    let ws_path = PathBuf::from(&workspace_path);
    if !ws_path.exists() || !ws_path.is_dir() {
        return Err(format!(
            "Workspace path does not exist or is not a directory: {}",
            workspace_path
        ));
    }

    let depth = max_depth.unwrap_or(3);
    read_dir_recursive(&ws_path, depth, 0)
}

fn read_dir_recursive(
    dir: &Path,
    max_depth: usize,
    current_depth: usize,
) -> Result<Vec<FileTreeEntry>, String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    let skip_names: HashSet<&str> = [
        "node_modules",
        "__pycache__",
        ".venv",
        "venv",
        "target",
    ]
    .iter()
    .copied()
    .collect();

    let mut dirs_vec: Vec<FileTreeEntry> = Vec::new();
    let mut files_vec: Vec<FileTreeEntry> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Skip hidden files/dirs (starting with '.')
        if name.starts_with('.') {
            continue;
        }

        // Skip blacklisted directories
        if skip_names.contains(name.as_str()) {
            continue;
        }

        let path_str = path.to_string_lossy().to_string();

        if path.is_dir() {
            let children = if current_depth < max_depth {
                Some(read_dir_recursive(&path, max_depth, current_depth + 1)?)
            } else {
                Some(Vec::new())
            };

            dirs_vec.push(FileTreeEntry {
                name,
                path: path_str,
                is_dir: true,
                children,
                extension: None,
            });
        } else {
            let extension = path
                .extension()
                .map(|e| e.to_string_lossy().to_string());

            files_vec.push(FileTreeEntry {
                name,
                path: path_str,
                is_dir: false,
                children: None,
                extension,
            });
        }
    }

    // Sort: directories first (alphabetical), then files (alphabetical)
    dirs_vec.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files_vec.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    dirs_vec.extend(files_vec);
    Ok(dirs_vec)
}

/// Watch a workspace's CLAUDE.md for changes and emit events when modified.
#[tauri::command]
pub async fn watch_workspace_claude_md(
    app: AppHandle,
    workspace_path: String,
    watcher_state: tauri::State<'_, Arc<TokioMutex<WorkspaceWatcherState>>>,
) -> Result<(), String> {
    let claude_md_path = PathBuf::from(&workspace_path).join("CLAUDE.md");
    if !claude_md_path.exists() {
        return Err(format!(
            "CLAUDE.md not found in workspace: {}",
            workspace_path
        ));
    }

    // Lock state and stop existing watcher if any
    {
        let mut state = watcher_state.lock().await;
        if let Some(sender) = state.stop_signal.take() {
            let _ = sender.send(());
        }
    }

    // Create stop channel
    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();

    // Store sender in state
    {
        let mut state = watcher_state.lock().await;
        state.stop_signal = Some(stop_tx);
        state.workspace_path = Some(workspace_path.clone());
    }

    let watch_path = claude_md_path.clone();
    let app_handle = app.clone();

    tokio::task::spawn_blocking(move || {
        use notify_debouncer_mini::new_debouncer;

        let (tx, rx) = std::sync::mpsc::channel();

        let mut debouncer = match new_debouncer(Duration::from_millis(500), tx) {
            Ok(d) => d,
            Err(e) => {
                log::error!("Failed to create file watcher: {}", e);
                return;
            }
        };

        if let Err(e) = debouncer
            .watcher()
            .watch(&watch_path, notify::RecursiveMode::NonRecursive)
        {
            log::error!("Failed to watch CLAUDE.md: {}", e);
            return;
        }

        loop {
            // Check for stop signal
            match stop_rx.try_recv() {
                Ok(()) | Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                    break;
                }
                Err(std::sync::mpsc::TryRecvError::Empty) => {}
            }

            // Check for file change events
            match rx.recv_timeout(Duration::from_millis(200)) {
                Ok(Ok(_events)) => {
                    // File changed -- read and emit
                    match fs::read_to_string(&watch_path) {
                        Ok(content) => {
                            let _ = app_handle
                                .emit("workspace-claude-md-changed", content);
                        }
                        Err(e) => {
                            log::error!("Failed to read CLAUDE.md: {}", e);
                        }
                    }
                }
                Ok(Err(error)) => {
                    log::error!("Watch error: {}", error);
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // No events, continue loop
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        }
    });

    Ok(())
}

/// Stop the workspace CLAUDE.md file watcher.
#[tauri::command]
pub async fn stop_workspace_watcher(
    watcher_state: tauri::State<'_, Arc<TokioMutex<WorkspaceWatcherState>>>,
) -> Result<(), String> {
    let mut state = watcher_state.lock().await;
    if let Some(sender) = state.stop_signal.take() {
        let _ = sender.send(());
    }
    state.workspace_path = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_workspace_scaffolds_dirs() {
        let name = format!("test_ws_{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
        let meta = create_workspace(name.clone()).unwrap();

        assert!(Path::new(&meta.path).exists());
        assert!(Path::new(&meta.path).join("docs").is_dir());
        assert!(Path::new(&meta.path).join("repos").is_dir());
        assert!(Path::new(&meta.path).join("skills").is_dir());
        assert!(Path::new(&meta.path).join("data").is_dir());
        assert!(Path::new(&meta.path).join("output").is_dir());
        assert!(Path::new(&meta.path).join("CLAUDE.md").is_file());
        assert!(meta.has_claude_md);

        std::fs::remove_dir_all(&meta.path).ok();
    }

    #[test]
    fn test_open_workspace_reads_metadata() {
        let name = format!("test_ws_{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
        let created = create_workspace(name).unwrap();
        let opened = open_workspace(created.path.clone()).unwrap();

        assert_eq!(opened.name, created.name);
        assert!(opened.has_claude_md);
        assert_eq!(opened.repo_count, 0);
        assert_eq!(opened.skill_count, 0);

        std::fs::remove_dir_all(&created.path).ok();
    }

    #[test]
    fn test_create_workspace_rejects_invalid_name() {
        let result = create_workspace("has spaces".to_string());
        assert!(result.is_err());

        let result = create_workspace("".to_string());
        assert!(result.is_err());
    }
}
