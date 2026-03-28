use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri_plugin_shell::ShellExt;

// ── Skill Discovery ──

#[derive(Serialize, Clone)]
pub struct SkillMeta {
    pub id: String,
    pub label: String,
    pub category: String,
    pub tokens: usize,
    pub file_path: String,
    pub source: String, // "global" or "project"
}

/// Discover skill .md files from global (~/.vibe-os/skills/) and
/// project-local ({repo}/.vibe/skills/) directories.
#[tauri::command]
pub fn discover_skills(active_repo_paths: Vec<String>) -> Result<Vec<SkillMeta>, String> {
    let mut skills = Vec::new();

    // 1. Global skills: ~/.vibe-os/skills/
    if let Some(home) = dirs::home_dir() {
        let global_dir = home.join(".vibe-os").join("skills");
        if global_dir.exists() {
            discover_from_dir(&global_dir, "global", &mut skills)?;
        }
    }

    // 2. Project-local skills: {repo}/.vibe/skills/
    for repo_path in active_repo_paths {
        let local_dir = PathBuf::from(&repo_path).join(".vibe").join("skills");
        if local_dir.exists() {
            discover_from_dir(&local_dir, "project", &mut skills)?;
        }
    }

    Ok(skills)
}

fn discover_from_dir(
    dir: &PathBuf,
    source: &str,
    skills: &mut Vec<SkillMeta>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read dir {}: {}", dir.display(), e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "md") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

            let label = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .replace('-', " ")
                .replace('_', " ");

            let category = extract_category(&content);
            let tokens = (content.len() as f64 / 3.5).round() as usize;

            skills.push(SkillMeta {
                id: format!(
                    "{}:{}",
                    source,
                    path.file_stem().unwrap_or_default().to_string_lossy()
                ),
                label: title_case(&label),
                category,
                tokens,
                file_path: path.to_string_lossy().to_string(),
                source: source.to_string(),
            });
        }
    }
    Ok(())
}

fn extract_category(content: &str) -> String {
    for line in content.lines().take(10) {
        let lower = line.to_lowercase();
        for cat in ["data", "ml", "core", "web", "infra", "viz"] {
            if lower.contains(&format!("category: {}", cat))
                || lower.contains(&format!("category:{}", cat))
            {
                return cat.to_string();
            }
        }
    }
    "core".to_string()
}

fn title_case(s: &str) -> String {
    s.split_whitespace()
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().to_string() + &c.as_str().to_lowercase(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

// ── Repo Management ──

#[derive(Serialize, Clone)]
pub struct RepoMeta {
    pub id: String,
    pub name: String,
    pub org: String,
    pub branch: String,
    pub local_path: String,
    pub file_count: usize,
    pub language: String,
}

/// Clone a git repository to ~/.vibe-os/repos/{name} and return metadata.
/// Uses --depth 1 for shallow clone (fast).
#[tauri::command]
pub async fn clone_repo(app: tauri::AppHandle, git_url: String) -> Result<RepoMeta, String> {
    let (org, name) = parse_git_url(&git_url)?;

    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let repos_dir = home.join(".vibe-os").join("repos");
    fs::create_dir_all(&repos_dir)
        .map_err(|e| format!("Failed to create repos dir: {}", e))?;

    let dest = repos_dir.join(&name);
    if dest.exists() {
        return Err(format!(
            "Repository '{}' already cloned at {}",
            name,
            dest.display()
        ));
    }

    // Clone via shell plugin -- scope name must be "git"
    let output = app
        .shell()
        .command("git")
        .args(["clone", "--depth", "1", &git_url, &dest.to_string_lossy()])
        .output()
        .await
        .map_err(|e| format!("Git clone failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git clone failed: {}", stderr));
    }

    // Get branch name
    let branch_output = app
        .shell()
        .command("git")
        .args([
            "-C",
            &dest.to_string_lossy(),
            "rev-parse",
            "--abbrev-ref",
            "HEAD",
        ])
        .output()
        .await;
    let branch = branch_output
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "main".to_string());

    let file_count = count_files(&dest);
    let language = detect_language(&dest);

    // Use deterministic ID based on local path so IDs are stable across restarts
    let local_path_str = dest.to_string_lossy().to_string();
    let id = format!("repo:{}", local_path_str.replace(['/', '\\', ':'], "-"));

    Ok(RepoMeta {
        id,
        name,
        org,
        branch,
        local_path: local_path_str,
        file_count,
        language,
    })
}

