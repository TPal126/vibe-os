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

    Ok(())
}
