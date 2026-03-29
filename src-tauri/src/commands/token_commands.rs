use chrono::Utc;
use rusqlite::params;
use serde::Serialize;
use tauri::State;

use super::db_commands::DbState;

#[derive(Serialize, Clone)]
pub struct TokenBudget {
    pub id: String,
    pub scope_type: String,
    pub scope_id: String,
    pub max_tokens: i64,
    pub warning_threshold: f64,
    pub created_at: String,
    pub updated_at: String,
}

/// Upsert a token budget for a given scope.
/// If a budget already exists for (scope_type, scope_id), it updates max_tokens and warning_threshold.
/// Otherwise, it inserts a new row with a generated UUID.
#[tauri::command]
pub fn set_token_budget(
    state: State<'_, DbState>,
    scope_type: String,
    scope_id: String,
    max_tokens: i64,
    warning_threshold: Option<f64>,
) -> Result<TokenBudget, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;

    let threshold = warning_threshold.unwrap_or(0.75);
    let now = Utc::now().to_rfc3339();

    // Check if budget exists for this scope
    let existing_id: Option<String> = conn
        .query_row(
            "SELECT id FROM token_budgets WHERE scope_type = ?1 AND scope_id = ?2",
            params![scope_type, scope_id],
            |row| row.get(0),
        )
        .ok();

    let id = if let Some(existing) = existing_id {
        // Update existing
        conn.execute(
            "UPDATE token_budgets SET max_tokens = ?1, warning_threshold = ?2, updated_at = ?3 WHERE id = ?4",
            params![max_tokens, threshold, now, existing],
        )
        .map_err(|e| format!("Failed to update token budget: {}", e))?;
        existing
    } else {
        // Insert new
        let new_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO token_budgets (id, scope_type, scope_id, max_tokens, warning_threshold, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![new_id, scope_type, scope_id, max_tokens, threshold, now, now],
        )
        .map_err(|e| format!("Failed to insert token budget: {}", e))?;
        new_id
    };

    Ok(TokenBudget {
        id,
        scope_type,
        scope_id,
        max_tokens,
        warning_threshold: threshold,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Get all token budgets.
#[tauri::command]
pub fn get_token_budgets(state: State<'_, DbState>) -> Result<Vec<TokenBudget>, String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, scope_type, scope_id, max_tokens, warning_threshold, created_at, updated_at FROM token_budgets ORDER BY scope_type, scope_id")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let budgets = stmt
        .query_map([], |row| {
            Ok(TokenBudget {
                id: row.get(0)?,
                scope_type: row.get(1)?,
                scope_id: row.get(2)?,
                max_tokens: row.get(3)?,
                warning_threshold: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to query token budgets: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect token budgets: {}", e))?;

    Ok(budgets)
}

/// Delete a token budget by ID.
#[tauri::command]
pub fn delete_token_budget(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state
        .lock()
        .map_err(|e| format!("DB lock failed: {}", e))?;

    conn.execute(
        "DELETE FROM token_budgets WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("Failed to delete token budget: {}", e))?;

    Ok(())
}
