use std::collections::HashMap;
use std::path::Path;
use regex::Regex;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

/// Index a local repository directory into the knowledge graph.
/// Walks source files, extracts modules/functions/classes via regex,
/// and creates nodes + structural edges.
pub async fn index_repo(
    db: &Surreal<Db>,
    repo_path: &str,
    session_id: &str,
) -> Result<IndexResult, String> {
    let path = Path::new(repo_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", repo_path));
    }

    let repo_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");

    let safe_id = sanitize_id(repo_name);
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    // Collect all source files
    let mut source_files: Vec<(String, String)> = Vec::new(); // (relative_path, extension)
    walk_source_files(path, path, &mut source_files);

    let total_files = source_files.len() as i64;
    let total_lines: i64 = source_files
        .iter()
        .filter_map(|(rel, _)| {
            let full = path.join(rel);
            std::fs::read_to_string(&full).ok().map(|c| c.lines().count() as i64)
        })
        .sum();

    // Detect primary language
    let mut ext_counts: HashMap<String, usize> = HashMap::new();
    for (_, ext) in &source_files {
        *ext_counts.entry(ext.clone()).or_insert(0) += 1;
    }
    let language = ext_counts
        .into_iter()
        .max_by_key(|(_, c)| *c)
        .map(|(ext, _)| ext_to_language(&ext))
        .unwrap_or("Unknown".to_string());

    // Create repo node
    let repo_json = serde_json::json!({
        "name": repo_name,
        "org": "local",
        "branch": "main",
        "local_path": repo_path,
        "language": language,
        "total_files": total_files,
        "total_lines": total_lines,
        "active": true,
        "created_at": now,
        "updated_at": now,
        "session_id": session_id,
    });

    db.query(&format!("DELETE repo:{safe_id}"))
        .await
        .ok();
    db.query(&format!("CREATE repo:{safe_id} CONTENT {}", serde_json::to_string(&repo_json).unwrap()))
        .await
        .map_err(|e| format!("Failed to create repo node: {e}"))?
        .check()
        .map_err(|e| format!("Failed to create repo node: {e}"))?;

    let mut modules_created = 0i64;
    let mut functions_created = 0i64;
    let mut classes_created = 0i64;
    let mut edges_created = 0i64;

    // Process each source file
    for (rel_path, ext) in &source_files {
        let full_path = path.join(rel_path);
        let content = match std::fs::read_to_string(&full_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mod_name = rel_path
            .replace('\\', "/")
            .replace('/', "_")
            .replace('.', "_");
        let mod_id = sanitize_id(&mod_name);
        let line_count = content.lines().count() as i64;

        // Extract imports
        let imports = extract_imports(&content, ext);

        // Create module node
        let hash = format!("{:x}", md5_hash(&content));
        let mod_json = serde_json::json!({
            "name": rel_path.replace('\\', "/").split('/').last().unwrap_or(&mod_name).replace(&format!(".{}", ext), ""),
            "file_path": rel_path.replace('\\', "/"),
            "repo_id": format!("repo:{safe_id}"),
            "line_count": line_count,
            "imports": imports,
            "hash": hash,
            "created_at": now,
            "updated_at": now,
            "session_id": session_id,
        });

        db.query(&format!("CREATE module:{mod_id} CONTENT {}", serde_json::to_string(&mod_json).unwrap()))
            .await
            .ok();
        modules_created += 1;

        // belongs_to edge: module -> repo
        db.query(&format!("RELATE module:{mod_id}->belongs_to->repo:{safe_id} SET created_at = time::now()"))
            .await
            .ok();
        edges_created += 1;

        // Extract functions and classes based on file type
        let functions = extract_functions(&content, ext);
        let classes = extract_classes(&content, ext);

        for func in &functions {
            let fn_id = sanitize_id(&format!("{mod_id}_{}", func.name));
            let fn_json = serde_json::json!({
                "name": func.name,
                "qualified_name": format!("{}.{}", mod_name, func.name),
                "module_id": format!("module:{mod_id}"),
                "repo_id": format!("repo:{safe_id}"),
                "file_path": rel_path.replace('\\', "/"),
                "line_start": func.line_start,
                "line_end": func.line_end,
                "signature": func.signature,
                "params": [],
                "is_async": func.is_async,
                "is_method": func.is_method,
                "class_name": func.class_name,
                "created_at": now,
                "updated_at": now,
                "session_id": session_id,
            });

            db.query(&format!("CREATE fn_def:{fn_id} CONTENT {}", serde_json::to_string(&fn_json).unwrap()))
                .await
                .ok();
            functions_created += 1;

            // defined_in edge: function -> module
            db.query(&format!("RELATE fn_def:{fn_id}->defined_in->module:{mod_id} SET created_at = time::now()"))
                .await
                .ok();
            // belongs_to edge: function -> repo
            db.query(&format!("RELATE fn_def:{fn_id}->belongs_to->repo:{safe_id} SET created_at = time::now()"))
                .await
                .ok();
            edges_created += 2;
        }

        for cls in &classes {
            let cls_id = sanitize_id(&format!("{mod_id}_{}", cls.name));
            let cls_json = serde_json::json!({
                "name": cls.name,
                "qualified_name": format!("{}.{}", mod_name, cls.name),
                "module_id": format!("module:{mod_id}"),
                "repo_id": format!("repo:{safe_id}"),
                "file_path": rel_path.replace('\\', "/"),
                "line_start": cls.line_start,
                "line_end": cls.line_end,
                "bases": cls.bases,
                "method_count": cls.method_count,
                "created_at": now,
                "updated_at": now,
                "session_id": session_id,
            });

            db.query(&format!("CREATE class:{cls_id} CONTENT {}", serde_json::to_string(&cls_json).unwrap()))
                .await
                .ok();
            classes_created += 1;

            // defined_in edge: class -> module
            db.query(&format!("RELATE class:{cls_id}->defined_in->module:{mod_id} SET created_at = time::now()"))
                .await
                .ok();
            edges_created += 1;
        }
    }

    Ok(IndexResult {
        repo_name: repo_name.to_string(),
        total_files,
        total_lines,
        modules_created,
        functions_created,
        classes_created,
        edges_created,
        language,
    })
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct IndexResult {
    pub repo_name: String,
    pub total_files: i64,
    pub total_lines: i64,
    pub modules_created: i64,
    pub functions_created: i64,
    pub classes_created: i64,
    pub edges_created: i64,
    pub language: String,
}

// ── Extracted structures ──

struct ExtractedFunction {
    name: String,
    line_start: i64,
    line_end: i64,
    signature: String,
    is_async: bool,
    is_method: bool,
    class_name: Option<String>,
}

struct ExtractedClass {
    name: String,
    line_start: i64,
    line_end: i64,
    bases: Vec<String>,
    method_count: i64,
}

// ── File walking ──

fn walk_source_files(root: &Path, dir: &Path, out: &mut Vec<(String, String)>) {
    let skip_dirs = [
        "node_modules", "target", ".git", "__pycache__", "venv", ".venv",
        "dist", "build", ".next", ".svelte-kit", "coverage", ".planning",
        ".claude",
    ];

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if !skip_dirs.contains(&name.as_str()) && !name.starts_with('.') {
                walk_source_files(root, &path, out);
            }
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let source_exts = ["py", "ts", "tsx", "js", "jsx", "rs", "go", "rb"];
            if source_exts.contains(&ext) {
                if let Ok(rel) = path.strip_prefix(root) {
                    out.push((rel.to_string_lossy().to_string(), ext.to_string()));
                }
            }
        }
    }
}

