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
    // Workflow engine events
    InteractionRequest,
    VisualContent,
    ArtifactProduced,
    PhaseTransition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentEvent {
    pub timestamp: String,
    pub event_type: AgentEventType,
    pub content: String,
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_session_id: Option<String>,
}

impl AgentEvent {
    /// Tag this event with a session ID for frontend routing.
    pub fn with_session_id(mut self, id: &str) -> Self {
        self.agent_session_id = Some(id.to_string());
        self
    }
}

// ── Stream JSON Event Structures ──
// These mirror Claude Code CLI's --output-format stream-json --verbose output

#[derive(Debug, Deserialize)]
struct StreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    subtype: Option<String>,
    // Used by older/non-verbose format
    content_block: Option<ContentBlock>,
    // Used by the actual verbose format: {"type":"assistant","message":{...}}
    message: Option<AssistantMessage>,
    // Used by result events
    result: Option<String>,
    session_id: Option<String>,
    cost_usd: Option<f64>,
    total_cost_usd: Option<f64>,
    duration_ms: Option<u64>,
    duration_api_ms: Option<u64>,
    is_error: Option<bool>,
    // Token usage from result events
    usage: Option<UsageData>,
}

#[derive(Debug, Deserialize)]
struct UsageData {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    cache_creation_input_tokens: Option<u64>,
    cache_read_input_tokens: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct AssistantMessage {
    content: Option<Vec<ContentPart>>,
    #[serde(default)]
    stop_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ContentPart {
    #[serde(rename = "type")]
    part_type: String,
    text: Option<String>,
    // tool_use fields
    name: Option<String>,
    id: Option<String>,
    input: Option<serde_json::Value>,
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
/// Returns an AgentEvent for every line -- unparseable lines become Raw events.
pub fn parse_event(line: &str) -> AgentEvent {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return make_event(AgentEventType::Raw, String::new(), None);
    }

    match serde_json::from_str::<StreamEvent>(trimmed) {
        Ok(evt) => classify_event(evt),
        Err(_) => make_event(AgentEventType::Raw, trimmed.to_string(), None),
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
                "cost_usd": evt.total_cost_usd.or(evt.cost_usd),
                "duration_ms": evt.duration_ms,
                "duration_api_ms": evt.duration_api_ms,
                "input_tokens": evt.usage.as_ref().and_then(|u| u.input_tokens),
                "output_tokens": evt.usage.as_ref().and_then(|u| u.output_tokens),
                "cache_creation_input_tokens": evt.usage.as_ref().and_then(|u| u.cache_creation_input_tokens),
                "cache_read_input_tokens": evt.usage.as_ref().and_then(|u| u.cache_read_input_tokens),
            });
            if is_err {
                make_event(AgentEventType::Error, content, Some(metadata))
            } else {
                make_event(AgentEventType::Result, content, Some(metadata))
            }
        }
        "system" | "rate_limit_event" => {
            // System/rate-limit events are informational, emit as Raw
            make_event(AgentEventType::Raw, String::new(), None)
        }
        _ => make_event(
            AgentEventType::Raw,
            format!("unknown event: {}", evt.event_type),
            None,
        ),
    }
}

