use std::sync::Mutex;
use tauri::Manager;

mod commands;
mod db;

use commands::context_commands;
use commands::db_commands;
use commands::shell_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
