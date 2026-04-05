# Unified Repo Management

**Date:** 2026-04-04
**Status:** Approved

## Problem

VIBE OS has two disconnected repo stores that never got wired together:

- `globalRepoSlice` — stores repos added via Browse/GitHub/Drop as JSON in SQLite settings. Used by the home screen `ResourceCatalog` and `ProjectSetupView`. These repos are just metadata — they never get indexed or appear in the workspace.
- `repoSlice` — stores repos loaded from the workspace `repos/` directory via Rust `get_repos(workspacePath)`. These are the ones that get indexed, toggled active, and injected into the composed prompt. Used by the settings panel `ResourcesTab`.

The result: checking a repo checkbox on the home screen does nothing. The repo exists in `globalRepos` but never reaches `repoSlice` where all the real logic lives.

## Design Decisions

1. **Local repos referenced in-place** — no copy/symlink into workspace. The absolute path on disk is the source of truth for indexing.
2. **Single global repo pool** — all repos visible everywhere, toggle any on/off mid-flight regardless of which project is active. Not project-scoped.
3. **DB is sole source of truth** — no filesystem scanning. Every repo enters the system via an explicit add action that writes to SQLite.
4. **Proper `repos` table** — migration v8, replaces both the JSON-blob-in-settings and the filesystem scanner.
5. **Multi-branch support via git worktrees** — GitHub-cloned repos can track multiple branches simultaneously. Local repos reflect HEAD read-only.
6. **Graph population** — repos become first-class nodes in SurrealDB with session/project edges.

## Data Model

### `repos` Table (Migration v8)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PRIMARY KEY | Deterministic: `repo:{normalized-path}` |
| `name` | TEXT NOT NULL | Folder name or GitHub repo name |
| `source` | TEXT NOT NULL | `"local"` or `"github"` |
| `path` | TEXT NOT NULL UNIQUE | Absolute local path (main clone or worktree) |
| `git_url` | TEXT | Only for GitHub-cloned repos |
| `branch` | TEXT NOT NULL | Tracked branch name |
| `language` | TEXT NOT NULL DEFAULT '' | Auto-detected primary language |
| `file_count` | INTEGER NOT NULL DEFAULT 0 | File count at time of add |
| `active` | INTEGER NOT NULL DEFAULT 0 | 0/1 global toggle for prompt injection |
| `parent_id` | TEXT | FK to parent repo `id` (NULL = primary clone, set = branch worktree) |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |

`parent_id` links branch worktrees back to the original clone. `my-repo @ main` has `parent_id = NULL`; `my-repo @ feature-x` has `parent_id` pointing to the main row.

### Migration SQL

```sql
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
```

Migrate existing data: read the `global_repos` JSON from the `settings` table, INSERT each entry into `repos`, then DELETE the `global_repos` setting key.

## Rust Backend

### New Commands (`context_commands.rs`)

- **`save_repo(repo: RepoRow)`** — INSERT OR REPLACE into `repos` table. Returns the saved row.
- **`get_all_repos()`** — SELECT * FROM repos ORDER BY created_at. Replaces both `get_repos(workspace_path)` and the JSON settings load.
- **`delete_repo(id: String)`** — DELETE FROM repos WHERE id = ?. Also removes child worktree rows (CASCADE by parent_id).
- **`set_repo_active(id: String, active: bool)`** — UPDATE repos SET active = ? WHERE id = ?.
- **`refresh_repo_branch(id: String)`** — Re-reads HEAD for the repo's path, updates `branch` column. For local repos this picks up branch switches the user made externally.
- **`list_remote_branches(repo_id: String)`** — Looks up the repo's `git_url`, runs `git ls-remote --heads`, returns `Vec<String>` of branch names.
- **`add_branch_worktree(repo_id: String, branch: String)`** — Creates a git worktree at `{parent-path}/../{name}-{branch}`, inserts a child row in `repos` with `parent_id` set. Returns the new `RepoRow`.
- **`remove_branch_worktree(repo_id: String)`** — Runs `git worktree remove`, deletes the DB row.

### Modified Commands

- **`clone_repo`** — After cloning, also calls `save_repo` to persist the repo to the DB. Currently it just returns `RepoMeta` and leaves persistence to the frontend.

### Removed Commands

- **`get_repos(workspace_path)`** — The filesystem scanner is no longer needed. All repos come from the DB.

### Kept As-Is

- **`index_repo(repo_path)`** — Still walks the local path to build a prompt summary string. No changes needed.
- **`update_session_repos(active_ids)`** — Still stores active repo IDs on the session. No changes needed.

