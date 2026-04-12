use std::thread;
use std::time::Duration;

use serde::Deserialize;
use tauri::{AppHandle, Emitter};

use super::{BackendAdapter, CliInfo, ModelInfo, SpawnArgs};

#[derive(Debug, Deserialize, Clone)]
pub struct FakeScenario {
    pub events: Vec<FakeEvent>,
    #[serde(default = "default_source")]
    pub source: String, // "cli-claude" or "cli-codex" -- what the frontend expects
}

fn default_source() -> String {
    "cli-claude".to_string()
}

#[derive(Debug, Deserialize, Clone)]
pub struct FakeEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub status: Option<String>,
    pub event: Option<FakeAgentEvent>,
    pub delay_ms: Option<u64>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct FakeAgentEvent {
    pub event_type: String,
    pub content: String,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

pub struct FakeAdapter {
    scenario: FakeScenario,
}

impl FakeAdapter {
    pub fn new(scenario: FakeScenario) -> Self {
        Self { scenario }
    }

    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str::<FakeScenario>(json)
            .map(Self::new)
            .map_err(|e| format!("Invalid scenario: {}", e))
    }
}

impl BackendAdapter for FakeAdapter {
    fn name(&self) -> &str {
        "fake"
    }

    fn validate(&self) -> Result<CliInfo, String> {
        Ok(CliInfo {
            name: "fake".into(),
            version: "1.0.0-test".into(),
        })
    }

    fn spawn(&self, args: SpawnArgs, app: &AppHandle) -> Result<String, String> {
        let sid = args.session_id.clone();
        let events = self.scenario.events.clone();
        let source = self.scenario.source.clone();
        let app_handle = app.clone();
        let sid_clone = sid.clone();

        thread::spawn(move || {
            for event in events {
                if let Some(delay) = event.delay_ms {
                    thread::sleep(Duration::from_millis(delay));
                }
                match event.event_type.as_str() {
                    "status" => {
                        let _ = app_handle.emit(
                            "agent-stream",
                            serde_json::json!({
                                "type": "status",
                                "source": &source,
                                "sessionId": &sid_clone,
                                "status": event.status.as_deref().unwrap_or("working"),
                            }),
                        );
                    }
                    "agent_event" => {
                        if let Some(evt) = event.event {
                            let _ = app_handle.emit(
                                "agent-stream",
                                serde_json::json!({
                                    "type": "agent_event",
                                    "source": &source,
                                    "sessionId": &sid_clone,
                                    "event": {
                                        "event_type": evt.event_type,
                                        "content": evt.content,
                                        "metadata": evt.metadata,
                                        "timestamp": chrono::Utc::now().to_rfc3339(),
                                    }
                                }),
                            );
                        }
                    }
                    _ => {}
                }
            }
        });

        Ok(sid)
    }

    fn send_input(&self, _: &str, _: &str, _: &AppHandle) -> Result<(), String> {
        Ok(())
    }

    fn cancel(&self, _: &str, _: &AppHandle) -> Result<(), String> {
        Ok(())
    }

    fn supported_models(&self) -> Vec<ModelInfo> {
        vec![ModelInfo {
            id: "fake".into(),
            name: "Fake".into(),
            backend: "fake".into(),
        }]
    }
}