/// List all cloned repos from ~/.vibe-os/repos/ directory.
#[tauri::command]
pub fn get_repos() -> Result<Vec<RepoMeta>, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let repos_dir = home.join(".vibe-os").join("repos");

    if !repos_dir.exists() {
        return Ok(Vec::new());
    }

    let mut repos = Vec::new();
    let entries = fs::read_dir(&repos_dir)
        .map_err(|e| format!("Failed to read repos dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() && path.join(".git").exists() {
            let name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let org = read_git_remote_org(&path).unwrap_or_else(|| "local".to_string());
            let branch = read_git_branch(&path).unwrap_or_else(|| "main".to_string());
            let file_count = count_files(&path);
            let language = detect_language(&path);

            // Use a deterministic ID based on local_path so IDs are stable across app restarts.
            // This ensures session-linked active_repos IDs match after reload.
            let local_path_str = path.to_string_lossy().to_string();
            let id = format!("repo:{}", local_path_str.replace(['/', '\\', ':'], "-"));

            repos.push(RepoMeta {
                id,
                name,
                org,
                branch,
                local_path: local_path_str,
                file_count,
                language,
            });
        }
    }
    Ok(repos)
}

/// Walk a repo directory and return a summary for prompt injection.
/// Counts Python files, extracts module names.
#[tauri::command]
pub fn index_repo(repo_path: String) -> Result<String, String> {
    let path = PathBuf::from(&repo_path);
    if !path.exists() {
        return Err(format!("Repo path does not exist: {}", repo_path));
    }

    let mut summary_parts: Vec<String> = Vec::new();
    let mut py_files: Vec<String> = Vec::new();

    for entry in walkdir::WalkDir::new(&path)
        .max_depth(4)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let ep = entry.path();
        // Skip .git, __pycache__, node_modules, .venv, venv
        if ep.components().any(|c| {
            let s = c.as_os_str().to_string_lossy();
            s == ".git"
                || s == "__pycache__"
                || s == "node_modules"
                || s == ".venv"
                || s == "venv"
        }) {
            continue;
        }

        if ep.is_file() {
            if let Some(ext) = ep.extension() {
                if ext == "py" {
                    let rel = ep.strip_prefix(&path).unwrap_or(ep);
                    py_files.push(rel.to_string_lossy().to_string());
                }
            }
        }
    }

    if !py_files.is_empty() {
        py_files.sort();
        summary_parts.push(format!("Python files ({}):", py_files.len()));
        for f in &py_files {
            summary_parts.push(format!("  - {}", f));
        }
    }

    let summary = if summary_parts.is_empty() {
        format!(
            "Repository: {} (no Python files found)",
            path.file_name()
                .unwrap_or_default()
                .to_string_lossy()
        )
    } else {
        summary_parts.join("\n")
    };

    Ok(summary)
}

// ── Prompt Composition ──

#[derive(Serialize)]
pub struct ComposedPrompt {
    pub system: String,
    pub task: String,
    pub skills: String,
    pub repo: String,
    pub full: String,
    pub total_tokens: usize,
}