fn classify_assistant_event(evt: StreamEvent) -> AgentEvent {
    // New verbose format: {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
    if let Some(message) = evt.message {
        if let Some(parts) = message.content {
            let mut text_parts = Vec::new();
            let mut tool_events = Vec::new();

            for part in parts {
                match part.part_type.as_str() {
                    "text" => {
                        if let Some(text) = part.text {
                            if !text.is_empty() {
                                text_parts.push(text);
                            }
                        }
                    }
                    "tool_use" => {
                        tool_events.push(classify_tool_use_part(&part));
                    }
                    _ => {}
                }
            }

            // If there's text content, emit it as a Think event (assistant text)
            if !text_parts.is_empty() {
                let combined = text_parts.join("");
                return make_event(AgentEventType::Think, combined, None);
            }

            // If there are tool events, return the first one
            // (multiple tool uses in one message are rare)
            if let Some(tool_event) = tool_events.into_iter().next() {
                return tool_event;
            }
        }

        return make_event(AgentEventType::Raw, String::new(), None);
    }

    // Legacy format: {"type":"assistant","subtype":"text","content_block":{"type":"text","text":"..."}}
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
                classify_tool_use_block(cb)
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

fn classify_tool_use_part(part: &ContentPart) -> AgentEvent {
    let tool_name = part.name.as_deref().unwrap_or("");
    let input = part.input.as_ref();

    match tool_name {
        "Write" => {
            let path = input
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
                .and_then(|v| v.get("command"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let is_test = cmd.contains("test")
                || cmd.contains("pytest")
                || cmd.contains("cargo test")
                || cmd.contains("npm test");
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

fn classify_tool_use_block(cb: ContentBlock) -> AgentEvent {
    let tool_name = cb.name.as_deref().unwrap_or("");
    let input = cb.input.as_ref();

    match tool_name {
        "Write" => {
            let path = input
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
                .and_then(|v| v.get("command"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let is_test = cmd.contains("test")
                || cmd.contains("pytest")
                || cmd.contains("cargo test")
                || cmd.contains("npm test");
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
        agent_session_id: None,
    }
}

fn truncate(s: &str, max: usize) -> &str {
    if s.len() <= max {
        s
    } else {
        &s[..max]
    }
}

// ── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Real CLI fixtures (captured from `claude -p --output-format stream-json --verbose`) ──

    const REAL_ASSISTANT_TEXT: &str = r#"{"type":"assistant","message":{"model":"claude-opus-4-6","id":"msg_01ARNUgBxiC6tBdsGvCZaMR9","type":"message","role":"assistant","content":[{"type":"text","text":"\n\n4"}],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":2,"cache_creation_input_tokens":5175,"cache_read_input_tokens":12144,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":5175},"output_tokens":2,"service_tier":"standard","inference_geo":"not_available"},"context_management":null},"parent_tool_use_id":null,"session_id":"2aad29f2-b826-4ebb-bae4-51c1cdbbd275","uuid":"64f50500-aa9c-42a6-a8f7-3b66390b1f2e"}"#;

    const REAL_ASSISTANT_HELLO: &str = r#"{"type":"assistant","message":{"model":"claude-opus-4-6","id":"msg_01UrFUjXnWjoo8MAMLRaJfcF","type":"message","role":"assistant","content":[{"type":"text","text":"\n\nHi! How can I help you today?"}],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":2,"cache_creation_input_tokens":17286,"cache_read_input_tokens":0,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":17286},"output_tokens":2,"service_tier":"standard","inference_geo":"not_available"},"context_management":null},"parent_tool_use_id":null,"session_id":"e53be95e-a31a-41d7-81cd-452d485081fd","uuid":"d5d315f1-aeb1-43d5-9c37-ac6e9606a8ec"}"#;

    const REAL_RESULT_SUCCESS: &str = r#"{"type":"result","subtype":"success","is_error":false,"duration_ms":4588,"duration_api_ms":4574,"num_turns":1,"result":"\n\n4","stop_reason":"end_turn","session_id":"2aad29f2-b826-4ebb-bae4-51c1cdbbd275","total_cost_usd":0.038550749999999995,"usage":{"input_tokens":2,"cache_creation_input_tokens":5175,"cache_read_input_tokens":12144,"output_tokens":5},"permission_denials":[],"fast_mode_state":"off","uuid":"9b8e57eb-0998-4ae0-a3da-c0119d0d194a"}"#;

    const REAL_SYSTEM_INIT: &str = r#"{"type":"system","subtype":"init","cwd":"C:\\Users\\test","session_id":"2aad29f2-b826-4ebb-bae4-51c1cdbbd275","tools":["Bash","Edit","Read","Write"],"model":"claude-opus-4-6[1m]"}"#;

    const REAL_RATE_LIMIT: &str = r#"{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":1774800000},"uuid":"4a36979f","session_id":"2aad29f2"}"#;

    const REAL_RESULT_ERROR: &str = r#"{"type":"result","subtype":"error","is_error":true,"result":"Something went wrong","session_id":"abc123","duration_ms":100}"#;

    // ── Tests for assistant text (the most critical path) ──

    #[test]
    fn parse_real_assistant_text_extracts_content() {
        let event = parse_event(REAL_ASSISTANT_TEXT);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert_eq!(event.content, "\n\n4");
        assert!(event.metadata.is_none(), "assistant text should have no tool metadata");
    }

    #[test]
    fn parse_real_assistant_hello_extracts_content() {
        let event = parse_event(REAL_ASSISTANT_HELLO);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert_eq!(event.content, "\n\nHi! How can I help you today?");
        assert!(event.metadata.is_none());
    }

    #[test]
    fn assistant_text_has_no_tool_metadata() {
        // This is critical -- the frontend uses `!metadata?.tool` to identify assistant text
        let event = parse_event(REAL_ASSISTANT_TEXT);
        match &event.metadata {
            None => {} // correct
            Some(meta) => {
                assert!(
                    meta.get("tool").is_none(),
                    "assistant text must NOT have 'tool' in metadata, got: {:?}",
                    meta
                );
            }
        }
    }

    // ── Tests for result events ──

    #[test]
    fn parse_real_result_success() {
        let event = parse_event(REAL_RESULT_SUCCESS);
        assert_eq!(event.event_type, AgentEventType::Result);
        assert_eq!(event.content, "\n\n4");
        let meta = event.metadata.unwrap();
        assert_eq!(meta["session_id"], "2aad29f2-b826-4ebb-bae4-51c1cdbbd275");
    }

    #[test]
    fn parse_real_result_includes_usage_data() {
        let event = parse_event(REAL_RESULT_SUCCESS);
        let meta = event.metadata.unwrap();
        assert_eq!(meta["input_tokens"], 2);
        assert_eq!(meta["output_tokens"], 5);
        assert_eq!(meta["cache_creation_input_tokens"], 5175);
        assert_eq!(meta["cache_read_input_tokens"], 12144);
        assert_eq!(meta["duration_api_ms"], 4574);
        // total_cost_usd is mapped to cost_usd
        assert!(meta["cost_usd"].as_f64().unwrap() > 0.038);
    }

    #[test]
    fn parse_result_error() {
        let event = parse_event(REAL_RESULT_ERROR);
        assert_eq!(event.event_type, AgentEventType::Error);
        assert_eq!(event.content, "Something went wrong");
    }

    // ── Tests for system/rate-limit events (should be silent) ──

    #[test]
    fn parse_system_init_is_raw_empty() {
        let event = parse_event(REAL_SYSTEM_INIT);
        assert_eq!(event.event_type, AgentEventType::Raw);
        assert!(event.content.is_empty());
    }

    #[test]
    fn parse_rate_limit_is_raw_empty() {
        let event = parse_event(REAL_RATE_LIMIT);
        assert_eq!(event.event_type, AgentEventType::Raw);
        assert!(event.content.is_empty());
    }

    // ── Tests for tool use events ──

    #[test]
    fn parse_assistant_tool_use_write() {
        let json = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Write","id":"tu_1","input":{"file_path":"/tmp/test.py","content":"print('hi')"}}]}}"#;
        let event = parse_event(json);
        assert_eq!(event.event_type, AgentEventType::FileCreate);
        assert!(event.content.contains("/tmp/test.py"));
        assert!(event.metadata.unwrap()["tool"] == "Write");
    }

    #[test]
    fn parse_assistant_tool_use_edit() {
        let json = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Edit","id":"tu_2","input":{"file_path":"src/main.rs","old_string":"foo","new_string":"bar"}}]}}"#;
        let event = parse_event(json);
        assert_eq!(event.event_type, AgentEventType::FileModify);
        assert!(event.content.contains("src/main.rs"));
    }

    #[test]
    fn parse_assistant_tool_use_bash_test() {
        let json = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","id":"tu_3","input":{"command":"cargo test --lib"}}]}}"#;
        let event = parse_event(json);
        assert_eq!(event.event_type, AgentEventType::TestRun);
        assert!(event.content.contains("cargo test"));
    }

    #[test]
    fn parse_assistant_tool_use_bash_non_test() {
        let json = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","id":"tu_4","input":{"command":"ls -la"}}]}}"#;
        let event = parse_event(json);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert!(event.content.contains("ls -la"));
        assert!(event.metadata.unwrap()["tool"] == "Bash");
    }

    #[test]
    fn parse_assistant_tool_use_read() {
        let json = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","id":"tu_5","input":{"file_path":"Cargo.toml"}}]}}"#;
        let event = parse_event(json);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert!(event.content.contains("Cargo.toml"));
        assert!(event.metadata.unwrap()["tool"] == "Read");
    }

    // ── Tests for mixed content (text + tool_use in same message) ──

    #[test]
    fn parse_assistant_text_with_tool_prefers_text() {
        // When both text and tool_use exist, text takes priority
        let json = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"Let me check that file"},{"type":"tool_use","name":"Read","id":"tu_6","input":{"file_path":"test.rs"}}]}}"#;
        let event = parse_event(json);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert_eq!(event.content, "Let me check that file");
        assert!(event.metadata.is_none(), "text events should not have tool metadata");
    }

    // ── Tests for edge cases ──

    #[test]
    fn parse_empty_line() {
        let event = parse_event("");
        assert_eq!(event.event_type, AgentEventType::Raw);
        assert!(event.content.is_empty());
    }

    #[test]
    fn parse_whitespace_line() {
        let event = parse_event("   \n  ");
        assert_eq!(event.event_type, AgentEventType::Raw);
        assert!(event.content.is_empty());
    }

    #[test]
    fn parse_invalid_json() {
        let event = parse_event("this is not json");
        assert_eq!(event.event_type, AgentEventType::Raw);
        assert_eq!(event.content, "this is not json");
    }

    #[test]
    fn parse_unknown_event_type() {
        let json = r#"{"type":"some_future_event","data":"whatever"}"#;
        let event = parse_event(json);
        assert_eq!(event.event_type, AgentEventType::Raw);
    }

    #[test]
    fn parse_assistant_empty_content_array() {
        let json = r#"{"type":"assistant","message":{"content":[]}}"#;
        let event = parse_event(json);
        assert_eq!(event.event_type, AgentEventType::Raw);
    }

    #[test]
    fn parse_assistant_no_message_field() {
        // Legacy format fallback — no message, no subtype → falls through to legacy parser
        // which returns Think with empty content (harmless — filtered by frontend)
        let json = r#"{"type":"assistant"}"#;
        let event = parse_event(json);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert!(event.content.is_empty());
    }

    // ── Legacy format tests ──

    #[test]
    fn parse_legacy_assistant_text() {
        let json = r#"{"type":"assistant","subtype":"text","content_block":{"type":"text","text":"Hello world"}}"#;
        let event = parse_event(json);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert_eq!(event.content, "Hello world");
    }

    #[test]
    fn parse_legacy_tool_use() {
        let json = r#"{"type":"assistant","subtype":"tool_use","content_block":{"type":"tool_use","name":"Write","input":{"file_path":"test.py"}}}"#;
        let event = parse_event(json);
        assert_eq!(event.event_type, AgentEventType::FileCreate);
    }

    // ── Serialization tests (what the frontend receives) ──

    #[test]
    fn event_serializes_correctly_for_frontend() {
        let event = parse_event(REAL_ASSISTANT_TEXT);
        let json = serde_json::to_value(&event).unwrap();

        // Frontend checks: "event_type" in payload && payload.event_type === "think"
        assert_eq!(json["event_type"], "think");
        assert_eq!(json["content"], "\n\n4");

        // Frontend checks: !event.metadata?.tool (for isAssistantText)
        assert!(json["metadata"].is_null(), "metadata must be null for assistant text");
    }

    #[test]
    fn result_event_serializes_with_session_id() {
        let event = parse_event(REAL_RESULT_SUCCESS);
        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["event_type"], "result");
        assert_eq!(json["metadata"]["session_id"], "2aad29f2-b826-4ebb-bae4-51c1cdbbd275");
    }

    #[test]
    fn tool_event_has_tool_in_metadata() {
        let json_str = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","id":"tu_1","input":{"command":"echo hi"}}]}}"#;
        let event = parse_event(json_str);
        let json = serde_json::to_value(&event).unwrap();

        // Frontend uses metadata.tool to distinguish tool events from assistant text
        assert!(json["metadata"]["tool"].is_string(), "tool events MUST have metadata.tool");
    }
}
