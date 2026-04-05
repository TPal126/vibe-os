# Unified Repo Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the disconnected `globalRepoSlice` and `repoSlice` into a single DB-backed repo system with multi-branch support via git worktrees and SurrealDB graph population.

**Architecture:** New `repos` SQLite table (migration v8) is the sole source of truth. Rust commands handle CRUD, branch worktrees, and graph population. Frontend has one unified `repoSlice` that all components consume. `globalRepoSlice` is deleted entirely.

**Tech Stack:** Rust (rusqlite, tauri-plugin-shell for git), TypeScript (Zustand), SurrealDB (SCHEMALESS graph nodes/edges)

---

## File Structure

### Rust (create/modify)
- `src-tauri/src/db.rs` — add migration v8 (repos table + data migration from settings)
- `src-tauri/src/commands/context_commands.rs` — replace `RepoMeta` with `RepoRow`, add 7 new commands, modify `clone_repo`, remove `get_repos`
- `src-tauri/src/graph/schema.rs` �� add edge tables + indexes for repo graph
- `src-tauri/src/graph/population.rs` — add `populate_repo` and `populate_repo_edge` functions
- `src-tauri/src/lib.rs` — register new commands, deregister old

### Frontend (create/modify/delete)
- `src/lib/tauri.ts` — add `RepoRow` type, new command wrappers, remove old
- `src/stores/types.ts` — update `Repo` interface, update `RepoSlice`, remove `GlobalRepo`/`GlobalRepoSlice`, remove from `AppState`
- `src/stores/slices/repoSlice.ts` — full rewrite with unified CRUD + branch management
- `src/stores/slices/repoSlice.test.ts` — new test file for unified slice
- `src/stores/slices/globalRepoSlice.ts` — DELETE
- `src/stores/index.ts` — remove globalRepoSlice composition + re-exports
- `src/components/home/ResourceCatalog.tsx` — read unified repos, add branch UI, missing-path badge
- `src/components/home/RepoBrowseModal.tsx` — simplify to return paths
- `src/components/home/RepoGithubModal.tsx` — simplify to return git URLs
- `src/components/home/RepoDropZone.tsx` — simplify to return paths
- `src/components/home/ProjectSetupView.tsx` — use toggleRepo directly
- `src/components/panels/ResourcesTab.tsx` — verify reads unified list

---

### Task 1: Migration v8 — Create `repos` Table

**Files:**
- Modify: `src-tauri/src/db.rs:186-189` (add migration v8 after v7 block)

- [ ] **Step 1: Write the migration v8 block**

Add after the `if version < 7` block (line 186), before the `Ok(())`:

```rust
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
```

- [ ] **Step 2: Add serde_json import if not present**

Check if `serde_json` is already imported in `db.rs`. If not, add at the top:

```rust
use serde_json;
```

Note: `serde_json` and `chrono` are already in Cargo.toml dependencies (used elsewhere in the project).

- [ ] **Step 3: Run Rust tests to verify migration compiles**

Run: `cargo test --lib -p vibe-os-tauri -- --nocapture 2>&1 | head -30`
Expected: Compilation succeeds (existing tests still pass)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db.rs
git commit -m "feat: add repos table migration v8 with data migration from settings JSON"
```

---

### Task 2: Rust `RepoRow` Struct and CRUD Commands

**Files:**
- Modify: `src-tauri/src/commands/context_commands.rs:157-168` (replace `RepoMeta` section)

- [ ] **Step 1: Add `RepoRow` struct and Deserialize import**

Replace the existing `RepoMeta` struct (lines 159-168) with `RepoRow`. Keep `RepoMeta` temporarily (it's still used by `clone_repo` until Task 3). Add below it:

```rust
use serde::Deserialize;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoRow {
    pub id: String,
    pub name: String,
    pub source: String,
    pub path: String,
    pub git_url: Option<String>,
    pub branch: String,
    pub language: String,
    pub file_count: i64,
    pub active: bool,
    pub parent_id: Option<String>,
    pub created_at: String,
}
```

- [ ] **Step 2: Add `save_repo` command**

Add after the `RepoRow` struct:

```rust
#[tauri::command]
pub fn save_repo(
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    repo: RepoRow,
) -> Result<RepoRow, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO repos (id, name, source, path, git_url, branch, language, file_count, active, parent_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            repo.id,
            repo.name,
            repo.source,
            repo.path,
            repo.git_url,
            repo.branch,
            repo.language,
            repo.file_count,
            repo.active as i32,
            repo.parent_id,
            repo.created_at,
        ],
    )
    .map_err(|e| format!("Failed to save repo: {}", e))?;
    Ok(repo)
}
```

- [ ] **Step 3: Add `get_all_repos` command**

```rust
#[tauri::command]
pub fn get_all_repos(
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
) -> Result<Vec<RepoRow>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, source, path, git_url, branch, language, file_count, active, parent_id, created_at
             FROM repos ORDER BY created_at",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(RepoRow {
                id: row.get(0)?,
                name: row.get(1)?,
                source: row.get(2)?,
                path: row.get(3)?,
                git_url: row.get(4)?,
                branch: row.get(5)?,
                language: row.get(6)?,
                file_count: row.get(7)?,
                active: row.get::<_, i32>(8)? != 0,
                parent_id: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("Failed to query repos: {}", e))?;

    let mut repos = Vec::new();
    for row in rows {
        repos.push(row.map_err(|e| format!("Failed to read row: {}", e))?);
    }
    Ok(repos)
}
```

- [ ] **Step 4: Add `delete_repo` command**

```rust
#[tauri::command]
pub fn delete_repo(
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    id: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    // Delete children (branch worktrees) first
    conn.execute("DELETE FROM repos WHERE parent_id = ?1", rusqlite::params![id])
        .map_err(|e| format!("Failed to delete child repos: {}", e))?;
    conn.execute("DELETE FROM repos WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| format!("Failed to delete repo: {}", e))?;
    Ok(())
}
```

- [ ] **Step 5: Add `set_repo_active` command**

```rust
#[tauri::command]
pub fn set_repo_active(
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    id: String,
    active: bool,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE repos SET active = ?1 WHERE id = ?2",
        rusqlite::params![active as i32, id],
    )
    .map_err(|e| format!("Failed to update repo active state: {}", e))?;
    Ok(())
}
```

- [ ] **Step 6: Add `refresh_repo_branch` command**

```rust
#[tauri::command]
pub fn refresh_repo_branch(
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    id: String,
) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let path: String = conn
        .query_row("SELECT path FROM repos WHERE id = ?1", rusqlite::params![id], |row| row.get(0))
        .map_err(|e| format!("Repo not found: {}", e))?;

    let branch = read_git_branch(&PathBuf::from(&path)).unwrap_or_else(|| "main".to_string());

    conn.execute(
        "UPDATE repos SET branch = ?1 WHERE id = ?2",
        rusqlite::params![branch, id],
    )
    .map_err(|e| format!("Failed to update branch: {}", e))?;

    Ok(branch)
}
```

- [ ] **Step 7: Run Rust tests to verify compilation**

Run: `cargo test --lib -p vibe-os-tauri -- --nocapture 2>&1 | head -30`
Expected: Compilation succeeds

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/context_commands.rs
git commit -m "feat: add RepoRow struct and CRUD commands (save, get_all, delete, set_active, refresh_branch)"
```

---

### Task 3: Branch Worktree Commands and `clone_repo` Update

**Files:**
- Modify: `src-tauri/src/commands/context_commands.rs`

- [ ] **Step 1: Add `list_remote_branches` command**

```rust
#[tauri::command]
pub async fn list_remote_branches(
    app: tauri::AppHandle,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    repo_id: String,
) -> Result<Vec<String>, String> {
    let git_url = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let url: Option<String> = conn
            .query_row("SELECT git_url FROM repos WHERE id = ?1", rusqlite::params![repo_id], |row| row.get(0))
            .map_err(|e| format!("Repo not found: {}", e))?;
        url.ok_or_else(|| "Repo has no git_url (local repo)".to_string())?
    };

    let output = app
        .shell()
        .command("git")
        .args(["ls-remote", "--heads", &git_url])
        .output()
        .await
        .map_err(|e| format!("git ls-remote failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git ls-remote failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let branches: Vec<String> = stdout
        .lines()
        .filter_map(|line| {
            line.split("refs/heads/")
                .nth(1)
                .map(|b| b.trim().to_string())
        })
        .collect();

    Ok(branches)
}
```

