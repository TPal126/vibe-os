use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;

/// Initialize the SQLite database at the given path.
/// Creates the parent directory if it doesn't exist, opens the connection,
/// configures WAL mode and other PRAGMAs, then runs migrations.
pub fn initialize_db(db_path: &PathBuf) -> Result<Connection, String> {
    // Create parent directory if it doesn't exist
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create DB directory: {}", e))?;
    }

    // Open the database connection
    let conn =
        Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Configure PRAGMAs for performance and safety
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA busy_timeout=5000;
         PRAGMA synchronous=NORMAL;
         PRAGMA foreign_keys=ON;",
    )
    .map_err(|e| format!("Failed to set PRAGMAs: {}", e))?;

    // Run schema migrations
    run_migrations(&conn)?;

    Ok(conn)
}

/// Run schema migrations using PRAGMA user_version to track state.
/// Each migration block checks the current version and applies changes
/// in a transaction if needed.
fn run_migrations(conn: &Connection) -> Result<(), String> {
    let version: i32 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(|e| format!("Failed to read user_version: {}", e))?;

    if version < 1 {
        conn.execute_batch(
            "BEGIN;
             CREATE TABLE IF NOT EXISTS sessions (
                 id TEXT PRIMARY KEY,
                 started_at TEXT NOT NULL,
                 ended_at TEXT,
                 active INTEGER DEFAULT 1
             );
             CREATE TABLE IF NOT EXISTS settings (
                 key TEXT PRIMARY KEY,
                 value TEXT NOT NULL
             );
             PRAGMA user_version = 1;
             COMMIT;",
        )
        .map_err(|e| format!("Migration v1 failed: {}", e))?;
    }

    if version < 2 {
        conn.execute_batch(
            "BEGIN;
             ALTER TABLE sessions ADD COLUMN system_prompt TEXT DEFAULT '';
             ALTER TABLE sessions ADD COLUMN active_repos TEXT DEFAULT '[]';
             ALTER TABLE sessions ADD COLUMN active_skills TEXT DEFAULT '[]';
             PRAGMA user_version = 2;
             COMMIT;",
        )
        .map_err(|e| format!("Migration v2 failed: {}", e))?;
    }

    if version < 3 {
        conn.execute_batch(
            "BEGIN;
             CREATE TABLE IF NOT EXISTS audit_log (
                 id TEXT PRIMARY KEY,
                 session_id TEXT NOT NULL,
                 timestamp TEXT NOT NULL,
                 action_type TEXT NOT NULL,
                 detail TEXT NOT NULL,
                 actor TEXT NOT NULL,
                 metadata TEXT,
                 FOREIGN KEY (session_id) REFERENCES sessions(id)
             );
             PRAGMA user_version = 3;
             COMMIT;",
        )
        .map_err(|e| format!("Migration v3 failed: {}", e))?;
    }

    if version < 4 {
        conn.execute_batch(
            "BEGIN;
             CREATE TABLE IF NOT EXISTS decisions (
                 id TEXT PRIMARY KEY,
                 session_id TEXT NOT NULL,
                 timestamp TEXT NOT NULL,
                 decision TEXT NOT NULL,
                 rationale TEXT NOT NULL,
                 confidence REAL NOT NULL,
                 impact_category TEXT NOT NULL,
                 reversible INTEGER NOT NULL DEFAULT 1,
                 related_files TEXT NOT NULL DEFAULT '[]',
                 related_tickets TEXT NOT NULL DEFAULT '[]',
                 FOREIGN KEY (session_id) REFERENCES sessions(id)
             );
             PRAGMA user_version = 4;
             COMMIT;",
        )
        .map_err(|e| format!("Migration v4 failed: {}", e))?;
    }

    if version < 5 {
        conn.execute_batch(
            "BEGIN;
             CREATE TABLE IF NOT EXISTS claude_sessions (
                 id TEXT PRIMARY KEY,
                 session_id TEXT NOT NULL,
                 name TEXT NOT NULL DEFAULT 'Session',
                 status TEXT NOT NULL DEFAULT 'idle',
                 conversation_id TEXT,
                 created_at TEXT NOT NULL,
                 ended_at TEXT,
                 FOREIGN KEY (session_id) REFERENCES sessions(id)
             );
             CREATE INDEX IF NOT EXISTS idx_claude_sessions_session_id
                 ON claude_sessions(session_id);
             CREATE INDEX IF NOT EXISTS idx_claude_sessions_status
                 ON claude_sessions(status);
             PRAGMA user_version = 5;
             COMMIT;",
        )
        .map_err(|e| format!("Migration v5 failed: {}", e))?;
    }

    if version < 6 {
        conn.execute_batch(
            "BEGIN;
             CREATE TABLE IF NOT EXISTS token_budgets (
                 id TEXT PRIMARY KEY,
                 scope_type TEXT NOT NULL CHECK(scope_type IN ('skill', 'repo', 'session')),
                 scope_id TEXT NOT NULL,
                 max_tokens INTEGER NOT NULL,
                 warning_threshold REAL NOT NULL DEFAULT 0.75,
                 created_at TEXT NOT NULL,
                 updated_at TEXT NOT NULL
             );
             CREATE UNIQUE INDEX IF NOT EXISTS idx_token_budgets_scope
                 ON token_budgets(scope_type, scope_id);
             PRAGMA user_version = 6;
             COMMIT;",
        )
        .map_err(|e| format!("Migration v6 failed: {}", e))?;
    }

    if version < 7 {
        conn.execute_batch(
            "BEGIN;
             CREATE TABLE IF NOT EXISTS events (
                 id TEXT PRIMARY KEY,
                 session_id TEXT NOT NULL,
                 timestamp TEXT NOT NULL,
                 kind TEXT NOT NULL CHECK(kind IN ('action', 'decision')),
                 action_type TEXT,
                 detail TEXT,
                 actor TEXT CHECK(actor IN ('agent', 'user', 'system')),
                 metadata TEXT,
                 rationale TEXT,
                 confidence REAL,
                 impact_category TEXT,
                 reversible INTEGER,
                 related_files TEXT,
                 related_tickets TEXT,
                 FOREIGN KEY (session_id) REFERENCES sessions(id)
             );
             CREATE INDEX IF NOT EXISTS idx_events_session_id
                 ON events(session_id);
             CREATE INDEX IF NOT EXISTS idx_events_kind
                 ON events(kind);
             CREATE INDEX IF NOT EXISTS idx_events_timestamp
                 ON events(timestamp);
             PRAGMA user_version = 7;
             COMMIT;",
        )
        .map_err(|e| format!("Migration v7 failed: {}", e))?;
    }

    if version < 8 {
        conn.execute_batch(
            "BEGIN;
             CREATE TABLE IF NOT EXISTS repos (
                 id TEXT PRIMARY KEY,
                 name TEXT NOT NULL,
                 source TEXT NOT NULL,
                 path TEXT NOT NULL UNIQUE,
                 git_url TEXT,
                 branch TEXT NOT NULL,
                 language TEXT NOT NULL DEFAULT '',
                 file_count INTEGER NOT NULL DEFAULT 0,
                 active INTEGER NOT NULL DEFAULT 0,
                 parent_id TEXT,
                 created_at TEXT NOT NULL
             );
             PRAGMA user_version = 8;
             COMMIT;",
        )
        .map_err(|e| format!("Migration v8 failed: {}", e))?;

        // Migrate existing global_repos from settings JSON into repos table
        let maybe_json: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'global_repos'",
                [],
                |row| row.get(0),
            )
            .ok();

        if let Some(json_str) = maybe_json {
            if let Ok(repos) = serde_json::from_str::<Vec<serde_json::Value>>(&json_str) {
                for repo in repos {
                    let id = repo.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    let name = repo.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    let source = repo.get("source").and_then(|v| v.as_str()).unwrap_or("local");
                    let path = repo.get("path").and_then(|v| v.as_str()).unwrap_or("");
                    let git_url = repo.get("gitUrl").and_then(|v| v.as_str());
                    let branch = repo.get("branch").and_then(|v| v.as_str()).unwrap_or("main");
                    let language = repo.get("language").and_then(|v| v.as_str()).unwrap_or("");
                    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

                    if !id.is_empty() && !path.is_empty() {
                        conn.execute(
                            "INSERT OR IGNORE INTO repos (id, name, source, path, git_url, branch, language, file_count, active, parent_id, created_at)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 0, NULL, ?8)",
                            rusqlite::params![id, name, source, path, git_url, branch, language, now],
                        ).ok();
                    }
                }
            }
            conn.execute("DELETE FROM settings WHERE key = 'global_repos'", []).ok();
        }
    }

    Ok(())
}
