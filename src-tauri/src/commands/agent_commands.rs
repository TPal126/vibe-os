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
    // Claude Code-compatible fields:
    pub model: Option<String>,
    pub permission_mode: Option<String>,
    pub disallowed_tools: Vec<String>,
    pub max_turns: Option<u32>,
    pub background: bool,
    pub isolation: Option<String>,
    pub memory: Option<String>,
    pub skills: Vec<String>,
    pub color: Option<String>,
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
    model: Option<String>,
    permission_mode: Option<String>,
    disallowed_tools: Option<Vec<String>>,
    max_turns: Option<u32>,
    background: Option<bool>,
    isolation: Option<String>,
    memory: Option<String>,
    skills: Option<Vec<String>>,
    color: Option<String>,
    workspace_path: Option<String>,
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
    let disallowed_tools = disallowed_tools.unwrap_or_default();
    let background = background.unwrap_or(false);
    let skills = skills.unwrap_or_default();

    let mut frontmatter = format!(
        "---\nname: {}\ndescription: {}\ntools: [{}]\ncreated: {}\nsource_session: {}",
        name, description, tools_str, created_at, source_session_id
    );

    if let Some(ref m) = model {
        frontmatter.push_str(&format!("\nmodel: {}", m));
    }
    if let Some(ref pm) = permission_mode {
        frontmatter.push_str(&format!("\npermissionMode: {}", pm));
    }
    if !disallowed_tools.is_empty() {
        frontmatter.push_str(&format!("\ndisallowedTools: [{}]", disallowed_tools.join(", ")));
    }
    if let Some(mt) = max_turns {
        frontmatter.push_str(&format!("\nmaxTurns: {}", mt));
    }
    if background {
        frontmatter.push_str("\nbackground: true");
    }
    if let Some(ref iso) = isolation {
        frontmatter.push_str(&format!("\nisolation: {}", iso));
    }
    if let Some(ref mem) = memory {
        frontmatter.push_str(&format!("\nmemory: {}", mem));
    }
    if !skills.is_empty() {
        frontmatter.push_str(&format!("\nskills: [{}]", skills.join(", ")));
    }
    if let Some(ref c) = color {
        frontmatter.push_str(&format!("\ncolor: {}", c));
    }

    frontmatter.push_str("\n---");

    let content = format!("{}\n\n{}", frontmatter, system_prompt);

    // Write to ~/.vibe-os/agents/ (global)
    std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;

    // Dual-write to {workspace_path}/.claude/agents/ if workspace is provided
    if let Some(ref ws_path) = workspace_path {
        let ws_agent_dir = PathBuf::from(ws_path).join(".claude").join("agents");
        std::fs::create_dir_all(&ws_agent_dir).map_err(|e| e.to_string())?;
        let ws_file_path = ws_agent_dir.join(format!("{}.md", safe_name));
        std::fs::write(&ws_file_path, &content).map_err(|e| e.to_string())?;
    }

    Ok(AgentDefinition {
        name,
        description,
        system_prompt,
        tools,
        created_at,
        source_session_id,
        model,
        permission_mode,
        disallowed_tools,
        max_turns,
        background,
        isolation,
        memory,
        skills,
        color,
    })
}

#[tauri::command]
pub fn get_workspace_agent_dir(workspace_path: String) -> Result<String, String> {
    let agent_dir = PathBuf::from(&workspace_path).join(".claude").join("agents");
    Ok(agent_dir.to_string_lossy().to_string())
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

fn parse_bracket_list(val: &str) -> Vec<String> {
    let val = val.trim().trim_start_matches('[').trim_end_matches(']');
    val.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
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
    let mut model = None;
    let mut permission_mode = None;
    let mut disallowed_tools = Vec::new();
    let mut max_turns = None;
    let mut background = false;
    let mut isolation = None;
    let mut memory = None;
    let mut skills = Vec::new();
    let mut color = None;

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("name:") {
            name = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("description:") {
            description = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("tools:") {
            tools = parse_bracket_list(val);
        } else if let Some(val) = line.strip_prefix("created:") {
            created_at = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("source_session:") {
            source_session_id = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("model:") {
            let v = val.trim().to_string();
            if !v.is_empty() { model = Some(v); }
        } else if let Some(val) = line.strip_prefix("permissionMode:") {
            let v = val.trim().to_string();
            if !v.is_empty() { permission_mode = Some(v); }
        } else if let Some(val) = line.strip_prefix("disallowedTools:") {
            disallowed_tools = parse_bracket_list(val);
        } else if let Some(val) = line.strip_prefix("maxTurns:") {
            max_turns = val.trim().parse::<u32>().ok();
        } else if let Some(val) = line.strip_prefix("background:") {
            background = val.trim() == "true";
        } else if let Some(val) = line.strip_prefix("isolation:") {
            let v = val.trim().to_string();
            if !v.is_empty() { isolation = Some(v); }
        } else if let Some(val) = line.strip_prefix("memory:") {
            let v = val.trim().to_string();
            if !v.is_empty() { memory = Some(v); }
        } else if let Some(val) = line.strip_prefix("skills:") {
            skills = parse_bracket_list(val);
        } else if let Some(val) = line.strip_prefix("color:") {
            let v = val.trim().to_string();
            if !v.is_empty() { color = Some(v); }
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
        model,
        permission_mode,
        disallowed_tools,
        max_turns,
        background,
        isolation,
        memory,
        skills,
        color,
    })
}