- [ ] **Step 2: Add `add_branch_worktree` command**

```rust
#[tauri::command]
pub async fn add_branch_worktree(
    app: tauri::AppHandle,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    repo_id: String,
    branch: String,
) -> Result<RepoRow, String> {
    let parent = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, source, path, git_url, branch, language, file_count, active, parent_id, created_at FROM repos WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        stmt.query_row(rusqlite::params![repo_id], |row| {
            Ok(RepoRow {
                id: row.get(0)?,
                name: row.get(1)?,
                source: row.get(2)?,
                path: row.get(3)?,
                git_url: row.get(4)?,
                branch: row.get(5)?,
                language: row.get(6)?,
                file_count: row.get(7)?,
                active: row.get::<_, i32>(8)? != 0,
                parent_id: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("Parent repo not found: {}", e))?
    };

    if parent.parent_id.is_some() {
        return Err("Cannot create worktree from a branch worktree — use the parent repo".to_string());
    }

    let parent_path = PathBuf::from(&parent.path);
    let worktree_name = format!("{}-{}", parent.name, branch.replace('/', "-"));
    let worktree_path = parent_path
        .parent()
        .unwrap_or(&parent_path)
        .join(&worktree_name);

    if worktree_path.exists() {
        return Err(format!("Worktree path already exists: {}", worktree_path.display()));
    }

    // Fetch the branch first
    let fetch_output = app
        .shell()
        .command("git")
        .args(["-C", &parent.path, "fetch", "origin", &branch])
        .output()
        .await
        .map_err(|e| format!("git fetch failed: {}", e))?;

    if !fetch_output.status.success() {
        let stderr = String::from_utf8_lossy(&fetch_output.stderr);
        return Err(format!("git fetch failed: {}", stderr));
    }

    // Create the worktree
    let output = app
        .shell()
        .command("git")
        .args([
            "-C",
            &parent.path,
            "worktree",
            "add",
            &worktree_path.to_string_lossy(),
            &branch,
        ])
        .output()
        .await
        .map_err(|e| format!("git worktree add failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree add failed: {}", stderr));
    }

    let wt_path_str = worktree_path.to_string_lossy().to_string();
    let child_id = format!("repo:{}", wt_path_str.replace(['/', '\\', ':'], "-"));
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let file_count = count_files(&worktree_path) as i64;
    let language = detect_language(&worktree_path);

    let child = RepoRow {
        id: child_id,
        name: parent.name.clone(),
        source: parent.source.clone(),
        path: wt_path_str,
        git_url: parent.git_url.clone(),
        branch,
        language,
        file_count,
        active: false,
        parent_id: Some(parent.id),
        created_at: now,
    };

    // Save to DB
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO repos (id, name, source, path, git_url, branch, language, file_count, active, parent_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                child.id, child.name, child.source, child.path, child.git_url,
                child.branch, child.language, child.file_count, child.active as i32,
                child.parent_id, child.created_at,
            ],
        )
        .map_err(|e| format!("Failed to save worktree repo: {}", e))?;
    }

    Ok(child)
}
```

- [ ] **Step 3: Add `remove_branch_worktree` command**

```rust
#[tauri::command]
pub async fn remove_branch_worktree(
    app: tauri::AppHandle,
    db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>,
    repo_id: String,
) -> Result<(), String> {
    let (path, parent_path) = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let path: String = conn
            .query_row("SELECT path FROM repos WHERE id = ?1", rusqlite::params![repo_id], |row| row.get(0))
            .map_err(|e| format!("Repo not found: {}", e))?;
        let parent_id: Option<String> = conn
            .query_row("SELECT parent_id FROM repos WHERE id = ?1", rusqlite::params![repo_id], |row| row.get(0))
            .map_err(|e| format!("Repo not found: {}", e))?;
        let parent_id = parent_id.ok_or_else(|| "Not a branch worktree (no parent_id)".to_string())?;
        let parent_path: String = conn
            .query_row("SELECT path FROM repos WHERE id = ?1", rusqlite::params![parent_id], |row| row.get(0))
            .map_err(|e| format!("Parent repo not found: {}", e))?;
        (path, parent_path)
    };

    // Remove the git worktree (--force in case of uncommitted changes)
    let output = app
        .shell()
        .command("git")
        .args(["-C", &parent_path, "worktree", "remove", &path, "--force"])
        .output()
        .await
        .map_err(|e| format!("git worktree remove failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[vibe-os] Warning: git worktree remove failed: {}", stderr);
        // Still delete from DB even if worktree removal fails
    }

    // Delete from DB
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM repos WHERE id = ?1", rusqlite::params![repo_id])
            .map_err(|e| format!("Failed to delete repo: {}", e))?;
    }

    Ok(())
}
```

- [ ] **Step 4: Update `clone_repo` to save to DB**

Modify the existing `clone_repo` function. After the `Ok(RepoMeta { ... })` return is constructed (around line 236-248), replace the return section so it also persists to the DB. Change the return type from `RepoMeta` to `RepoRow`:

Replace the return block (lines ~236-248) with:

```rust
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let repo = RepoRow {
        id: id.clone(),
        name: name.clone(),
        source: "github".to_string(),
        path: local_path_str.clone(),
        git_url: Some(git_url),
        branch,
        language,
        file_count: file_count as i64,
        active: false,
        parent_id: None,
        created_at: now,
    };

    // Persist to DB
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO repos (id, name, source, path, git_url, branch, language, file_count, active, parent_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                repo.id, repo.name, repo.source, repo.path, repo.git_url,
                repo.branch, repo.language, repo.file_count, repo.active as i32,
                repo.parent_id, repo.created_at,
            ],
        )
        .map_err(|e| format!("Failed to save repo to DB: {}", e))?;
    }

    Ok(repo)
```

Also add `db: tauri::State<'_, std::sync::Mutex<rusqlite::Connection>>` to the `clone_repo` function signature.

- [ ] **Step 5: Remove the `get_repos` function**

Delete the entire `get_repos` function (lines ~253-303) and its doc comment.

- [ ] **Step 6: Remove the now-unused `RepoMeta` struct**

Delete lines 159-168 (the `RepoMeta` struct definition). All code now uses `RepoRow`.

- [ ] **Step 7: Run Rust tests to verify compilation**

Run: `cargo test --lib -p vibe-os-tauri -- --nocapture 2>&1 | head -30`
Expected: Compilation succeeds

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/context_commands.rs
git commit -m "feat: add branch worktree commands, update clone_repo to persist to DB, remove get_repos"
```

---

### Task 4: Register New Commands in `lib.rs`

**Files:**
- Modify: `src-tauri/src/lib.rs:107-195`

- [ ] **Step 1: Replace repo command registrations**

In the `generate_handler![]` macro, find these lines (around line 128-129):

```rust
            context_commands::clone_repo,
            context_commands::get_repos,
            context_commands::index_repo,
```

Replace with:

```rust
            context_commands::clone_repo,
            context_commands::index_repo,
            context_commands::save_repo,
            context_commands::get_all_repos,
            context_commands::delete_repo,
            context_commands::set_repo_active,
            context_commands::refresh_repo_branch,
            context_commands::list_remote_branches,
            context_commands::add_branch_worktree,
            context_commands::remove_branch_worktree,
```

- [ ] **Step 2: Run `cargo build` to verify everything links**

Run: `cargo build -p vibe-os-tauri 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register new repo commands, deregister get_repos in invoke_handler"
```

---

### Task 5: Graph Schema and Population for Repos

**Files:**
- Modify: `src-tauri/src/graph/schema.rs:53-68`
- Modify: `src-tauri/src/graph/population.rs`

- [ ] **Step 1: Add edge tables for repo relationships**

In `schema.rs`, add to the `EDGE_TABLES` constant (before the closing `";`):

```rust
DEFINE TABLE IF NOT EXISTS session_uses_repo SCHEMALESS;
DEFINE TABLE IF NOT EXISTS project_contains_repo SCHEMALESS;
DEFINE TABLE IF NOT EXISTS branched_from SCHEMALESS;
```

- [ ] **Step 2: Add indexes for new edges**

In `schema.rs`, add to the `INDEXES` constant (before the closing `";`):

