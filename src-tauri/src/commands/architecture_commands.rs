use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
pub struct ArchNode {
    pub id: String,
    pub label: String,
    pub node_type: String, // "module" | "class" | "function"
    pub repo_name: String,
    pub file_path: String,
    pub function_list: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct ArchEdge {
    pub from_id: String,
    pub to_id: String,
    pub edge_type: String, // "import"
}

#[derive(Serialize)]
pub struct ArchGraph {
    pub nodes: Vec<ArchNode>,
    pub edges: Vec<ArchEdge>,
}

#[tauri::command]
pub fn analyze_architecture(repo_paths: Vec<String>) -> Result<ArchGraph, String> {
    let mut nodes: Vec<ArchNode> = Vec::new();
    let mut edges: Vec<ArchEdge> = Vec::new();
    let mut module_map: HashMap<String, String> = HashMap::new(); // module_name -> node_id

    let import_re = Regex::new(r"^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))")
        .map_err(|e| format!("Regex error: {}", e))?;
    let class_re =
        Regex::new(r"^class\s+(\w+)").map_err(|e| format!("Regex error: {}", e))?;
    let func_re =
        Regex::new(r"^def\s+(\w+)").map_err(|e| format!("Regex error: {}", e))?;

    for repo_path in &repo_paths {
        let repo_name = std::path::Path::new(repo_path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        for entry in WalkDir::new(repo_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext == "py")
                    .unwrap_or(false)
                    && !e.path().to_string_lossy().contains("__pycache__")
                    && !e.path().to_string_lossy().contains(".venv")
                    && !e.path().to_string_lossy().contains("node_modules")
            })
        {
            let file_path = entry.path().to_string_lossy().to_string();
            let rel_path = entry
                .path()
                .strip_prefix(repo_path)
                .unwrap_or(entry.path())
                .to_string_lossy()
                .to_string();

            // Derive module name from relative path
            let module_name = rel_path
                .trim_end_matches(".py")
                .replace(['/', '\\'], ".")
                .trim_end_matches(".__init__")
                .to_string();

            let content = match std::fs::read_to_string(entry.path()) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let mut function_list: Vec<String> = Vec::new();
            let mut classes: Vec<String> = Vec::new();
            let mut imports: Vec<String> = Vec::new();

            for line in content.lines() {
                let trimmed = line.trim_start();

                if let Some(caps) = import_re.captures(trimmed) {
                    let imported =
                        caps.get(1).or(caps.get(2)).map(|m| m.as_str().to_string());
                    if let Some(imp) = imported {
                        // Only take the top-level module for edges
                        let top = imp.split('.').next().unwrap_or(&imp).to_string();
                        imports.push(top);
                    }
                }

                if let Some(caps) = class_re.captures(trimmed) {
                    if let Some(name) = caps.get(1) {
                        classes.push(name.as_str().to_string());
                    }
                }

                if let Some(caps) = func_re.captures(trimmed) {
                    if let Some(name) = caps.get(1) {
                        // Skip dunder methods for cleaner graph
                        let fname = name.as_str();
                        if !fname.starts_with("__") || fname == "__init__" {
                            function_list.push(fname.to_string());
                        }
                    }
                }
            }

            let node_id = format!("{}:{}", repo_name, module_name);
            module_map.insert(module_name.clone(), node_id.clone());

            nodes.push(ArchNode {
                id: node_id.clone(),
                label: module_name,
                node_type: "module".to_string(),
                repo_name: repo_name.clone(),
                file_path: file_path.clone(),
                function_list: function_list.clone(),
            });

            // Add class nodes
            for class_name in &classes {
                let class_id = format!("{}:{}:{}", repo_name, rel_path, class_name);
                nodes.push(ArchNode {
                    id: class_id,
                    label: class_name.clone(),
                    node_type: "class".to_string(),
                    repo_name: repo_name.clone(),
                    file_path: file_path.clone(),
                    function_list: vec![],
                });
            }

            // Store imports for edge creation
            for imp in imports {
                edges.push(ArchEdge {
                    from_id: node_id.clone(),
                    to_id: imp, // placeholder -- resolved below
                    edge_type: "import".to_string(),
                });
            }
        }
    }

    // Resolve edge targets: match import names to known module node IDs
    let resolved_edges: Vec<ArchEdge> = edges
        .into_iter()
        .filter_map(|mut edge| {
            // Try to find a module that matches the import
            let target_id = module_map.iter().find_map(|(name, id)| {
                let short_name = name.split('.').last().unwrap_or(name);
                if short_name == edge.to_id
                    || name == &edge.to_id
                    || name.ends_with(&format!(".{}", edge.to_id))
                {
                    Some(id.clone())
                } else {
                    None
                }
            });
            if let Some(tid) = target_id {
                edge.to_id = tid;
                Some(edge)
            } else {
                None // External import, drop the edge
            }
        })
        .collect();

    Ok(ArchGraph {
        nodes,
        edges: resolved_edges,
    })
}
