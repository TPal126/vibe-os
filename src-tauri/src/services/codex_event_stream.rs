use chrono::Utc;
use serde::Deserialize;

use super::event_stream::{AgentEvent, AgentEventType};

// ── Codex JSONL Deserialization Structs ──
// These mirror the Codex CLI `codex exec --json` output format.

#[derive(Debug, Deserialize)]
struct CodexEvent {
    #[serde(rename = "type")]
    event_type: String,
    // thread.started
    thread_id: Option<String>,
    // item.started / item.completed
    item: Option<CodexItem>,
    // turn.completed
    usage: Option<CodexUsage>,
    // error
    message: Option<String>,
    // turn.failed
    error: Option<CodexError>,
}

#[derive(Debug, Deserialize)]
struct CodexItem {
    id: Option<String>,
    #[serde(rename = "type")]
    item_type: String,
    // agent_message
    text: Option<String>,
    // command_execution
    command: Option<String>,
    aggregated_output: Option<String>,
    exit_code: Option<i32>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CodexUsage {
    input_tokens: Option<u64>,
    cached_input_tokens: Option<u64>,
    output_tokens: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct CodexError {
    message: Option<String>,
}

// ── Parser ──

/// Parse a single line of Codex CLI `codex exec --json` JSONL output into an AgentEvent.
/// Returns an AgentEvent for every line — unparseable lines become Raw events.
pub fn parse_event(line: &str) -> AgentEvent {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return make_event(AgentEventType::Raw, String::new(), None);
    }

    match serde_json::from_str::<CodexEvent>(trimmed) {
        Ok(evt) => classify_event(evt),
        Err(_) => make_event(AgentEventType::Raw, trimmed.to_string(), None),
    }
}

fn classify_event(evt: CodexEvent) -> AgentEvent {
    match evt.event_type.as_str() {
        "thread.started" => {
            let metadata = serde_json::json!({
                "thread_id": evt.thread_id,
            });
            make_event(AgentEventType::Raw, String::new(), Some(metadata))
        }
        "turn.started" => make_event(AgentEventType::Raw, String::new(), None),
        "item.started" => {
            if let Some(item) = evt.item {
                classify_item_started(item)
            } else {
                make_event(AgentEventType::Raw, String::new(), None)
            }
        }
        "item.completed" => {
            if let Some(item) = evt.item {
                classify_item_completed(item)
            } else {
                make_event(AgentEventType::Raw, String::new(), None)
            }
        }
        "turn.completed" => {
            let metadata = if let Some(ref usage) = evt.usage {
                serde_json::json!({
                    "input_tokens": usage.input_tokens,
                    "output_tokens": usage.output_tokens,
                    "cached_input_tokens": usage.cached_input_tokens,
                    "cache_creation_input_tokens": null,
                    "cache_read_input_tokens": usage.cached_input_tokens,
                    "cost_usd": null,
                    "duration_ms": null,
                    "duration_api_ms": null,
                })
            } else {
                serde_json::json!({
                    "input_tokens": null,
                    "output_tokens": null,
                    "cached_input_tokens": null,
                    "cache_creation_input_tokens": null,
                    "cache_read_input_tokens": null,
                    "cost_usd": null,
                    "duration_ms": null,
                    "duration_api_ms": null,
                })
            };
            make_event(AgentEventType::Result, String::new(), Some(metadata))
        }
        "error" => {
            let msg = evt.message.unwrap_or_default();
            make_event(AgentEventType::Error, msg, None)
        }
        "turn.failed" => {
            let msg = evt
                .error
                .and_then(|e| e.message)
                .unwrap_or_else(|| "turn failed".to_string());
            make_event(AgentEventType::Error, msg, None)
        }
        _ => make_event(
            AgentEventType::Raw,
            format!("unknown event: {}", evt.event_type),
            None,
        ),
    }
}

fn classify_item_started(item: CodexItem) -> AgentEvent {
    match item.item_type.as_str() {
        "command_execution" => {
            let cmd = item.command.as_deref().unwrap_or("");
            make_event(
                AgentEventType::Think,
                format!("Executing: {}", truncate(cmd, 80)),
                Some(serde_json::json!({ "tool": "Bash", "command": cmd })),
            )
        }
        _ => {
            // Unknown item type — emit as Raw with text if available
            let text = item
                .text
                .unwrap_or_else(|| format!("item.started: {}", item.item_type));
            make_event(AgentEventType::Raw, text, None)
        }
    }
}

fn classify_item_completed(item: CodexItem) -> AgentEvent {
    match item.item_type.as_str() {
        "agent_message" => {
            // Assistant text — no tool metadata (frontend uses absence of metadata.tool to identify
            // assistant text)
            let text = item.text.unwrap_or_default();
            make_event(AgentEventType::Think, text, None)
        }
        "command_execution" => {
            let cmd = item.command.as_deref().unwrap_or("");
            let output = item.aggregated_output.as_deref().unwrap_or("");
            let exit_code = item.exit_code;

            let is_test = cmd.contains("test")
                || cmd.contains("pytest")
                || cmd.contains("cargo test")
                || cmd.contains("npm test");

            if is_test {
                make_event(
                    AgentEventType::TestRun,
                    format!("Ran: {}", truncate(cmd, 80)),
                    Some(serde_json::json!({
                        "tool": "Bash",
                        "command": cmd,
                        "output": output,
                        "exit_code": exit_code,
                    })),
                )
            } else {
                make_event(
                    AgentEventType::Think,
                    format!("Executed: {}", truncate(cmd, 80)),
                    Some(serde_json::json!({
                        "tool": "Bash",
                        "command": cmd,
                        "output": output,
                        "exit_code": exit_code,
                    })),
                )
            }
        }
        _ => {
            // Unknown item type — emit as Raw with text if available
            let text = item
                .text
                .unwrap_or_else(|| format!("item.completed: {}", item.item_type));
            make_event(AgentEventType::Raw, text, None)
        }
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

    // ── Real Codex CLI fixtures (captured from `codex exec --json`) ──

    const THREAD_STARTED: &str =
        r#"{"type":"thread.started","thread_id":"019d82d4-a270-7c93-aa19-bfc29826ba30"}"#;

    const TURN_STARTED: &str = r#"{"type":"turn.started"}"#;

    const AGENT_MESSAGE_COMPLETED: &str = r#"{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"4"}}"#;

    const COMMAND_STARTED: &str = r#"{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"cat package.json","aggregated_output":"","exit_code":null,"status":"in_progress"}}"#;

    const COMMAND_COMPLETED: &str = r#"{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"cat package.json","aggregated_output":"{\"name\":\"vibe-os\"}","exit_code":0,"status":"completed"}}"#;

    const TEST_COMMAND_COMPLETED: &str = r#"{"type":"item.completed","item":{"id":"item_2","type":"command_execution","command":"cargo test --lib","aggregated_output":"test result: ok. 5 passed","exit_code":0,"status":"completed"}}"#;

    const TURN_COMPLETED: &str = r#"{"type":"turn.completed","usage":{"input_tokens":10884,"cached_input_tokens":9600,"output_tokens":5}}"#;

    const ERROR_EVENT: &str = r#"{"type":"error","message":"Something went wrong"}"#;

    const TURN_FAILED: &str = r#"{"type":"turn.failed","error":{"message":"Model not supported"}}"#;

    // ── Tests ──

    #[test]
    fn thread_started() {
        let event = parse_event(THREAD_STARTED);
        assert_eq!(event.event_type, AgentEventType::Raw);
        let meta = event.metadata.unwrap();
        assert_eq!(
            meta["thread_id"],
            "019d82d4-a270-7c93-aa19-bfc29826ba30"
        );
    }

    #[test]
    fn turn_started() {
        let event = parse_event(TURN_STARTED);
        assert_eq!(event.event_type, AgentEventType::Raw);
        assert!(event.content.is_empty());
        assert!(event.metadata.is_none());
    }

    #[test]
    fn agent_message() {
        let event = parse_event(AGENT_MESSAGE_COMPLETED);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert_eq!(event.content, "4");
    }

    #[test]
    fn agent_message_has_no_tool_metadata() {
        // Critical: the frontend uses absence of metadata.tool to identify assistant text
        let event = parse_event(AGENT_MESSAGE_COMPLETED);
        match &event.metadata {
            None => {} // correct
            Some(meta) => {
                assert!(
                    meta.get("tool").is_none(),
                    "agent_message must NOT have 'tool' in metadata, got: {:?}",
                    meta
                );
            }
        }
    }

    #[test]
    fn command_started() {
        let event = parse_event(COMMAND_STARTED);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert!(event.content.contains("cat package.json"));
        let meta = event.metadata.unwrap();
        assert_eq!(meta["tool"], "Bash");
        assert_eq!(meta["command"], "cat package.json");
    }

    #[test]
    fn command_completed() {
        let event = parse_event(COMMAND_COMPLETED);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert!(event.content.contains("cat package.json"));
        let meta = event.metadata.unwrap();
        assert_eq!(meta["tool"], "Bash");
        assert_eq!(meta["exit_code"], 0);
    }

    #[test]
    fn test_command() {
        let event = parse_event(TEST_COMMAND_COMPLETED);
        assert_eq!(event.event_type, AgentEventType::TestRun);
        assert!(event.content.contains("cargo test"));
        let meta = event.metadata.unwrap();
        assert_eq!(meta["tool"], "Bash");
    }

    #[test]
    fn turn_completed_as_result() {
        let event = parse_event(TURN_COMPLETED);
        assert_eq!(event.event_type, AgentEventType::Result);
        let meta = event.metadata.unwrap();
        assert_eq!(meta["input_tokens"], 10884);
        assert_eq!(meta["cached_input_tokens"], 9600);
        assert_eq!(meta["output_tokens"], 5);
        // cache_read_input_tokens mirrors cached_input_tokens
        assert_eq!(meta["cache_read_input_tokens"], 9600);
        // Fields present but null (Codex doesn't report these)
        assert!(meta["cache_creation_input_tokens"].is_null());
        assert!(meta["cost_usd"].is_null());
        assert!(meta["duration_ms"].is_null());
        assert!(meta["duration_api_ms"].is_null());
    }

    #[test]
    fn error() {
        let event = parse_event(ERROR_EVENT);
        assert_eq!(event.event_type, AgentEventType::Error);
        assert_eq!(event.content, "Something went wrong");
    }

    #[test]
    fn turn_failed() {
        let event = parse_event(TURN_FAILED);
        assert_eq!(event.event_type, AgentEventType::Error);
        assert_eq!(event.content, "Model not supported");
    }

    #[test]
    fn empty_line() {
        let event = parse_event("");
        assert_eq!(event.event_type, AgentEventType::Raw);
        assert!(event.content.is_empty());
    }

    #[test]
    fn invalid_json() {
        let event = parse_event("this is not json");
        assert_eq!(event.event_type, AgentEventType::Raw);
        assert_eq!(event.content, "this is not json");
    }
}
