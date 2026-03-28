use tauri_plugin_shell::ShellExt;

/// Spawn a test subprocess from the Rust side and capture its stdout.
/// This is an alternative to the frontend Command.create() pattern.
/// On Windows, uses `cmd /C echo Hello VIBE OS` since echo is a shell builtin.
/// On Unix, uses the echo binary directly.
#[tauri::command]
pub async fn test_spawn(app: tauri::AppHandle) -> Result<String, String> {
    let shell = app.shell();

    let output = if cfg!(target_os = "windows") {
        shell
            .command("cmd")
            .args(["/C", "echo", "Hello VIBE OS"])
            .output()
            .await
            .map_err(|e| format!("Failed to spawn process: {}", e))?
    } else {
        shell
            .command("echo")
            .args(["Hello", "VIBE", "OS"])
            .output()
            .await
            .map_err(|e| format!("Failed to spawn process: {}", e))?
    };

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("Process failed: {}", stderr))
    }
}