```rust
DEFINE INDEX IF NOT EXISTS idx_repo_source ON repo FIELDS source;
DEFINE INDEX IF NOT EXISTS idx_repo_parent ON repo FIELDS parent_id;
```

- [ ] **Step 3: Add `populate_repo` function**

In `population.rs`, add after the `populate_session` function:

```rust
/// Populate a repo node in the graph.
pub async fn populate_repo(
    db: &Surreal<Db>,
    id: &str,
    name: &str,
    path: &str,
    branch: &str,
    source: &str,
    active: bool,
    language: &str,
    file_count: i64,
    parent_id: Option<&str>,
) -> Result<(), String> {
    let safe_id = sanitize_id(id);
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let repo_json = serde_json::json!({
        "name": name,
        "path": path,
        "branch": branch,
        "source": source,
        "active": active,
        "language": language,
        "file_count": file_count,
        "parent_id": parent_id,
        "created_at": now,
        "updated_at": now,
    });

    // Upsert via DELETE + CREATE
    db.query(&format!("DELETE repo:{safe_id}")).await.ok();
    db.query(&format!(
        "CREATE repo:{safe_id} CONTENT {}",
        serde_json::to_string(&repo_json).unwrap()
    ))
    .await
    .map_err(|e| format!("Failed to create repo node: {e}"))?;

    // Edge: branched_from if this is a worktree
    if let Some(pid) = parent_id {
        let safe_pid = sanitize_id(pid);
        db.query(&format!(
            "RELATE repo:{safe_id}->branched_from->repo:{safe_pid} SET created_at = time::now()"
        ))
        .await
        .ok();
    }

    Ok(())
}
```

- [ ] **Step 4: Add `populate_repo_edge` function**

```rust
/// Create an edge between a repo and a session or project.
pub async fn populate_repo_edge(
    db: &Surreal<Db>,
    edge_table: &str,
    from_table: &str,
    from_id: &str,
    to_table: &str,
    to_id: &str,
) -> Result<(), String> {
    let safe_from = sanitize_id(from_id);
    let safe_to = sanitize_id(to_id);
    db.query(&format!(
        "RELATE {from_table}:{safe_from}->{edge_table}->{to_table}:{safe_to} SET created_at = time::now()"
    ))
    .await
    .map_err(|e| format!("Failed to create {edge_table} edge: {e}"))?;
    Ok(())
}

/// Remove all edges of a given type from/to a repo node.
pub async fn remove_repo_edges(
    db: &Surreal<Db>,
    repo_id: &str,
) -> Result<(), String> {
    let safe_id = sanitize_id(repo_id);
    db.query(&format!("DELETE session_uses_repo WHERE out = repo:{safe_id}"))
        .await.ok();
    db.query(&format!("DELETE project_contains_repo WHERE out = repo:{safe_id}"))
        .await.ok();
    db.query(&format!("DELETE branched_from WHERE in = repo:{safe_id}"))
        .await.ok();
    db.query(&format!("DELETE repo:{safe_id}"))
        .await.ok();
    Ok(())
}
```

- [ ] **Step 5: Add test for `populate_repo`**

Add to the `#[cfg(test)] mod tests` block in `population.rs`:

```rust
    #[tokio::test]
    async fn test_populate_repo() {
        let db = test_db().await;
        populate_repo(
            &db, "repo_1", "my-app", "/path/to/my-app", "main",
            "local", true, "TypeScript", 42, None,
        ).await.unwrap();

        let node = nodes::get_node(&db, "repo", "repo_1").await.unwrap();
        assert!(node.is_some());
        let n = node.unwrap();
        assert_eq!(n["name"], "my-app");
        assert_eq!(n["branch"], "main");
        assert_eq!(n["active"], true);
    }

    #[tokio::test]
    async fn test_populate_repo_with_parent() {
        let db = test_db().await;
        populate_repo(
            &db, "repo_parent", "my-app", "/path/to/my-app", "main",
            "github", true, "Rust", 100, None,
        ).await.unwrap();
        populate_repo(
            &db, "repo_child", "my-app", "/path/to/my-app-feature", "feature-x",
            "github", false, "Rust", 100, Some("repo_parent"),
        ).await.unwrap();

        let child = nodes::get_node(&db, "repo", "repo_child").await.unwrap();
        assert!(child.is_some());
        assert_eq!(child.unwrap()["branch"], "feature-x");
    }
```

- [ ] **Step 6: Run Rust tests**