### New Rust Struct

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct RepoRow {
    pub id: String,
    pub name: String,
    pub source: String,       // "local" | "github"
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

## Frontend

### `repoSlice.ts` — Unified Slice

Replace the current implementation. New shape:

```typescript
interface RepoSlice {
  repos: Repo[];
  repoLoading: boolean;

  // CRUD
  loadRepos: () => Promise<void>;              // get_all_repos()
  addRepoLocal: (path: string) => Promise<void>;  // build metadata, save_repo
  addRepoGithub: (gitUrl: string) => Promise<void>; // clone_repo (now auto-saves)
  removeRepo: (id: string) => Promise<void>;   // delete_repo

  // Toggle & indexing
  toggleRepo: (id: string) => Promise<void>;   // set_repo_active + index + recompose

  // Branch management
  listRemoteBranches: (repoId: string) => Promise<string[]>;
  addBranch: (repoId: string, branch: string) => Promise<void>;
  removeBranch: (repoId: string) => Promise<void>;

  // Refresh
  refreshRepoBranch: (repoId: string) => Promise<void>;
}
```

The `Repo` type gains `source`, `gitUrl`, `parentId`, `createdAt` fields. Drops `org` (not used) and `indexSummary` (ephemeral, not stored).

### Delete `globalRepoSlice.ts`

Remove the file, remove `GlobalRepo` and `GlobalRepoSlice` from `types.ts`, remove from store composition in `index.ts`, remove from re-exports.

### Component Changes

**`ResourceCatalog.tsx`:**
- Read from `repos` instead of `globalRepos`
- Calls `loadRepos` on mount instead of `loadGlobalRepos`
- Group repos: parent repos at top level, child branches indented underneath
- GitHub repos get a "+ Branch" button
- Local repos show branch as read-only text with refresh icon
- Missing-path repos render dimmed with a "missing" badge (path doesn't exist on disk)

**`RepoBrowseModal.tsx`:**
- `onAdd` callback changes to accept `string[]` (paths) instead of `GlobalRepo[]`
- Parent component calls `addRepoLocal(path)` for each path

**`RepoGithubModal.tsx`:**
- `onAdd` callback changes to accept `string[]` (git URLs) instead of `GlobalRepo[]`
- Parent component calls `addRepoGithub(url)` for each URL

**`ResourcesTab.tsx`:**
- Already uses `repoSlice` — just needs to ensure it reads the same unified `repos` list
- Toggle calls remain the same (`toggleRepo`)

**`ProjectSetupView.tsx`:**
- Checkbox toggle calls `toggleRepo(id)` directly instead of managing local `checkedRepoIds` state
- `Project.linkedRepoIds` populated from `repos.filter(r => r.active).map(r => r.id)` at project creation time

**`RepoDropZone.tsx`:**
- `onDrop` callback simplified — extracts paths, parent calls `addRepoLocal` for each

## Graph Population

When repos are added, toggled, or removed, populate SurrealDB:

### Nodes
- **`repo:{id}`** — fields: `name`, `path`, `branch`, `source`, `active`, `language`, `file_count`

### Edges
- **`session_uses_repo`** — created when a repo is toggled active within a session. From session node to repo node.
- **`project_contains_repo`** — created when a repo is linked to a project (either at creation or mid-flight). From project node to repo node.
- **`branched_from`** — from child worktree repo node to parent repo node. Created when `add_branch_worktree` is called.

### Lifecycle
- **Add repo:** Create `repo` node
- **Toggle active:** Create/delete `session_uses_repo` edge
- **Link to project:** Create `project_contains_repo` edge
- **Add branch:** Create child `repo` node + `branched_from` edge
- **Remove repo:** Delete node and all connected edges (children first if parent)

Follows existing `population.rs` fire-and-forget pattern — graph writes happen after the SQLite write succeeds, failures are logged but don't block the operation.

## Error Handling

- **Local path no longer exists:** Show a "missing" badge in the UI (dimmed row, no toggle allowed). Don't auto-delete — drive might be unmounted. User can manually remove.
- **Duplicate add:** `path` is UNIQUE — upsert silently. No error toast needed.
- **Remove repo:** Deletes from DB only. Never deletes files from disk. For GitHub clones, the cloned folder stays.
- **Project switch:** Deactivate all repos, then activate the incoming project's `linkedRepoIds`, fire one `recompose()` at the end.
- **Worktree creation failure:** Show error in modal (branch might not exist remotely, disk full, etc). Don't create the DB row.
- **Worktree removal failure:** Log warning, still delete the DB row. Orphaned worktree directories can be cleaned up manually.

## Files Touched

### Rust (src-tauri/src/)
- `db.rs` — migration v8
- `commands/context_commands.rs` — new commands, modify `clone_repo`, remove `get_repos`
- `graph/schema.rs` — `repo` table, `branched_from`/`session_uses_repo`/`project_contains_repo` edges and indexes
- `graph/population.rs` — `populate_repo`, `populate_repo_edge` functions
- `graph/nodes.rs` — repo node CRUD if not using population.rs directly
- `lib.rs` — register new commands, deregister `get_repos`

### Frontend (src/)
- `stores/slices/repoSlice.ts` — full rewrite
- `stores/slices/globalRepoSlice.ts` — delete
- `stores/types.ts` — update `Repo`, remove `GlobalRepo`/`GlobalRepoSlice`, update `AppState`
- `stores/index.ts` — remove globalRepoSlice composition + re-exports
- `lib/tauri.ts` — add new command wrappers, remove old ones
- `components/home/ResourceCatalog.tsx` — read from unified repos, add branch UI
- `components/home/RepoBrowseModal.tsx` — simplify callback
- `components/home/RepoGithubModal.tsx` — simplify callback
- `components/home/RepoDropZone.tsx` — simplify callback
- `components/home/ProjectSetupView.tsx` — use toggleRepo directly
- `components/panels/ResourcesTab.tsx` — verify it reads unified list

~17 files total.
