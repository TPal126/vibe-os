use chrono::Utc;
use serde::{Deserialize, Serialize};

// ── Agent Event Types ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgentEventType {
    Think,
    Decision,
    FileCreate,
    FileModify,
    TestRun,
    PreviewUpdate,
    Error,
    Result,
    Raw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentEvent {
    pub timestamp: String,
    pub event_type: AgentEventType,
    pub content: String,
    pub metadata: Option<serde_json::Value>,
}

// ── Stream JSON Event Structures ──
// These mirror Claude Code CLI's --output-format stream-json output

#[derive(Debug, Deserialize)]
struct StreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    subtype: Option<String>,
    content_block: Option<ContentBlock>,
    result: Option<String>,
    session_id: Option<String>,
    cost_usd: Option<f64>,
    duration_ms: Option<u64>,
    is_error: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: Option<String>,
    name: Option<String>,
    input: Option<serde_json::Value>,
}

// ── Parser ──

/// Parse a single line of Claude CLI stream-json output into an AgentEvent.
/// Returns an AgentEvent for every line -- unparseable lines become Raw events (graceful degradation).
pub fn parse_event(line: &str) -> AgentEvent {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return make_event(AgentEventType::Raw, String::new(), None);
    }

    // Try JSON parse first
    match serde_json::from_str::<StreamEvent>(trimmed) {
        Ok(evt) => classify_event(evt),
        Err(_) => {
            // Fallback: raw text event (graceful degradation)
            make_event(AgentEventType::Raw, trimmed.to_string(), None)
        }
    }
}

fn classify_event(evt: StreamEvent) -> AgentEvent {
    match evt.event_type.as_str() {
        "assistant" => classify_assistant_event(evt),
        "result" => {
            let is_err = evt.is_error.unwrap_or(false);
            let content = evt.result.unwrap_or_default();
            let metadata = serde_json::json!({
                "session_id": evt.session_id,
                "cost_usd": evt.cost_usd,
                "duration_ms": evt.duration_ms,
            });
            if is_err {
                make_event(AgentEventType::Error, content, Some(metadata))
            } else {
                make_event(AgentEventType::Result, content, Some(metadata))
            }
        }
        _ => make_event(AgentEventType::Raw, format!("{:?}", evt.event_type), None),
    }
}

fn classify_assistant_event(evt: StreamEvent) -> AgentEvent {
    let subtype = evt.subtype.as_deref().unwrap_or("");

    match subtype {
        "text" => {
            let text = evt
                .content_block
                .and_then(|cb| cb.text)
                .unwrap_or_default();
            make_event(AgentEventType::Think, text, None)
        }
        "tool_use" => {
            if let Some(cb) = evt.content_block {
                classify_tool_use(cb)
            } else {
                make_event(AgentEventType::Raw, "tool_use (no content)".into(), None)
            }
        }
        _ => {
            let text = evt
                .content_block
                .and_then(|cb| cb.text.or(cb.name))
                .unwrap_or_else(|| subtype.to_string());
            make_event(AgentEventType::Think, text, None)
        }
    }
}

fn classify_tool_use(cb: ContentBlock) -> AgentEvent {
    let tool_name = cb.name.as_deref().unwrap_or("");
    let input = cb.input.clone();

    match tool_name {
        "Write" => {
            let path = input
                .as_ref()
                .and_then(|v| v.get("file_path"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            make_event(
                AgentEventType::FileCreate,
                format!("Creating {}", path),
                Some(serde_json::json!({ "tool": tool_name, "path": path })),
            )
        }
        "Edit" => {
            let path = input
                .as_ref()
                .and_then(|v| v.get("file_path"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            make_event(
                AgentEventType::FileModify,
                format!("Editing {}", path),
                Some(serde_json::json!({ "tool": tool_name, "path": path })),
            )
        }
        "Bash" => {
            let cmd = input
                .as_ref()
                .and_then(|v| v.get("command"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let is_test = cmd.contains("test")
                || cmd.contains("pytest")
                || cmd.contains("cargo test")
                || cmd.contains("npm test")
                || cmd.contains("jest")
                || cmd.contains("vitest");
            if is_test {
                make_event(
                    AgentEventType::TestRun,
                    format!("Running: {}", truncate(cmd, 80)),
                    Some(serde_json::json!({ "tool": tool_name, "command": cmd })),
                )
            } else {
                make_event(
                    AgentEventType::Think,
                    format!("Executing: {}", truncate(cmd, 80)),
                    Some(serde_json::json!({ "tool": tool_name, "command": cmd })),
                )
            }
        }
        "Read" | "Glob" | "Grep" => {
            let detail = input
                .as_ref()
                .and_then(|v| v.get("file_path").or(v.get("pattern")))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            make_event(
                AgentEventType::Think,
                format!("{}: {}", tool_name, truncate(detail, 60)),
                Some(serde_json::json!({ "tool": tool_name })),
            )
        }
        _ => make_event(
            AgentEventType::Think,
            format!("Using tool: {}", tool_name),
            Some(serde_json::json!({ "tool": tool_name })),
        ),
    }
}

fn make_event(
    event_type: AgentEventType,
    content: String,
    metadata: Option<serde_json::Value>,
) -> AgentEvent {
    AgentEvent {
        timestamp: Utc::now().to_rfc3339(),
        event_type,
        content,
        metadata,
    }
}

fn truncate(s: &str, max: usize) -> &str {
    if s.len() <= max {
        s
    } else {
        &s[..max]
    }
}