/// Assemble the full prompt deterministically.
/// Order: system -> task -> skills (sorted by path) -> repos (sorted).
#[tauri::command]
pub fn compose_prompt(
    system_prompt: String,
    task_context: String,
    active_skill_paths: Vec<String>,
    active_repo_summaries: Vec<String>,
) -> Result<ComposedPrompt, String> {
    let mut skill_paths = active_skill_paths;
    skill_paths.sort();

    let mut skill_sections = Vec::new();
    for path in &skill_paths {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read skill {}: {}", path, e))?;
        let name = std::path::Path::new(path)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy();
        skill_sections.push(format!("### Skill: {}\n{}", name, content));
    }
    let skills_text = skill_sections.join("\n\n");

    let mut repo_summaries = active_repo_summaries;
    repo_summaries.sort();
    let repo_text = repo_summaries.join("\n\n");

    let full = format!(
        "## System\n{}\n\n## Task\n{}\n\n## Skills\n{}\n\n## Repository Context\n{}",
        system_prompt, task_context, skills_text, repo_text
    );

    let total_tokens = (full.len() as f64 / 3.5).round() as usize;

    Ok(ComposedPrompt {
        system: system_prompt,
        task: task_context,
        skills: skills_text,
        repo: repo_text,
        full,
        total_tokens,
    })
}

// ── Helper Functions ──

fn parse_git_url(url: &str) -> Result<(String, String), String> {
    // Handle HTTPS: https://github.com/org/repo.git
    // Handle SSH: git@github.com:org/repo.git
    let cleaned = url.trim_end_matches(".git").trim_end_matches('/');

    if cleaned.contains("://") {
        // HTTPS format
        let parts: Vec<&str> = cleaned.split('/').collect();
        if parts.len() >= 2 {
            let name = parts[parts.len() - 1].to_string();
            let org = parts[parts.len() - 2].to_string();
            return Ok((org, name));
        }
    } else if cleaned.contains(':') {
        // SSH format: git@github.com:org/repo
        if let Some(path_part) = cleaned.split(':').nth(1) {
            let parts: Vec<&str> = path_part.split('/').collect();
            if parts.len() >= 2 {
                return Ok((parts[0].to_string(), parts[1].to_string()));
            }
        }
    }
    Err(format!("Could not parse git URL: {}", url))
}

fn count_files(dir: &PathBuf) -> usize {
    walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().is_file()
                && !e.path().components().any(|c| {
                    let s = c.as_os_str().to_string_lossy();
                    s == ".git"
                        || s == "node_modules"
                        || s == "__pycache__"
                        || s == ".venv"
                })
        })
        .count()
}

fn detect_language(dir: &PathBuf) -> String {
    let mut py = 0usize;
    let mut js = 0usize;
    let mut ts = 0usize;
    let mut rs = 0usize;

    for entry in walkdir::WalkDir::new(dir)
        .max_depth(3)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.path().is_file() {
            match entry.path().extension().and_then(|e| e.to_str()) {
                Some("py") => py += 1,
                Some("js" | "jsx") => js += 1,
                Some("ts" | "tsx") => ts += 1,
                Some("rs") => rs += 1,
                _ => {}
            }
        }
    }

    let max = *[py, js, ts, rs].iter().max().unwrap_or(&0);
    if max == 0 {
        return "Unknown".to_string();
    }
    if py == max {
        "Python".to_string()
    } else if ts == max {
        "TypeScript".to_string()
    } else if js == max {
        "JavaScript".to_string()
    } else {
        "Rust".to_string()
    }
}

fn read_git_remote_org(repo_path: &PathBuf) -> Option<String> {
    let config_path = repo_path.join(".git").join("config");
    let content = fs::read_to_string(config_path).ok()?;
    // Parse remote "origin" URL from git config
    let mut in_origin = false;
    for line in content.lines() {
        if line.trim() == "[remote \"origin\"]" {
            in_origin = true;
            continue;
        }
        if in_origin && line.trim().starts_with("url = ") {
            let url = line.trim().strip_prefix("url = ")?;
            return parse_git_url(url).ok().map(|(org, _)| org);
        }
        if line.starts_with('[') {
            in_origin = false;
        }
    }
    None
}

fn read_git_branch(repo_path: &PathBuf) -> Option<String> {
    let head_path = repo_path.join(".git").join("HEAD");
    let content = fs::read_to_string(head_path).ok()?;
    // HEAD contains "ref: refs/heads/main" or similar
    content
        .strip_prefix("ref: refs/heads/")
        .map(|s| s.trim().to_string())
}
