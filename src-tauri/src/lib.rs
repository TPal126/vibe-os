use std::sync::Mutex;
use tauri::Manager;

mod commands;
mod db;
mod services;

use commands::architecture_commands;
use commands::audit_commands;
use commands::claude_commands;
use commands::context_commands;
use commands::db_commands;
use commands::decision_commands;
use commands::file_commands;
use commands::script_commands;
use commands::shell_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Resolve the app data directory using Tauri's path API
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve appDataDir");

            let db_path = app_data_dir.join("vibe-os.db");

            // Initialize the database with WAL mode and migrations
            let conn = db::initialize_db(&db_path)
                .expect("Failed to initialize database");

            // Register the database connection as managed state
            app.manage(Mutex::new(conn));

            // Copy bundled skill files to ~/.vibe-os/skills/ on first launch
            let home = dirs::home_dir().expect("Cannot determine home directory");
            let skills_dir = home.join(".vibe-os").join("skills");
            if !skills_dir.exists()
                || std::fs::read_dir(&skills_dir)
                    .map(|d| d.count())
                    .unwrap_or(0)
                    == 0
            {
                std::fs::create_dir_all(&skills_dir).expect("Failed to create skills dir");
                let resource_dir = app
                    .path()
                    .resolve("skills", tauri::path::BaseDirectory::Resource)
                    .expect("Failed to resolve skills resource dir");
                if resource_dir.exists() {
                    for entry in std::fs::read_dir(&resource_dir)
                        .unwrap_or_else(|_| panic!("read bundled skills"))
                    {
                        if let Ok(entry) = entry {
                            if entry
                                .path()
                                .extension()
                                .map(|e| e == "md")
                                .unwrap_or(false)
                            {
                                let dest = skills_dir.join(entry.file_name());
                                std::fs::copy(entry.path(), &dest).ok();
                            }
                        }
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            architecture_commands::analyze_architecture,
            db_commands::test_db_write,
            db_commands::test_db_read,
            db_commands::create_session,
            db_commands::end_session,
            db_commands::get_active_session,
            db_commands::update_session_repos,
            db_commands::update_session_skills,
            db_commands::update_session_prompt,
            db_commands::get_setting,
            db_commands::save_setting,
            db_commands::delete_setting,
            shell_commands::test_spawn,
            context_commands::discover_skills,
            context_commands::clone_repo,
            context_commands::get_repos,
            context_commands::index_repo,
            context_commands::compose_prompt,
            file_commands::read_file,
            file_commands::write_file,
            audit_commands::log_action,
            audit_commands::get_audit_log,
            claude_commands::start_claude,
            claude_commands::send_message,
            claude_commands::cancel_claude,
            decision_commands::record_decision,
            decision_commands::get_session_decisions,
            decision_commands::export_decisions,
            script_commands::get_session_scripts,
            script_commands::generate_skill_from_script,
            audit_commands::get_session_audit,
            audit_commands::export_audit_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
