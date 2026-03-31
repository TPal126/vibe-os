use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentDefinition {
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub tools: Vec<String>,
    pub created_at: String,
    pub source_session_id: String,
}

fn agents_dir() -> PathBuf {
    let home = dirs::home_dir().expect("Cannot determine home directory");
    home.join(".vibe-os").join("agents")
}

#[tauri::command]
pub fn save_agent_definition(
    name: String,
    description: String,
    system_prompt: String,
    tools: Vec<String>,
    source_session_id: String,
) -> Result<AgentDefinition, String> {
    let dir = agents_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let safe_name = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>();
    let file_path = dir.join(format!("{}.md", safe_name));

    let created_at = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let tools_str = tools.join(", ");

    let content = format!(
        "---\nname: {}\ndescription: {}\ntools: [{}]\ncreated: {}\nsource_session: {}\n---\n\n{}",
        name, description, tools_str, created_at, source_session_id, system_prompt
    );

    std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;

    Ok(AgentDefinition {
        name,
        description,
        system_prompt,
        tools,
        created_at,
        source_session_id,
    })
}

#[tauri::command]
pub fn load_agent_definitions() -> Result<Vec<AgentDefinition>, String> {
    let dir = agents_dir();
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut agents = Vec::new();
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().map(|e| e == "md").unwrap_or(false) {
            let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            if let Some(agent) = parse_agent_md(&content) {
                agents.push(agent);
            }
        }
    }

    Ok(agents)
}

#[tauri::command]
pub fn remove_agent_definition(name: String) -> Result<(), String> {
    let safe_name = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>();
    let file_path = agents_dir().join(format!("{}.md", safe_name));
    if file_path.exists() {
        std::fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn parse_agent_md(content: &str) -> Option<AgentDefinition> {
    let content = content.trim();
    if !content.starts_with("---") {
        return None;
    }

    let rest = &content[3..];
    let end = rest.find("---")?;
    let frontmatter = &rest[..end];
    let body = rest[end + 3..].trim().to_string();

    let mut name = String::new();
    let mut description = String::new();
    let mut tools = Vec::new();
    let mut created_at = String::new();
    let mut source_session_id = String::new();

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("name:") {
            name = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("description:") {
            description = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("tools:") {
            let val = val.trim().trim_start_matches('[').trim_end_matches(']');
            tools = val.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        } else if let Some(val) = line.strip_prefix("created:") {
            created_at = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("source_session:") {
            source_session_id = val.trim().to_string();
        }
    }

    if name.is_empty() {
        return None;
    }

    Some(AgentDefinition {
        name,
        description,
        system_prompt: body,
        tools,
        created_at,
        source_session_id,
    })
}
