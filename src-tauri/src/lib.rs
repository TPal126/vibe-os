use std::sync::{Arc, Mutex};
use tauri::Manager;
use tokio::sync::Mutex as TokioMutex;

mod commands;
mod db;
mod graph;
mod services;

use commands::agent_commands;
use commands::agent_commands_v2;
use commands::architecture_commands;
use commands::audit_commands;
use commands::claude_commands;
use commands::context_commands;
use commands::db_commands;
use commands::decision_commands;
use commands::events_commands;
use commands::file_commands;
use commands::graph_commands;
use commands::script_commands;
use commands::shell_commands;
use commands::pipeline_commands;
use commands::project_commands;
use commands::token_commands;
use commands::workspace_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
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

            // Register the SQLite database connection as managed state
            app.manage(Mutex::new(conn));

            // Initialize SurrealDB graph database
            let graph_db = tauri::async_runtime::block_on(async {
                let gdb = graph::connection::initialize_graph_db(&app_data_dir)
                    .await
                    .expect("Failed to initialize graph DB");
                graph::schema::define_schema(&gdb)
                    .await
                    .expect("Failed to define graph schema");
                gdb
            });
            app.manage(graph_db);

            // Register workspace watcher state
            app.manage(Arc::new(TokioMutex::new(
                workspace_commands::WorkspaceWatcherState {
                    stop_signal: None,
                    workspace_path: None,
                },
            )));

            // Register sidecar state
            app.manage(Arc::new(TokioMutex::new(None::<services::sidecar::SidecarProcess>)));

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
            db_commands::create_claude_session,
            db_commands::list_claude_sessions,
            db_commands::get_claude_session,
            db_commands::close_claude_session,
            db_commands::update_claude_session_status,
            shell_commands::test_spawn,
            context_commands::discover_skills,
            context_commands::clone_repo,
            context_commands::save_repo,
            context_commands::get_all_repos,
            context_commands::delete_repo,
            context_commands::set_repo_active,
            context_commands::refresh_repo_branch,
            context_commands::list_remote_branches,
            context_commands::add_branch_worktree,
            context_commands::remove_branch_worktree,
            context_commands::index_repo,
            context_commands::compose_prompt,
            context_commands::sync_skills_to_claude,
            file_commands::read_file,
            file_commands::write_file,
            audit_commands::log_action,
            audit_commands::get_audit_log,
            claude_commands::validate_claude_cli,
            claude_commands::start_claude,
            claude_commands::send_message,
            claude_commands::cancel_claude,
            claude_commands::list_claude_code_sessions,
            claude_commands::attach_claude_code_session,
            decision_commands::record_decision,
            decision_commands::get_session_decisions,
            decision_commands::export_decisions,
            script_commands::get_session_scripts,
            script_commands::generate_skill_from_script,
            audit_commands::get_session_audit,
            audit_commands::export_audit_log,
            workspace_commands::create_workspace,
            workspace_commands::open_workspace,
            workspace_commands::read_workspace_tree,
            workspace_commands::watch_workspace_claude_md,
            workspace_commands::stop_workspace_watcher,
            token_commands::set_token_budget,
            token_commands::get_token_budgets,
            token_commands::delete_token_budget,
            agent_commands::save_agent_definition,
            agent_commands::load_agent_definitions,
            agent_commands::remove_agent_definition,
            agent_commands::get_workspace_agent_dir,
            // Graph commands
            graph_commands::graph_get_full,
            graph_commands::graph_get_provenance,
            graph_commands::graph_get_impact,
            graph_commands::graph_get_session_report,
            graph_commands::graph_get_skill_effectiveness,
            graph_commands::graph_search,
            graph_commands::graph_create_node,
            graph_commands::graph_upsert_node,
            graph_commands::graph_get_node,
            graph_commands::graph_list_nodes,
            graph_commands::graph_delete_node,
            graph_commands::graph_relate,
            graph_commands::graph_get_edges,
            graph_commands::graph_index_repo,
            graph_commands::graph_debug_dump,
            graph_commands::graph_populate_decision,
            graph_commands::graph_populate_action,
            graph_commands::graph_populate_skill,
            graph_commands::graph_populate_session,
            graph_commands::graph_sync_decisions,
            graph_commands::graph_sync_audit,
            graph_commands::graph_get_topology,
            // Unified events commands
            events_commands::log_event,
            events_commands::get_events,
            events_commands::export_events,
            // Agent v2 commands (SDK sidecar)
            agent_commands_v2::ensure_sidecar,
            agent_commands_v2::start_agent,
            agent_commands_v2::send_agent_message,
            agent_commands_v2::cancel_agent,
            agent_commands_v2::get_sidecar_status,
            agent_commands_v2::detect_available_clis,
            // Project commands
            project_commands::create_project,
            project_commands::list_projects,
            project_commands::update_project,
            project_commands::delete_project,
            // Pipeline commands
            pipeline_commands::create_pipeline,
            pipeline_commands::get_project_pipeline,
            pipeline_commands::get_pipeline_phases,
            pipeline_commands::update_pipeline_phases,
            pipeline_commands::delete_pipeline,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
