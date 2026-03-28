use std::sync::Mutex;
use tauri::Manager;

mod commands;
mod db;

use commands::db_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
