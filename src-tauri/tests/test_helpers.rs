use rusqlite::Connection;

/// Create an in-memory SQLite DB with all real migrations applied.
pub fn create_test_db() -> Connection {
    let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
    conn.execute_batch("PRAGMA foreign_keys=ON;").expect("PRAGMAs failed");
    app_lib::db::run_migrations(&conn).expect("Migrations failed");
    conn
}