// ── Language detection ──

fn ext_to_language(ext: &str) -> String {
    match ext {
        "py" => "Python",
        "ts" | "tsx" => "TypeScript",
        "js" | "jsx" => "JavaScript",
        "rs" => "Rust",
        "go" => "Go",
        "rb" => "Ruby",
        _ => "Unknown",
    }
    .to_string()
}

// ── Import extraction ──

fn extract_imports(content: &str, ext: &str) -> Vec<String> {
    let mut imports = Vec::new();
    match ext {
        "py" => {
            let re = Regex::new(r"(?m)^(?:from\s+(\S+)\s+import|import\s+(\S+))").unwrap();
            for cap in re.captures_iter(content) {
                if let Some(m) = cap.get(1).or(cap.get(2)) {
                    imports.push(m.as_str().to_string());
                }
            }
        }
        "ts" | "tsx" | "js" | "jsx" => {
            let re = Regex::new(r#"(?m)(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))"#).unwrap();
            for cap in re.captures_iter(content) {
                if let Some(m) = cap.get(1).or(cap.get(2)) {
                    imports.push(m.as_str().to_string());
                }
            }
        }
        "rs" => {
            let re = Regex::new(r"(?m)^use\s+(\S+);").unwrap();
            for cap in re.captures_iter(content) {
                if let Some(m) = cap.get(1) {
                    imports.push(m.as_str().to_string());
                }
            }
        }
        _ => {}
    }
    imports
}

// ── Function extraction ──

fn extract_functions(content: &str, ext: &str) -> Vec<ExtractedFunction> {
    let mut funcs = Vec::new();
    let lines: Vec<&str> = content.lines().collect();

    match ext {
        "py" => {
            let re = Regex::new(r"(?m)^(\s*)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)").unwrap();
            for cap in re.captures_iter(content) {
                let indent = cap.get(1).map(|m| m.as_str().len()).unwrap_or(0);
                let is_async = cap.get(2).is_some();
                let name = cap[3].to_string();
                let params = cap.get(4).map(|m| m.as_str()).unwrap_or("");
                let sig = format!(
                    "{}def {}({})",
                    if is_async { "async " } else { "" },
                    name,
                    params
                );

                let line_start = content[..cap.get(0).unwrap().start()]
                    .lines()
                    .count() as i64
                    + 1;
                let line_end = find_block_end(&lines, line_start as usize - 1, indent);

                funcs.push(ExtractedFunction {
                    name,
                    line_start,
                    line_end: line_end as i64,
                    signature: sig,
                    is_async,
                    is_method: indent > 0,
                    class_name: None,
                });
            }
        }
        "ts" | "tsx" | "js" | "jsx" => {
            // export function / function / async function / const X = =>
            let re = Regex::new(
                r"(?m)^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)|^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\("
            ).unwrap();
            for cap in re.captures_iter(content) {
                let name = cap.get(1).or(cap.get(3))
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default();
                if name.is_empty() { continue; }

                let is_async = cap.get(0).map(|m| m.as_str().contains("async")).unwrap_or(false);
                let line_start = content[..cap.get(0).unwrap().start()]
                    .lines()
                    .count() as i64
                    + 1;

                funcs.push(ExtractedFunction {
                    name: name.clone(),
                    line_start,
                    line_end: line_start + 10, // approximate
                    signature: cap.get(0).map(|m| m.as_str().trim().to_string()).unwrap_or(name),
                    is_async,
                    is_method: false,
                    class_name: None,
                });
            }
        }
        "rs" => {
            let re = Regex::new(r"(?m)^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)").unwrap();
            for cap in re.captures_iter(content) {
                let name = cap[1].to_string();
                let is_async = cap.get(0).map(|m| m.as_str().contains("async")).unwrap_or(false);
                let line_start = content[..cap.get(0).unwrap().start()]
                    .lines()
                    .count() as i64
                    + 1;

                funcs.push(ExtractedFunction {
                    name: name.clone(),
                    line_start,
                    line_end: line_start + 10,
                    signature: cap.get(0).map(|m| m.as_str().trim().to_string()).unwrap_or(name),
                    is_async,
                    is_method: false,
                    class_name: None,
                });
            }
        }
        _ => {}
    }
    funcs
}

// ── Class extraction ──

fn extract_classes(content: &str, ext: &str) -> Vec<ExtractedClass> {
    let mut classes = Vec::new();
    let lines: Vec<&str> = content.lines().collect();

    match ext {
        "py" => {
            let re = Regex::new(r"(?m)^class\s+(\w+)\s*(?:\(([^)]*)\))?:").unwrap();
            for cap in re.captures_iter(content) {
                let name = cap[1].to_string();
                let bases: Vec<String> = cap.get(2)
                    .map(|m| m.as_str().split(',').map(|s| s.trim().to_string()).collect())
                    .unwrap_or_default();

                let line_start = content[..cap.get(0).unwrap().start()]
                    .lines()
                    .count() as i64
                    + 1;
                let line_end = find_block_end(&lines, line_start as usize - 1, 0);

                // Count methods
                let block = &content[cap.get(0).unwrap().start()..];
                let method_re = Regex::new(r"(?m)^\s+(?:async\s+)?def\s+").unwrap();
                let method_count = method_re.find_iter(block).count() as i64;

                classes.push(ExtractedClass {
                    name,
                    line_start,
                    line_end: line_end as i64,
                    bases,
                    method_count,
                });
            }
        }
        "ts" | "tsx" | "js" | "jsx" => {
            let re = Regex::new(r"(?m)^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?").unwrap();
            for cap in re.captures_iter(content) {
                let name = cap[1].to_string();
                let bases: Vec<String> = cap.get(2)
                    .map(|m| vec![m.as_str().to_string()])
                    .unwrap_or_default();

                let line_start = content[..cap.get(0).unwrap().start()]
                    .lines()
                    .count() as i64
                    + 1;

                classes.push(ExtractedClass {
                    name,
                    line_start,
                    line_end: line_start + 20,
                    bases,
                    method_count: 0,
                });
            }
        }
        _ => {}
    }
    classes
}

// ── Helpers ──

fn find_block_end(lines: &[&str], start: usize, base_indent: usize) -> usize {
    for i in (start + 1)..lines.len() {
        let line = lines[i];
        if line.trim().is_empty() {
            continue;
        }
        let indent = line.len() - line.trim_start().len();
        if indent <= base_indent && !line.trim().is_empty() {
            return i;
        }
    }
    lines.len()
}

fn sanitize_id(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '_' })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

fn md5_hash(content: &str) -> u64 {
    // Simple hash for change detection (not crypto-grade)
    let mut hash: u64 = 0;
    for byte in content.bytes() {
        hash = hash.wrapping_mul(31).wrapping_add(byte as u64);
    }
    hash
}
