use serde::Serialize;
use tauri::State;

use super::db_commands::DbState;

#[derive(Debug, Serialize, Clone)]
pub struct ScriptEntry {
    pub path: String,
    pub name: String,
    pub first_seen: String,
    pub last_modified: String,
    pub modification_count: i64,
}

#[tauri::command]
pub fn get_session_scripts(
    state: State<'_, DbState>,
    session_id: String,
) -> Result<Vec<ScriptEntry>, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT
                COALESCE(json_extract(metadata, '$.path'), detail) as file_ref,
                MIN(timestamp) as first_seen,
                MAX(timestamp) as last_modified,
                COUNT(*) as mod_count
             FROM audit_log
             WHERE session_id = ?1
             AND action_type IN ('FILE_CREATE', 'FILE_MODIFY', 'FILE_SAVE', 'FILECREATE', 'FILEMODIFY')
             GROUP BY file_ref
             HAVING file_ref LIKE '%.py'
             ORDER BY first_seen DESC",
        )
        .map_err(|e| format!("Query failed: {}", e))?;

    let scripts = stmt
        .query_map([&session_id], |row| {
            let file_ref: String = row.get(0)?;
            let name = file_ref
                .rsplit(['/', '\\'])
                .next()
                .unwrap_or(&file_ref)
                .to_string();
            let path = if file_ref.starts_with("Saved file: ") {
                file_ref
                    .strip_prefix("Saved file: ")
                    .unwrap_or(&file_ref)
                    .to_string()
            } else if file_ref.starts_with("Creating ") {
                file_ref
                    .strip_prefix("Creating ")
                    .unwrap_or(&file_ref)
                    .to_string()
            } else if file_ref.starts_with("Editing ") {
                file_ref
                    .strip_prefix("Editing ")
                    .unwrap_or(&file_ref)
                    .to_string()
            } else {
                file_ref
            };
            Ok(ScriptEntry {
                path,
                name,
                first_seen: row.get(1)?,
                last_modified: row.get(2)?,
                modification_count: row.get(3)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(scripts)
}

#[tauri::command]
pub fn generate_skill_from_script(
    script_path: String,
) -> Result<super::context_commands::SkillMeta, String> {
    let content = std::fs::read_to_string(&script_path)
        .map_err(|e| format!("Failed to read script: {}", e))?;

    let file_name = std::path::Path::new(&script_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("script")
        .to_string();

    let category = detect_category(&content);

    let skill_name = format!("{} Patterns", title_case(&file_name));
    let skill_content = format!(
        "# {}\n\n**Category:** {}\n\n> Auto-generated from session script: {}\n\n## Source Code\n\n```python\n{}\n```\n\n## Usage\n\nLoad this skill to provide context about patterns from {}.\n",
        skill_name, category, script_path, content, file_name
    );

    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let skills_dir = home.join(".vibe-os").join("skills");
    std::fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to create skills dir: {}", e))?;

    let skill_filename = format!(
        "{}-patterns.md",
        file_name.to_lowercase().replace(' ', "-")
    );
    let skill_path = skills_dir.join(&skill_filename);
    std::fs::write(&skill_path, &skill_content)
        .map_err(|e| format!("Failed to write skill file: {}", e))?;

    let tokens = (skill_content.len() as f64 / 3.5).round() as usize;
    let skill_path_str = skill_path.to_string_lossy().to_string();
    let id = format!("skill-{}", uuid::Uuid::new_v4());

    Ok(super::context_commands::SkillMeta {
        id,
        label: skill_name,
        category,
        tokens,
        file_path: skill_path_str,
        source: "global".to_string(),
    })
}

fn detect_category(content: &str) -> String {
    if content.contains("import pandas")
        || content.contains("import numpy")
        || content.contains("import polars")
        || content.contains("from pandas")
        || content.contains("from numpy")
    {
        "data".to_string()
    } else if content.contains("import sklearn")
        || content.contains("import torch")
        || content.contains("import tensorflow")
        || content.contains("import xgboost")
        || content.contains("from sklearn")
    {
        "ml".to_string()
    } else if content.contains("import fastapi")
        || content.contains("import flask")
        || content.contains("import django")
        || content.contains("from fastapi")
    {
        "web".to_string()
    } else if content.contains("import matplotlib")
        || content.contains("import seaborn")
        || content.contains("import plotly")
        || content.contains("from matplotlib")
    {
        "viz".to_string()
    } else {
        "core".to_string()
    }
}

fn title_case(s: &str) -> String {
    s.split(['_', '-', ' '])
        .filter(|w| !w.is_empty())
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}