Run: `cargo test --lib -p vibe-os-tauri -- --nocapture 2>&1 | tail -20`
Expected: All tests pass including new `test_populate_repo` tests

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/graph/schema.rs src-tauri/src/graph/population.rs
git commit -m "feat: add repo graph population with branched_from, session_uses_repo, project_contains_repo edges"
```

---

### Task 6: Frontend Types and Tauri Command Wrappers

**Files:**
- Modify: `src/lib/tauri.ts:1-14` (replace `RepoMeta`), `:238-243` (replace repo commands)
- Modify: `src/stores/types.ts:6-16` (update `Repo`), `:37-43` (update `RepoSlice`), `:570-588` (remove `GlobalRepo`/`GlobalRepoSlice`), `:601-620` (update `AppState`)

- [ ] **Step 1: Replace `RepoMeta` with `RepoRow` in `tauri.ts`**

Replace the `RepoMeta` interface (lines 6-14):

```typescript
export interface RepoRow {
  id: string;
  name: string;
  source: string;
  path: string;
  git_url: string | null;
  branch: string;
  language: string;
  file_count: number;
  active: boolean;
  parent_id: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Replace repo command wrappers in `tauri.ts`**

Replace the `// ── Repo management ──` section (lines 238-243):

```typescript
  // ── Repo management ──
  saveRepo: (repo: RepoRow) =>
    invoke<RepoRow>("save_repo", { repo }),
  getAllRepos: () =>
    invoke<RepoRow[]>("get_all_repos"),
  deleteRepo: (id: string) =>
    invoke<void>("delete_repo", { id }),
  setRepoActive: (id: string, active: boolean) =>
    invoke<void>("set_repo_active", { id, active }),
  refreshRepoBranch: (id: string) =>
    invoke<string>("refresh_repo_branch", { id }),
  cloneRepo: (gitUrl: string) =>
    invoke<RepoRow>("clone_repo", { gitUrl, workspacePath: null }),
  indexRepo: (repoPath: string) => invoke<string>("index_repo", { repoPath }),
  listRemoteBranches: (repoId: string) =>
    invoke<string[]>("list_remote_branches", { repoId }),
  addBranchWorktree: (repoId: string, branch: string) =>
    invoke<RepoRow>("add_branch_worktree", { repoId, branch }),
  removeBranchWorktree: (repoId: string) =>
    invoke<void>("remove_branch_worktree", { repoId }),
```

- [ ] **Step 3: Update `Repo` interface in `types.ts`**

Replace the `Repo` interface (lines 6-16):

```typescript
export interface Repo {
  id: string;
  name: string;
  source: "local" | "github";
  branch: string;
  active: boolean;
  fileCount: number;
  language: string;
  localPath: string;
  gitUrl: string | null;
  parentId: string | null;
  createdAt: string;
  indexSummary: string | null;
}
```

- [ ] **Step 4: Update `RepoSlice` interface in `types.ts`**

Replace the `RepoSlice` interface (lines 37-43):

```typescript
export interface RepoSlice {
  repos: Repo[];
  repoLoading: boolean;

  // CRUD
  loadRepos: () => Promise<void>;
  addRepoLocal: (path: string) => Promise<void>;
  addRepoGithub: (gitUrl: string) => Promise<void>;
  removeRepo: (id: string) => Promise<void>;

  // Toggle & indexing
  toggleRepo: (id: string) => Promise<void>;

  // Branch management
  listRemoteBranches: (repoId: string) => Promise<string[]>;
  addBranch: (repoId: string, branch: string) => Promise<void>;
  removeBranch: (repoId: string) => Promise<void>;

  // Refresh
  refreshRepoBranch: (repoId: string) => Promise<void>;
}
```

- [ ] **Step 5: Remove `GlobalRepo`, `GlobalRepoSlice` from `types.ts`**

Delete the entire `// ── Global Repo Types ──` section (lines 570-588):

```typescript
// DELETE THIS ENTIRE BLOCK:
// ── Global Repo Types ──

export interface GlobalRepo { ... }

export interface GlobalRepoSlice { ... }
```

- [ ] **Step 6: Remove `GlobalRepoSlice` from `AppState` in `types.ts`**

In the `AppState` type union (line 620), remove `GlobalRepoSlice`:

```typescript
export type AppState = SessionSlice &
  RepoSlice &
  SkillSlice &
  PromptSlice &
  EditorSlice &
  ConsoleSlice &
  AgentSlice &
  DecisionSlice &
  AuditSlice &
  EventSlice &
  DiffSlice &
  PreviewSlice &
  WorkspaceSlice &
  LayoutSlice &
  DashboardSlice &
  TokenSlice &
  ProjectSlice &
  ThemeSlice &
  AgentDefinitionSlice;
```

- [ ] **Step 7: Update re-exports in `tauri.ts`**

Find where `RepoMeta` is exported and replace with `RepoRow`. Search for any remaining `RepoMeta` references.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tauri.ts src/stores/types.ts
git commit -m "feat: update frontend types and Tauri wrappers for unified repo system"
```

---

### Task 7: Rewrite `repoSlice.ts`

**Files:**
- Modify: `src/stores/slices/repoSlice.ts` (full rewrite)

- [ ] **Step 1: Write the failing test file**

Create `src/stores/slices/repoSlice.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { create } from "zustand";
import { createRepoSlice } from "./repoSlice";
import type { RepoSlice } from "../types";

const mockRepos = [
  {
    id: "repo-c--users-thoma-projects-my-app",
    name: "my-app",
    source: "local",
    path: "C:\\Users\\Thoma\\projects\\my-app",
    git_url: null,
    branch: "main",
    language: "TypeScript",
    file_count: 42,
    active: false,
    parent_id: null,
    created_at: "2026-04-04T00:00:00Z",
  },
];

vi.mock("../../lib/tauri", () => ({
  commands: {
    getAllRepos: vi.fn().mockResolvedValue(mockRepos),
    saveRepo: vi.fn().mockImplementation((repo) => Promise.resolve(repo)),
    deleteRepo: vi.fn().mockResolvedValue(undefined),
    setRepoActive: vi.fn().mockResolvedValue(undefined),
    indexRepo: vi.fn().mockResolvedValue("Indexed 42 files"),
    cloneRepo: vi.fn().mockResolvedValue({
      id: "repo-c--clone-test",
      name: "cloned",
      source: "github",
      path: "C:\\clone\\test",
      git_url: "https://github.com/org/cloned",
      branch: "main",
      language: "Rust",
      file_count: 10,
      active: false,
      parent_id: null,
      created_at: "2026-04-04T00:00:00Z",
    }),
    refreshRepoBranch: vi.fn().mockResolvedValue("develop"),
    listRemoteBranches: vi.fn().mockResolvedValue(["main", "develop", "feature-x"]),
    addBranchWorktree: vi.fn().mockResolvedValue({
      id: "repo-c--clone-test-feature-x",
      name: "cloned",
      source: "github",
      path: "C:\\clone\\test-feature-x",
      git_url: "https://github.com/org/cloned",
      branch: "feature-x",
      language: "Rust",
      file_count: 10,
      active: false,
      parent_id: "repo-c--clone-test",
      created_at: "2026-04-04T00:00:00Z",
    }),
    removeBranchWorktree: vi.fn().mockResolvedValue(undefined),
    updateSessionRepos: vi.fn().mockResolvedValue(undefined),
    logAction: vi.fn().mockResolvedValue(undefined),
  },
}));

function createTestStore() {
  return create<RepoSlice>()(
    (...a) => ({
      ...createRepoSlice(...(a as Parameters<typeof createRepoSlice>)),
    }),
  );
}

describe("repoSlice (unified)", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    vi.clearAllMocks();
  });

  it("starts with empty repos", () => {
    expect(store.getState().repos).toHaveLength(0);
    expect(store.getState().repoLoading).toBe(false);
  });

  it("loadRepos populates from backend", async () => {
    await store.getState().loadRepos();
    expect(store.getState().repos).toHaveLength(1);
    expect(store.getState().repos[0].name).toBe("my-app");
    expect(store.getState().repos[0].source).toBe("local");
  });

  it("addRepoLocal adds a local repo", async () => {
    await store.getState().addRepoLocal("C:\\Users\\Thoma\\projects\\new-app");
    const repos = store.getState().repos;
    expect(repos).toHaveLength(1);
    expect(repos[0].source).toBe("local");
    expect(repos[0].localPath).toBe("C:\\Users\\Thoma\\projects\\new-app");
  });

  it("addRepoGithub clones and adds", async () => {
    await store.getState().addRepoGithub("https://github.com/org/cloned");
    const repos = store.getState().repos;
    expect(repos).toHaveLength(1);
    expect(repos[0].source).toBe("github");
    expect(repos[0].name).toBe("cloned");
  });

  it("removeRepo deletes from state", async () => {
    await store.getState().loadRepos();
    expect(store.getState().repos).toHaveLength(1);
    await store.getState().removeRepo("repo-c--users-thoma-projects-my-app");
    expect(store.getState().repos).toHaveLength(0);
  });

  it("toggleRepo flips active and triggers recompose-like flow", async () => {
    await store.getState().loadRepos();
    await store.getState().toggleRepo("repo-c--users-thoma-projects-my-app");
    const repo = store.getState().repos.find((r) => r.id === "repo-c--users-thoma-projects-my-app");
    expect(repo?.active).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/slices/repoSlice.test.ts 2>&1 | tail -15`
Expected: FAIL (the current `repoSlice` doesn't have `addRepoLocal`, `addRepoGithub`, etc.)

- [ ] **Step 3: Rewrite `repoSlice.ts`**

Replace the entire contents of `src/stores/slices/repoSlice.ts`:

```typescript
import type { SliceCreator, RepoSlice, Repo } from "../types";
import { commands, type RepoRow } from "../../lib/tauri";

function repoRowToRepo(row: RepoRow): Repo {
  return {
    id: row.id,
    name: row.name,
    source: row.source as "local" | "github",
    branch: row.branch,
    active: row.active,
    fileCount: row.file_count,
    language: row.language,
    localPath: row.path,
    gitUrl: row.git_url,
    parentId: row.parent_id,
    createdAt: row.created_at,
    indexSummary: null,
  };
}

function generateRepoId(path: string): string {
  return `repo:${path.replace(/[/\\:]/g, "-")}`;
}

export const createRepoSlice: SliceCreator<RepoSlice> = (set, get) => ({
  repos: [],
  repoLoading: false,

  loadRepos: async () => {
    try {
      const rows = await commands.getAllRepos();
      const repos = rows.map(repoRowToRepo);
      set({ repos });
    } catch (err) {
      console.error("Failed to load repos:", err);
    }
  },

  addRepoLocal: async (path: string) => {
    set({ repoLoading: true });
    try {
      const name = path.split(/[\\/]/).pop() || path;
      const id = generateRepoId(path);
      const now = new Date().toISOString();

      const row: RepoRow = {
        id,
        name,
        source: "local",
        path,
        git_url: null,
        branch: "main",
        language: "",
        file_count: 0,
        active: false,
        parent_id: null,
        created_at: now,
      };

      const saved = await commands.saveRepo(row);
      const repo = repoRowToRepo(saved);
      set((state) => ({
        repos: state.repos.some((r) => r.id === repo.id)
          ? state.repos
          : [...state.repos, repo],
        repoLoading: false,
      }));
    } catch (err) {
      set({ repoLoading: false });
      console.error("Failed to add local repo:", err);
    }
  },

  addRepoGithub: async (gitUrl: string) => {
    set({ repoLoading: true });
    try {
      const row = await commands.cloneRepo(gitUrl);
      const repo = repoRowToRepo(row);
      set((state) => ({
        repos: state.repos.some((r) => r.id === repo.id)
          ? state.repos
          : [...state.repos, repo],
        repoLoading: false,
      }));
    } catch (err) {
      set({ repoLoading: false });
      throw err;
    }
  },

  removeRepo: async (id: string) => {
    try {
      await commands.deleteRepo(id);
      set((state) => ({
        repos: state.repos.filter((r) => r.id !== id && r.parentId !== id),
      }));
    } catch (err) {
      console.error("Failed to remove repo:", err);
    }
  },

  toggleRepo: async (id: string) => {
    const repo = get().repos.find((r) => r.id === id);
    if (!repo) return;

    const newActive = !repo.active;

    // Optimistic update
    set((state) => ({
      repos: state.repos.map((r) =>
        r.id === id ? { ...r, active: newActive } : r,
      ),
    }));

    try {
      await commands.setRepoActive(id, newActive);

      // If activating, trigger indexing
      if (newActive) {
        const summary = await commands.indexRepo(repo.localPath);
        set((state) => ({
          repos: state.repos.map((r) =>
            r.id === id ? { ...r, indexSummary: summary } : r,
          ),
        }));
      }

      // Update session-linked repos
      const activeIds = get()
        .repos.filter((r) => r.active)
        .map((r) => r.id);
      await commands.updateSessionRepos(activeIds);

      // Log toggle (fire-and-forget)
      commands
        .logAction(
          "REPO_TOGGLE",
          `${newActive ? "Activated" : "Deactivated"} repo: ${repo.name}`,
          "user",
          JSON.stringify({ repoId: repo.id, active: newActive }),
        )
        .catch(() => {});

      // Recompose prompt
      const recompose = get().recompose;
      if (typeof recompose === "function") {
        await recompose();
      }
    } catch (err) {
      console.error("Failed to toggle repo:", err);
      // Rollback
      set((state) => ({
        repos: state.repos.map((r) =>
          r.id === id ? { ...r, active: !newActive } : r,
        ),
      }));
    }
  },

  listRemoteBranches: async (repoId: string) => {
    return commands.listRemoteBranches(repoId);
  },

  addBranch: async (repoId: string, branch: string) => {
    set({ repoLoading: true });
    try {
      const row = await commands.addBranchWorktree(repoId, branch);
      const repo = repoRowToRepo(row);
      set((state) => ({
        repos: [...state.repos, repo],
        repoLoading: false,
      }));
    } catch (err) {
      set({ repoLoading: false });
      throw err;
    }
  },

  removeBranch: async (repoId: string) => {
    try {
      await commands.removeBranchWorktree(repoId);
      set((state) => ({
        repos: state.repos.filter((r) => r.id !== repoId),
      }));
    } catch (err) {
      console.error("Failed to remove branch worktree:", err);
    }
  },

  refreshRepoBranch: async (repoId: string) => {
    try {
      const newBranch = await commands.refreshRepoBranch(repoId);
      set((state) => ({
        repos: state.repos.map((r) =>
          r.id === repoId ? { ...r, branch: newBranch } : r,
        ),
      }));
    } catch (err) {
      console.error("Failed to refresh branch:", err);
    }
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/stores/slices/repoSlice.test.ts 2>&1 | tail -15`
Expected: All 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/stores/slices/repoSlice.ts src/stores/slices/repoSlice.test.ts
git commit -m "feat: rewrite repoSlice as unified repo system with CRUD, toggle, branch management"
```

---

### Task 8: Delete `globalRepoSlice` and Update Store Composition

**Files:**
- Delete: `src/stores/slices/globalRepoSlice.ts`
- Modify: `src/stores/index.ts:22,49,86-89` (remove globalRepoSlice references)

- [ ] **Step 1: Delete `globalRepoSlice.ts`**

```bash
rm src/stores/slices/globalRepoSlice.ts
```

- [ ] **Step 2: Remove globalRepoSlice from store composition in `index.ts`**

Remove the import (line 22):
```typescript
// DELETE: import { createGlobalRepoSlice } from "./slices/globalRepoSlice";
```

Remove from the store creation (line 49):
```typescript
// DELETE: ...createGlobalRepoSlice(...a),
```

Remove from re-exports (lines 86-89):
```typescript
// DELETE these lines:
// export type {
//   AgentDefinition,
//   AgentDefinitionSlice,
//   GlobalRepo,
//   GlobalRepoSlice,
// } from "./types";
```

Replace with (keep AgentDefinition exports):
```typescript
export type {
  AgentDefinition,
  AgentDefinitionSlice,
} from "./types";
```

- [ ] **Step 3: Run TypeScript type check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Type errors in components that still reference `GlobalRepo` — these will be fixed in the next tasks.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete globalRepoSlice, remove from store composition and exports"
```

---

### Task 9: Update `ResourceCatalog.tsx` — Unified Repo List with Branch UI

**Files:**
- Modify: `src/components/home/ResourceCatalog.tsx`

- [ ] **Step 1: Rewrite ResourceCatalog to use unified repos**

Replace the entire file contents:

```tsx
import { useEffect, useState } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { ResourceSection } from "./ResourceSection";
import { RepoDropZone } from "./RepoDropZone";
import { commands } from "../../lib/tauri";
import type { Repo, Skill, AgentDefinition } from "../../stores/types";
import { RefreshCw, GitBranch, X } from "lucide-react";

interface ResourceCatalogProps {
  checkedRepoIds: Set<string>;
  checkedSkillIds: Set<string>;
  checkedAgentNames: Set<string>;
  onToggleRepo: (id: string) => void;
  onToggleSkill: (id: string) => void;
  onToggleAgent: (name: string) => void;
  onAddReposLocal: () => void;
  onAddReposGithub: () => void;
}

export function ResourceCatalog({
  checkedRepoIds,
  checkedSkillIds,
  checkedAgentNames,
  onToggleRepo,
  onToggleSkill,
  onToggleAgent,
  onAddReposLocal,
  onAddReposGithub,
}: ResourceCatalogProps) {
  const {
    repos,
    skills,
    agentDefinitions,
    loadRepos,
    loadAgentDefinitions,
    addRepoLocal,
  } = useAppStore(
    useShallow((s) => ({
      repos: s.repos,
      skills: s.skills,
      agentDefinitions: s.agentDefinitions,
      loadRepos: s.loadRepos,
      loadAgentDefinitions: s.loadAgentDefinitions,
      addRepoLocal: s.addRepoLocal,
    })),
  );

  useEffect(() => {
    loadRepos();
    loadAgentDefinitions();
  }, [loadRepos, loadAgentDefinitions]);

  // Group repos: parents first, children indented under their parent
  const parentRepos = repos.filter((r) => !r.parentId);
  const childrenOf = (parentId: string) =>
    repos.filter((r) => r.parentId === parentId);

  const activeSkillTokens = skills
    .filter((s) => checkedSkillIds.has(s.id))
    .reduce((sum, s) => sum + s.tokens, 0);

  const formatTokens = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-v-dim font-semibold mb-1">
        Resource Catalog
      </div>
      <div className="text-[10px] text-v-dim mb-4">
        Check resources to include in this project
      </div>

      {/* Repos */}
      <ResourceSection
        title="Repos"
        count={parentRepos.length}
        actions={
          <div className="flex gap-1">
            <button
              onClick={onAddReposLocal}
              className="text-[9px] text-v-dim border border-v-border px-1.5 py-0.5 rounded hover:border-v-borderHi transition-colors"
            >
              Browse
            </button>
            <button
              onClick={onAddReposGithub}
              className="text-[9px] text-v-dim border border-v-border px-1.5 py-0.5 rounded hover:border-v-borderHi transition-colors"
            >
              GitHub
            </button>
          </div>
        }
      >
        <RepoDropZone
          onDrop={(paths) => {
            paths.forEach((p) => {
              addRepoLocal(p).then(() => {
                const newRepos = useAppStore.getState().repos;
                const added = newRepos.find((r) => r.localPath === p);
                if (added) onToggleRepo(added.id);
              });
            });
          }}
        />
        {parentRepos.length === 0 ? (
          <div className="text-center">
            <p className="text-[11px] text-v-dim leading-relaxed">
              No repos yet — browse, paste a GitHub URL, or drop folders above
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {parentRepos.map((repo) => (
              <div key={repo.id}>
                <RepoRow
                  repo={repo}
                  checked={checkedRepoIds.has(repo.id)}
                  onToggle={() => onToggleRepo(repo.id)}
                />
                {childrenOf(repo.id).map((child) => (
                  <div key={child.id} className="ml-4 mt-1">
                    <BranchRow
                      repo={child}
                      checked={checkedRepoIds.has(child.id)}
                      onToggle={() => onToggleRepo(child.id)}
                    />
                  </div>
                ))}
                {repo.source === "github" && (
                  <AddBranchButton repoId={repo.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </ResourceSection>

      {/* Skills */}
      <ResourceSection
        title="Skills"
        count={skills.length}
        badge={activeSkillTokens > 0 ? `${formatTokens(activeSkillTokens)} tokens` : undefined}
      >
        {skills.length === 0 ? (
          <div className="border border-dashed border-v-border rounded-lg p-4 text-center">
            <p className="text-[11px] text-v-dim leading-relaxed">
              Add .md files to<br />~/.vibe-os/skills/
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {skills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                checked={checkedSkillIds.has(skill.id)}
                onToggle={() => onToggleSkill(skill.id)}
              />
            ))}
          </div>
        )}
      </ResourceSection>

      {/* Agents */}
      <ResourceSection
        title="Agents"
        count={agentDefinitions.length}
        badge="~/.vibe-os/agents/"
      >
        {agentDefinitions.length === 0 ? (
          <div className="border border-dashed border-v-border rounded-lg p-4 text-center">
            <p className="text-[11px] text-v-dim leading-relaxed">
              Agents created during sessions<br />will appear here
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {agentDefinitions.map((agent) => (
              <AgentRow
                key={agent.name}
                agent={agent}
                checked={checkedAgentNames.has(agent.name)}
                onToggle={() => onToggleAgent(agent.name)}
              />
            ))}
          </div>
        )}
      </ResourceSection>
    </div>
  );
}

function RepoRow({ repo, checked, onToggle }: { repo: Repo; checked: boolean; onToggle: () => void }) {
  const refreshRepoBranch = useAppStore((s) => s.refreshRepoBranch);
  const removeRepo = useAppStore((s) => s.removeRepo);
  const [pathExists, setPathExists] = useState(true);

  useEffect(() => {
    // Check if path still exists on disk
    commands.readFile(repo.localPath + "/.git/HEAD").then(() => setPathExists(true)).catch(() => setPathExists(false));
  }, [repo.localPath]);

  const isMissing = !pathExists;

  return (
    <label
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
        isMissing
          ? "bg-v-surface/50 border border-v-border opacity-50 cursor-default"
          : checked
            ? "bg-v-accent/8 border border-v-accent/20 cursor-pointer"
            : "bg-v-surface border border-v-border cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={isMissing ? undefined : onToggle}
        disabled={isMissing}
        className="accent-v-accent"
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-v-textHi truncate flex items-center gap-1">
          {repo.name}
          {isMissing && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-v-orangeDim text-v-orange">missing</span>
          )}
        </div>
        <div className="text-[10px] text-v-dim truncate">
          {repo.source === "local" ? "Local" : "GitHub"} · {repo.branch}
          {repo.language && ` · ${repo.language}`}
        </div>
      </div>
      {isMissing && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            removeRepo(repo.id);
          }}
          className="text-v-dim hover:text-v-red p-0.5"
          title="Remove missing repo"
        >
          <X size={10} />
        </button>
      )}
      {!isMissing && repo.source === "local" && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            refreshRepoBranch(repo.id);
          }}
          className="text-v-dim hover:text-v-text p-0.5"
          title="Refresh branch"
        >
          <RefreshCw size={10} />
        </button>
      )}
    </label>
  );
}

function BranchRow({ repo, checked, onToggle }: { repo: Repo; checked: boolean; onToggle: () => void }) {
  const removeBranch = useAppStore((s) => s.removeBranch);

  return (
    <label
      className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-colors text-[11px] ${
        checked ? "bg-v-accent/8 border border-v-accent/20" : "bg-v-surface border border-v-border"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-v-accent"
      />
      <GitBranch size={10} className="text-v-dim shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="text-v-textHi truncate">{repo.branch}</span>
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          removeBranch(repo.id);
        }}
        className="text-v-dim hover:text-v-red p-0.5"
        title="Remove branch worktree"
      >
        <X size={10} />
      </button>
    </label>
  );
}

function AddBranchButton({ repoId }: { repoId: string }) {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { listRemoteBranches, addBranch, repos } = useAppStore(
    useShallow((s) => ({
      listRemoteBranches: s.listRemoteBranches,
      addBranch: s.addBranch,
      repos: s.repos,
    })),
  );

  const existingBranches = new Set(
    repos.filter((r) => r.parentId === repoId || r.id === repoId).map((r) => r.branch),
  );

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const remote = await listRemoteBranches(repoId);
      setBranches(remote.filter((b) => !existingBranches.has(b)));
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (branch: string) => {
    setOpen(false);
    try {
      await addBranch(repoId, branch);
    } catch (err) {
      console.error("Failed to add branch:", err);
    }
  };

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="ml-4 mt-0.5 text-[9px] text-v-dim hover:text-v-accent transition-colors"
      >
        + Branch
      </button>
    );
  }

  return (
    <div className="ml-4 mt-1 bg-v-surface border border-v-border rounded-md p-2 max-h-[120px] overflow-y-auto">
      {loading ? (
        <div className="text-[10px] text-v-dim">Loading branches...</div>
      ) : branches.length === 0 ? (
        <div className="text-[10px] text-v-dim">
          No additional branches
          <button onClick={() => setOpen(false)} className="ml-2 text-v-accent">close</button>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {branches.map((b) => (
            <button
              key={b}
              onClick={() => handleSelect(b)}
              className="text-left text-[10px] text-v-text hover:text-v-accent px-1.5 py-0.5 rounded hover:bg-v-accent/5 transition-colors"
            >
              {b}
            </button>
          ))}
          <button onClick={() => setOpen(false)} className="text-[9px] text-v-dim mt-1">
            cancel
          </button>
        </div>
      )}
    </div>
  );
}

