use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex as TokioMutex;

/// Managed state for the sidecar process.
pub type SidecarState = Arc<TokioMutex<Option<SidecarProcess>>>;

pub struct SidecarProcess {
    pub child: Child,
    pub ready: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum SidecarCommand {
    #[serde(rename = "start")]
    Start {
        #[serde(rename = "sessionId")]
        session_id: String,
        prompt: String,
        #[serde(rename = "systemPrompt")]
        system_prompt: String,
        options: serde_json::Value,
    },
    #[serde(rename = "send")]
    Send {
        #[serde(rename = "sessionId")]
        session_id: String,
        prompt: String,
    },
    #[serde(rename = "cancel")]
    Cancel {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    #[serde(rename = "tool_response")]
    ToolResponse {
        #[serde(rename = "requestId")]
        request_id: String,
        result: serde_json::Value,
    },
    #[serde(rename = "stop")]
    Stop,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum SidecarEvent {
    #[serde(rename = "ready")]
    Ready,
    #[serde(rename = "sdk_message")]
    SdkMessage {
        #[serde(rename = "sessionId")]
        session_id: String,
        message: serde_json::Value,
    },
    #[serde(rename = "tool_request")]
    ToolRequest {
        #[serde(rename = "requestId")]
        request_id: String,
        tool: String,
        input: serde_json::Value,
    },
    #[serde(rename = "session_ended")]
    SessionEnded {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    #[serde(rename = "error")]
    Error {
        #[serde(rename = "sessionId")]
        session_id: Option<String>,
        error: String,
    },
}

/// Spawn the Node sidecar process.
pub fn spawn_sidecar() -> Result<Child, String> {
    // Look for the sidecar in the expected location
    let sidecar_path = find_sidecar_path()?;

    eprintln!("[sidecar] Running: node {}", &sidecar_path);

    let child = Command::new("node")
        .arg(&sidecar_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit()) // inherit stderr so we see sidecar errors in Tauri console
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    Ok(child)
}

fn find_sidecar_path() -> Result<String, String> {
    // In dev: look relative to project root
    let dev_path = std::env::current_dir()
        .map(|p| p.join("agent-sidecar").join("dist").join("main.mjs"))
        .ok();

    if let Some(ref p) = dev_path {
        if p.exists() {
            return Ok(p.to_string_lossy().to_string());
        }
    }

    // In production: look relative to executable
    let exe_dir = std::env::current_exe()
        .map(|p| p.parent().unwrap_or(p.as_path()).to_path_buf())
        .map_err(|e| e.to_string())?;

    let prod_path = exe_dir.join("agent-sidecar").join("main.mjs");
    if prod_path.exists() {
        return Ok(prod_path.to_string_lossy().to_string());
    }

    Err("Agent sidecar not found. Run 'npm run build' in agent-sidecar/".to_string())
}

/// Send a command to the sidecar via stdin.
pub fn send_to_sidecar(child: &mut Child, cmd: &SidecarCommand) -> Result<(), String> {
    let stdin = child.stdin.as_mut().ok_or("Sidecar stdin not available")?;
    let json = serde_json::to_string(cmd).map_err(|e| e.to_string())?;
    writeln!(stdin, "{}", json).map_err(|e| format!("Failed to write to sidecar: {}", e))?;
    stdin.flush().map_err(|e| format!("Failed to flush sidecar stdin: {}", e))?;
    Ok(())
}

/// Read events from sidecar stdout in a blocking loop.
/// Call this from a background thread.
pub fn read_sidecar_stdout(child: &mut Child) -> Option<BufReader<std::process::ChildStdout>> {
    child.stdout.take().map(BufReader::new)
}