function SkillRow({ skill, checked, onToggle }: { skill: Skill; checked: boolean; onToggle: () => void }) {
  return (
    <label
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        checked ? "bg-v-accent/8 border border-v-accent/20" : "bg-v-surface border border-v-border"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-v-accent"
      />
      <div className="min-w-0">
        <div className="text-xs text-v-textHi truncate">{skill.label}</div>
        <div className="text-[10px] text-v-dim">
          {skill.category} · {skill.tokens} tokens
        </div>
      </div>
    </label>
  );
}

function AgentRow({ agent, checked, onToggle }: { agent: AgentDefinition; checked: boolean; onToggle: () => void }) {
  return (
    <label
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        checked ? "bg-v-accent/8 border border-v-accent/20" : "bg-v-surface border border-v-border"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-v-accent"
      />
      <div className="min-w-0">
        <div className="text-xs text-v-textHi truncate">{agent.name}</div>
        <div className="text-[10px] text-v-dim truncate">{agent.description}</div>
      </div>
    </label>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors in ResourceCatalog (may still have errors in other files — those are next)

- [ ] **Step 3: Commit**

```bash
git add src/components/home/ResourceCatalog.tsx
git commit -m "feat: update ResourceCatalog to use unified repo list with branch UI"
```

---

### Task 10: Update Modals and DropZone

**Files:**
- Modify: `src/components/home/RepoBrowseModal.tsx`
- Modify: `src/components/home/RepoGithubModal.tsx`
- Modify: `src/components/home/RepoDropZone.tsx`

- [ ] **Step 1: Simplify `RepoBrowseModal.tsx`**

Replace the entire file:

```tsx
import { useState } from "react";
import { X } from "lucide-react";
import { showOpenDirectoriesDialog, commands } from "../../lib/tauri";

interface RepoBrowseModalProps {
  onAdd: (paths: string[]) => void;
  onClose: () => void;
}

export function RepoBrowseModal({ onAdd, onClose }: RepoBrowseModalProps) {
  const [selected, setSelected] = useState<{ name: string; path: string; hasGit: boolean }[]>([]);

  const handleBrowse = async () => {
    const paths = await showOpenDirectoriesDialog();
    if (!paths) return;

    const newItems = await Promise.all(
      paths.map(async (p) => {
        const name = p.split(/[\\/]/).pop() || p;
        let hasGit = false;
        try {
          await commands.readFile(p + "/.git/HEAD");
          hasGit = true;
        } catch {
          hasGit = false;
        }
        return { name, path: p, hasGit };
      }),
    );

    setSelected((prev) => {
      const existingPaths = new Set(prev.map((s) => s.path));
      return [...prev, ...newItems.filter((i) => !existingPaths.has(i.path))];
    });
  };

  const handleConfirm = () => {
    onAdd(selected.map((s) => s.path));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-v-bgAlt border border-v-border rounded-xl p-5 w-[420px] max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-semibold text-v-textHi">Add Local Repos</h3>
          <button onClick={onClose} className="text-v-dim hover:text-v-text">
            <X size={14} />
          </button>
        </div>
        <p className="text-[11px] text-v-dim mb-4">Select one or more folders from your machine</p>

        {selected.length > 0 && (
          <div className="bg-v-surface border border-v-border rounded-lg p-3 mb-3 max-h-[200px] overflow-y-auto">
            <div className="text-[10px] uppercase text-v-dim mb-2 tracking-wider">Selected folders</div>
            <div className="flex flex-col gap-1.5">
              {selected.map((item) => (
                <div key={item.path} className="flex items-center justify-between px-2.5 py-2 bg-v-surfaceHi rounded-md border border-v-borderHi">
                  <div>
                    <div className="text-xs text-v-textHi">{item.name}</div>
                    <div className="text-[10px] text-v-dim truncate max-w-[260px]">{item.path}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${item.hasGit ? "bg-v-greenDim text-v-green" : "bg-v-orangeDim text-v-orange"}`}>
                      {item.hasGit ? "git" : "no git"}
                    </span>
                    <button
                      onClick={() => setSelected((prev) => prev.filter((s) => s.path !== item.path))}
                      className="text-v-dim hover:text-v-text text-xs"
                    >
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleBrowse}
            className="flex-1 text-center py-2 border border-dashed border-v-borderHi rounded-lg text-[11px] text-v-dim hover:border-v-accent hover:text-v-text transition-colors"
          >
            {selected.length > 0 ? "+ Browse more" : "Browse folders..."}
          </button>
          {selected.length > 0 && (
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-v-accent text-white rounded-lg text-xs font-medium hover:bg-v-accentHi transition-colors"
            >
              Add {selected.length} repo{selected.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Simplify `RepoGithubModal.tsx`**

Replace the entire file:

```tsx
import { useState, useMemo } from "react";
import { X } from "lucide-react";

interface RepoGithubModalProps {
  onAdd: (gitUrls: string[]) => void;
  onClose: () => void;
}

function parseGithubUrl(url: string): { org: string; name: string } | null {
  const httpsMatch = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (httpsMatch) return { org: httpsMatch[1], name: httpsMatch[2] };
  return null;
}

export function RepoGithubModal({ onAdd, onClose }: RepoGithubModalProps) {
  const [text, setText] = useState("");
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({ url, parsed: parseGithubUrl(url) }));
  }, [text]);

  const validCount = parsed.filter((p) => p.parsed).length;

  const handleConfirm = async () => {
    setCloning(true);
    setError(null);

    const validUrls = parsed.filter((p) => p.parsed).map((p) => p.url);
    onAdd(validUrls);

    if (!error) {
      onClose();
    }
    setCloning(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-v-bgAlt border border-v-border rounded-xl p-5 w-[420px] max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-semibold text-v-textHi">Add GitHub Repos</h3>
          <button onClick={onClose} className="text-v-dim hover:text-v-text">
            <X size={14} />
          </button>
        </div>
        <p className="text-[11px] text-v-dim mb-4">Paste one or more GitHub URLs (one per line)</p>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder={"https://github.com/org/repo\nhttps://github.com/org/another-repo"}
          disabled={cloning}
          rows={4}
          className="w-full bg-v-surface border border-v-border rounded-lg px-3 py-2.5 text-xs text-v-textHi font-mono placeholder:text-v-dim outline-none focus:border-v-accent transition-colors resize-none mb-3 disabled:opacity-50"
        />

        {parsed.length > 0 && (
          <div className="bg-v-surface border border-v-border rounded-lg p-3 mb-3 max-h-[150px] overflow-y-auto">
            <div className="text-[10px] uppercase text-v-dim mb-2 tracking-wider">Will clone</div>
            <div className="flex flex-col gap-1.5">
              {parsed.map(({ url, parsed: p }, i) => (
                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-v-surfaceHi rounded-md border border-v-borderHi">
                  {p ? (
                    <div>
                      <div className="text-xs text-v-textHi">{p.org}/{p.name}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-v-red truncate">{url} (invalid URL)</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-v-red text-[10px] mb-3">{error}</p>}

        <div className="flex justify-end">
          {validCount > 0 && (
            <button
              onClick={handleConfirm}
              disabled={cloning}
              className="px-4 py-2 bg-v-accent text-white rounded-lg text-xs font-medium hover:bg-v-accentHi transition-colors disabled:opacity-50"
            >
              {cloning ? "Cloning..." : `Clone & Add ${validCount} repo${validCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Simplify `RepoDropZone.tsx`**

Replace the entire file:

```tsx
import { useState, useCallback } from "react";

interface RepoDropZoneProps {
  onDrop: (paths: string[]) => void;
}

export function RepoDropZone({ onDrop }: RepoDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const items = e.dataTransfer.files;
      const paths: string[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const path = (item as File & { path?: string }).path;
        if (path) paths.push(path);
      }

      if (paths.length > 0) {
        onDrop(paths);
      }
    },
    [onDrop],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors mb-2 ${
        dragOver
          ? "border-v-accent bg-v-accent/5"
          : "border-v-border"
      }`}
    >
      <p className={`text-[10px] ${dragOver ? "text-v-accentHi font-medium" : "text-v-dim"}`}>
        {dragOver ? "Drop to add repos" : "Drop folders here"}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/home/RepoBrowseModal.tsx src/components/home/RepoGithubModal.tsx src/components/home/RepoDropZone.tsx
git commit -m "refactor: simplify modals and drop zone to return paths/URLs instead of GlobalRepo objects"
```

---

### Task 11: Update `ResourcesTab.tsx` and `ProjectSetupView.tsx`

**Files:**
- Modify: `src/components/panels/ResourcesTab.tsx`
- Modify: `src/components/home/ProjectSetupView.tsx`

- [ ] **Step 1: Update `ResourcesTab.tsx`**

Replace the entire file:

```tsx
import { useState } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { ResourceCatalog } from "../home/ResourceCatalog";
import { RepoBrowseModal } from "../home/RepoBrowseModal";
import { RepoGithubModal } from "../home/RepoGithubModal";

export function ResourcesTab() {
  const { repos, skills, agentDefinitions, toggleRepo, toggleSkill, toggleAgentDefinition, addRepoLocal, addRepoGithub } =
    useAppStore(
      useShallow((s) => ({
        repos: s.repos,
        skills: s.skills,
        agentDefinitions: s.agentDefinitions,
        toggleRepo: s.toggleRepo,
        toggleSkill: s.toggleSkill,
        toggleAgentDefinition: s.toggleAgentDefinition,
        addRepoLocal: s.addRepoLocal,
        addRepoGithub: s.addRepoGithub,
      })),
    );

  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);

  const checkedRepoIds = new Set(repos.filter((r) => r.active).map((r) => r.id));
  const checkedSkillIds = new Set(skills.filter((s) => s.active).map((s) => s.id));
  const checkedAgentNames = new Set(agentDefinitions.filter((a) => a.active).map((a) => a.name));

  return (
    <>
      <ResourceCatalog
        checkedRepoIds={checkedRepoIds}
        checkedSkillIds={checkedSkillIds}
        checkedAgentNames={checkedAgentNames}
        onToggleRepo={toggleRepo}
        onToggleSkill={toggleSkill}
        onToggleAgent={toggleAgentDefinition}
        onAddReposLocal={() => setShowBrowseModal(true)}
        onAddReposGithub={() => setShowGithubModal(true)}
      />

      {showBrowseModal && (
        <RepoBrowseModal
          onAdd={(paths) => {
            paths.forEach((p) => addRepoLocal(p));
          }}
          onClose={() => setShowBrowseModal(false)}
        />
      )}

      {showGithubModal && (
        <RepoGithubModal
          onAdd={(gitUrls) => {
            gitUrls.forEach((url) => addRepoGithub(url));
          }}
          onClose={() => setShowGithubModal(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Update `ProjectSetupView.tsx`**

Replace the entire file:

```tsx
import { useState } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { ResourceCatalog } from "./ResourceCatalog";
import { RepoBrowseModal } from "./RepoBrowseModal";
import { RepoGithubModal } from "./RepoGithubModal";

export function ProjectSetupView() {
  const {
    goHome,
    addProject,
    createWorkspace,
    createClaudeSessionLocal,
    setActiveClaudeSessionId,
    repos,
    toggleRepo,
    addRepoLocal,
    addRepoGithub,
  } = useAppStore(
    useShallow((s) => ({
      goHome: s.goHome,
      addProject: s.addProject,
      createWorkspace: s.createWorkspace,
      createClaudeSessionLocal: s.createClaudeSessionLocal,
      setActiveClaudeSessionId: s.setActiveClaudeSessionId,
      repos: s.repos,
      toggleRepo: s.toggleRepo,
      addRepoLocal: s.addRepoLocal,
      addRepoGithub: s.addRepoGithub,
    })),
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Checked resource state (skills and agents are still local toggle state)
  const [checkedSkillIds, setCheckedSkillIds] = useState<Set<string>>(new Set());
  const [checkedAgentNames, setCheckedAgentNames] = useState<Set<string>>(new Set());

  // Repo checked state is derived from the repo's active flag
  const checkedRepoIds = new Set(repos.filter((r) => r.active).map((r) => r.id));

  // Modal state
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);

  const toggleSet = <T,>(prev: Set<T>, item: T): Set<T> => {
    const next = new Set(prev);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    return next;
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }

    const safeName = trimmed
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!safeName) {
      setError("Invalid project name");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createWorkspace(safeName);
      const workspace = useAppStore.getState().activeWorkspace;
      if (!workspace) throw new Error("Workspace creation failed");

      const sessionId = crypto.randomUUID();
      createClaudeSessionLocal(sessionId, trimmed);

      // Create project
      addProject(trimmed, workspace.path, sessionId);

      // Update project with linked resources and description
      const projects = useAppStore.getState().projects;
      const currentRepos = useAppStore.getState().repos;
      const newProject = projects[projects.length - 1];
      if (newProject) {
        const { saveProjects } = useAppStore.getState();
        const updatedProjects = projects.map((p) =>
          p.id === newProject.id
            ? {
                ...p,
                summary: description,
                linkedRepoIds: currentRepos.filter((r) => r.active).map((r) => r.id),
                linkedSkillIds: Array.from(checkedSkillIds),
                linkedAgentNames: Array.from(checkedAgentNames),
              }
            : p,
        );
        useAppStore.setState({ projects: updatedProjects });
        saveProjects();
      }

      setActiveClaudeSessionId(sessionId);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex h-full">
      {/* Left: Project config */}
      <div className="flex-1 flex flex-col p-8 max-w-[480px]">
        <div className="text-[11px] uppercase tracking-wider text-v-dim font-semibold mb-6">
          New Project
        </div>

        <div className="mb-5">
          <label className="text-xs text-v-text mb-1.5 block">Project name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            placeholder="my-project"
            disabled={submitting}
            autoFocus
            className="w-full bg-v-surface border border-v-border rounded-lg px-3 py-2.5 text-sm text-v-textHi placeholder:text-v-dim outline-none focus:border-v-accent transition-colors disabled:opacity-50"
          />
        </div>

        <div className="mb-5">
          <label className="text-xs text-v-text mb-1.5 block">
            Description <span className="text-v-dim">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            disabled={submitting}
            rows={3}
            className="w-full bg-v-surface border border-v-border rounded-lg px-3 py-2.5 text-[13px] text-v-textHi placeholder:text-v-dim outline-none focus:border-v-accent transition-colors resize-none disabled:opacity-50"
          />
        </div>

        {error && (
          <p className="text-v-red text-[11px] mb-4">{error}</p>
        )}

        <div className="flex-1" />

        <div className="flex gap-3">
          <button
            onClick={goHome}
            disabled={submitting}
            className="px-5 py-2.5 bg-v-surface border border-v-border rounded-lg text-sm text-v-text hover:border-v-borderHi transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting || !name.trim()}
            className="flex-1 px-5 py-2.5 bg-v-accent text-white rounded-lg text-sm font-medium hover:bg-v-accentHi transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>

      {/* Right: Resource catalog */}
      <div className="w-[300px] border-l border-v-border bg-v-bgAlt">
        <ResourceCatalog
          checkedRepoIds={checkedRepoIds}
          checkedSkillIds={checkedSkillIds}
          checkedAgentNames={checkedAgentNames}
          onToggleRepo={toggleRepo}
          onToggleSkill={(id) => setCheckedSkillIds((prev) => toggleSet(prev, id))}
          onToggleAgent={(agentName) => setCheckedAgentNames((prev) => toggleSet(prev, agentName))}
          onAddReposLocal={() => setShowBrowseModal(true)}
          onAddReposGithub={() => setShowGithubModal(true)}
        />
      </div>

      {showBrowseModal && (
        <RepoBrowseModal
          onAdd={(paths) => {
            paths.forEach((p) => addRepoLocal(p));
          }}
          onClose={() => setShowBrowseModal(false)}
        />
      )}
      {showGithubModal && (
        <RepoGithubModal
          onAdd={(gitUrls) => {
            gitUrls.forEach((url) => addRepoGithub(url));
          }}
          onClose={() => setShowGithubModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run full TypeScript check**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: No type errors

- [ ] **Step 4: Run all frontend tests**

Run: `npx vitest run 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/ResourcesTab.tsx src/components/home/ProjectSetupView.tsx
git commit -m "refactor: update ResourcesTab and ProjectSetupView to use unified repo system"
```

---

### Task 12: Project Switch — Deactivate/Reactivate Repos

**Files:**
- Modify: `src/stores/slices/projectSlice.ts:57-61`

- [ ] **Step 1: Update `openProject` to manage repo activation**

Replace the `openProject` action (lines 57-61) in `projectSlice.ts`:

```typescript
  openProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;

    // Deactivate all repos, then reactivate this project's linked repos
    const repos = get().repos;
    const linkedSet = new Set(project.linkedRepoIds);

    // Batch update: deactivate all, activate linked
    const updatedRepos = repos.map((r) => ({
      ...r,
      active: linkedSet.has(r.id),
    }));
    set({ repos: updatedRepos, activeProjectId: id, currentView: "conversation" });

    // Persist active states to DB + recompose prompt
    (async () => {
      try {
        for (const repo of updatedRepos) {
          await commands.setRepoActive(repo.id, repo.active);
        }
        await get().recompose();
      } catch (err) {
        console.error("Failed to update repos on project switch:", err);
      }
    })();
  },
```

Also add the `commands` import at the top of `projectSlice.ts` if not already present:

```typescript
import { commands } from "../../lib/tauri";
```

- [ ] **Step 2: Run frontend tests**

Run: `npx vitest run src/stores/slices/projectSlice.test.ts 2>&1 | tail -10`
Expected: Existing tests still pass

- [ ] **Step 3: Commit**

```bash
git add src/stores/slices/projectSlice.ts
git commit -m "feat: deactivate/reactivate repos on project switch with prompt recompose"
```

---

### Task 13: Final Cleanup and Verification

**Files:**
- Verify: all files compile and tests pass

- [ ] **Step 1: Search for any remaining `GlobalRepo` or `globalRepo` references**

Run: `grep -r "GlobalRepo\|globalRepo\|global_repos\|getRepos\|get_repos" src/ src-tauri/src/ --include="*.ts" --include="*.tsx" --include="*.rs" -l`

Fix any remaining references found.

- [ ] **Step 2: Search for remaining `RepoMeta` references**

Run: `grep -r "RepoMeta" src/ src-tauri/src/ --include="*.ts" --include="*.tsx" --include="*.rs" -l`

Fix any remaining references found (should be zero — all replaced by `RepoRow`).

- [ ] **Step 3: Run full frontend test suite**

Run: `npx vitest run 2>&1`
Expected: All tests pass

- [ ] **Step 4: Run Rust tests**

Run: `cargo test --lib -p vibe-os-tauri 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 5: Run TypeScript type check**

Run: `npx tsc --noEmit 2>&1`
Expected: No errors

- [ ] **Step 6: Build the full app**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 7: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final cleanup — remove all GlobalRepo/RepoMeta references"
```
