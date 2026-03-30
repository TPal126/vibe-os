import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// VIBE OS — Agentic Development Operating System
// Aesthetic: Mission Control / Industrial Precision
// Dark, information-dense, but never cluttered
// ═══════════════════════════════════════════════════════════════

const FM = "'JetBrains Mono', 'Fira Code', monospace";
const FU = "'Instrument Sans', 'DM Sans', system-ui, sans-serif";
const FD = "'Space Mono', monospace";

const C = {
  bg: "#08090d",
  bgAlt: "#0c0e14",
  surface: "#12141c",
  surfaceHi: "#181b26",
  surfaceActive: "#1e2233",
  border: "#1f2336",
  borderHi: "#2a2f45",
  borderAccent: "#3d4470",
  text: "#b8bdd4",
  textDim: "#5a6080",
  textBright: "#e4e7f2",
  white: "#f0f2fa",
  accent: "#5b7cfa",
  accentBright: "#7d9bff",
  accentDim: "#2a3466",
  green: "#34d399",
  greenDim: "#0f2922",
  greenBorder: "#1a4a38",
  yellow: "#fbbf24",
  yellowDim: "#2a2410",
  yellowBorder: "#4a3d1a",
  orange: "#f97316",
  red: "#ef4444",
  redDim: "#2a1010",
  purple: "#a78bfa",
  purpleDim: "#1e1a33",
  cyan: "#22d3ee",
  cyanDim: "#0a2a30",
};

// ─── Micro Components ───
const Badge = ({ children, color = C.accent, bg = C.accentDim }) => (
  <span style={{
    fontSize: 10, fontFamily: FU, fontWeight: 600, padding: "2px 7px",
    borderRadius: 4, background: bg, color, letterSpacing: "0.04em",
    lineHeight: "16px", display: "inline-flex", alignItems: "center", whiteSpace: "nowrap",
  }}>{children}</span>
);

const Dot = ({ color = C.green, pulse }) => (
  <span style={{
    width: 6, height: 6, borderRadius: "50%", background: color,
    display: "inline-block", flexShrink: 0,
    animation: pulse ? "pulse 2s infinite" : "none",
  }} />
);

const IconBtn = ({ icon, onClick, title, size = 13, active }) => {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: active ? C.accentDim : h ? C.surfaceActive : "transparent",
        border: "none", color: active ? C.accentBright : h ? C.text : C.textDim,
        cursor: "pointer", borderRadius: 4, padding: "3px 5px", fontSize: size,
        lineHeight: 1, transition: "all 0.12s", display: "flex", alignItems: "center",
      }}>{icon}</button>
  );
};

const SectionHead = ({ title, icon, right, compact }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: compact ? "5px 10px" : "6px 12px", background: C.bgAlt,
    borderBottom: `1px solid ${C.border}`, flexShrink: 0, minHeight: compact ? 28 : 32,
  }}>
    <div style={{
      fontSize: 10, fontFamily: FU, fontWeight: 700, color: C.textDim,
      letterSpacing: "0.08em", textTransform: "uppercase", display: "flex",
      alignItems: "center", gap: 5,
    }}>
      {icon && <span style={{ fontSize: 11, opacity: 0.7 }}>{icon}</span>}
      {title}
    </div>
    {right && <div style={{ display: "flex", gap: 3, alignItems: "center" }}>{right}</div>}
  </div>
);

const TabStrip = ({ tabs, active, onChange, accent = C.accent }) => (
  <div style={{
    display: "flex", borderBottom: `1px solid ${C.border}`, background: C.bg,
    flexShrink: 0, overflow: "hidden",
  }}>
    {tabs.map(t => {
      const sel = t.id === active;
      return (
        <div key={t.id} onClick={() => onChange(t.id)} style={{
          padding: "6px 13px", fontSize: 11, fontFamily: FU, fontWeight: sel ? 600 : 400,
          color: sel ? C.textBright : C.textDim, cursor: "pointer", userSelect: "none",
          borderBottom: sel ? `2px solid ${accent}` : "2px solid transparent",
          transition: "all 0.12s", letterSpacing: "0.01em",
        }}>
          {t.icon && <span style={{ marginRight: 5, fontSize: 10, opacity: 0.6 }}>{t.icon}</span>}
          {t.label}
          {t.count != null && <span style={{ marginLeft: 5, fontSize: 9, opacity: 0.5 }}>({t.count})</span>}
        </div>
      );
    })}
  </div>
);

// ─── Resizable Panes ───
function Resizable({ dir = "col", children, sizes: initSizes, mins }) {
  const [sizes, setSizes] = useState(initSizes);
  const ref = useRef(null);
  const drag = useRef(null);
  const isCol = dir === "col";

  const onDown = (i, e) => {
    e.preventDefault();
    drag.current = { i, start: isCol ? e.clientX : e.clientY, sizes: [...sizes] };
    const onMove = (e2) => {
      if (!drag.current || !ref.current) return;
      const total = isCol ? ref.current.offsetWidth : ref.current.offsetHeight;
      const d = ((isCol ? e2.clientX : e2.clientY) - drag.current.start) / total * 100;
      const ns = [...drag.current.sizes];
      ns[drag.current.i] = Math.max(mins[drag.current.i] || 8, drag.current.sizes[drag.current.i] + d);
      ns[drag.current.i + 1] = Math.max(mins[drag.current.i + 1] || 8, drag.current.sizes[drag.current.i + 1] - d);
      setSizes(ns);
    };
    const onUp = () => { drag.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: isCol ? "row" : "column", flex: 1, overflow: "hidden" }}>
      {children.map((ch, i) => (
        <div key={i} style={{ display: "flex", flexDirection: isCol ? "row" : "column", [isCol ? "width" : "height"]: `${sizes[i]}%`, overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>{ch}</div>
          {i < children.length - 1 && (
            <div onMouseDown={(e) => onDown(i, e)} style={{
              [isCol ? "width" : "height"]: 2, cursor: isCol ? "col-resize" : "row-resize",
              background: C.border, flexShrink: 0, transition: "background 0.15s", zIndex: 5,
            }} onMouseEnter={e => e.target.style.background = C.accent} onMouseLeave={e => e.target.style.background = C.border} />
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FEATURE PANELS
// ═══════════════════════════════════════════════════════════════

// ─── Jira Integration ───
function JiraPanel() {
  const [filter, setFilter] = useState("sprint");
  const tickets = [
    { key: "DATA-1247", title: "Refactor submission pipeline ingestion layer", status: "In Progress", priority: "high", assignee: "TM", points: 5, linked: true },
    { key: "DATA-1251", title: "Add schema validation to CSV intake", status: "To Do", priority: "med", assignee: "JK", points: 3, linked: false },
    { key: "DATA-1248", title: "XGBoost churn model feature engineering", status: "In Progress", priority: "high", assignee: "TM", points: 8, linked: true },
    { key: "DATA-1253", title: "Fix PCOA API timeout on large payloads", status: "In Review", priority: "critical", assignee: "AM", points: 3, linked: false },
    { key: "DATA-1249", title: "Update mart documentation for Q3 schema", status: "Done", priority: "low", assignee: "AL", points: 2, linked: false },
  ];
  const prioColor = { critical: C.red, high: C.orange, med: C.yellow, low: C.textDim };
  const statusColor = { "In Progress": C.accent, "To Do": C.textDim, "In Review": C.purple, "Done": C.green };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: "6px 10px", borderBottom: `1px solid ${C.border}` }}>
        {["sprint", "mine", "linked"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            fontSize: 10, fontFamily: FU, fontWeight: 600, padding: "3px 8px",
            borderRadius: 4, border: "none", cursor: "pointer",
            background: filter === f ? C.accentDim : "transparent",
            color: filter === f ? C.accentBright : C.textDim,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>{f}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {tickets.map(t => (
          <div key={t.key} style={{
            padding: "7px 10px", display: "flex", alignItems: "flex-start", gap: 8,
            borderBottom: `1px solid ${C.border}08`, cursor: "pointer", transition: "background 0.1s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceHi}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ width: 3, height: 28, borderRadius: 2, background: prioColor[t.priority], flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontFamily: FM, color: C.accent }}>{t.key}</span>
                {t.linked && <span style={{ fontSize: 8, color: C.green }}>● LINKED</span>}
              </div>
              <div style={{ fontSize: 11.5, fontFamily: FU, color: C.text, lineHeight: "15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                <Badge color={statusColor[t.status]} bg={`${statusColor[t.status]}18`}>{t.status}</Badge>
                <span style={{ fontSize: 9, color: C.textDim, fontFamily: FM }}>{t.points}pt</span>
                <span style={{ fontSize: 9, color: C.textDim, marginLeft: "auto" }}>{t.assignee}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Live Agent Stream ───
function AgentStream() {
  const [events] = useState([
    { t: "11:42:03", type: "think", text: "Analyzing submission_pipeline.py — 4 functions need refactoring for async support" },
    { t: "11:42:05", type: "decision", text: "Will use asyncio.gather() for parallel API calls rather than sequential — ~3x throughput", confidence: 0.92 },
    { t: "11:42:07", type: "file", text: "Modified: src/pipeline.py", diff: "+14 / -8 lines" },
    { t: "11:42:08", type: "file", text: "Modified: src/utils.py", diff: "+3 / -1 lines" },
    { t: "11:42:10", type: "test", text: "Running: pytest tests/test_pipeline.py", status: "pass" },
    { t: "11:42:12", type: "jira", text: "Updated DATA-1247 → In Review", status: "done" },
    { t: "11:42:14", type: "think", text: "Moving to DATA-1248: XGBoost feature engineering. Loading sales dataset schema..." },
    { t: "11:42:16", type: "decision", text: "Adding interaction features: revenue × frequency, tenure × nps_score", confidence: 0.87 },
    { t: "11:42:18", type: "file", text: "Created: src/features.py", diff: "+62 lines" },
    { t: "11:42:20", type: "preview", text: "Frontend preview updated — new feature importance chart rendering" },
  ]);

  const typeStyle = {
    think: { icon: "◉", color: C.accent, label: "THINK" },
    decision: { icon: "◆", color: C.yellow, label: "DECIDE" },
    file: { icon: "▪", color: C.green, label: "FILE" },
    test: { icon: "▸", color: C.cyan, label: "TEST" },
    jira: { icon: "◈", color: C.purple, label: "JIRA" },
    preview: { icon: "◐", color: C.orange, label: "PREVIEW" },
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
      {events.map((ev, i) => {
        const s = typeStyle[ev.type];
        return (
          <div key={i} style={{
            display: "flex", gap: 8, padding: "5px 10px", fontSize: 11.5,
            borderBottom: `1px solid ${C.border}06`, fontFamily: FU,
            animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both`,
          }}>
            <span style={{ fontFamily: FM, fontSize: 9, color: C.textDim, minWidth: 52, paddingTop: 2 }}>{ev.t}</span>
            <span style={{ color: s.color, fontSize: 10, paddingTop: 2 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <span style={{ color: C.text, lineHeight: "16px" }}>{ev.text}</span>
              {ev.diff && <span style={{ marginLeft: 6, fontSize: 10, color: C.green, fontFamily: FM }}>{ev.diff}</span>}
              {ev.confidence != null && (
                <span style={{ marginLeft: 6 }}>
                  <Badge color={ev.confidence > 0.9 ? C.green : C.yellow} bg={ev.confidence > 0.9 ? C.greenDim : C.yellowDim}>
                    {(ev.confidence * 100).toFixed(0)}% conf
                  </Badge>
                </span>
              )}
              {ev.status === "pass" && <Badge color={C.green} bg={C.greenDim}>PASS</Badge>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Skills & Context Manager ───
function SkillsPanel() {
  const [skills, setSkills] = useState([
    { id: "pandas", label: "Pandas Mastery", cat: "data", active: true, tokens: "2.1k" },
    { id: "xgboost", label: "XGBoost Patterns", cat: "ml", active: true, tokens: "1.8k" },
    { id: "async", label: "Async Python", cat: "core", active: true, tokens: "1.2k" },
    { id: "testing", label: "Pytest Best Practices", cat: "core", active: false, tokens: "1.5k" },
    { id: "fastapi", label: "FastAPI Conventions", cat: "web", active: false, tokens: "2.4k" },
    { id: "sql", label: "SQL Optimization", cat: "data", active: true, tokens: "1.9k" },
    { id: "aws", label: "AWS Bedrock Patterns", cat: "infra", active: false, tokens: "3.1k" },
    { id: "docker", label: "Docker & Deploy", cat: "infra", active: false, tokens: "1.7k" },
    { id: "viz", label: "Matplotlib/Seaborn", cat: "viz", active: true, tokens: "1.3k" },
    { id: "typing", label: "Type Hints & Mypy", cat: "core", active: false, tokens: "0.9k" },
  ]);

  const toggle = (id) => setSkills(skills.map(s => s.id === id ? { ...s, active: !s.active } : s));
  const totalTokens = skills.filter(s => s.active).reduce((sum, s) => sum + parseFloat(s.tokens), 0).toFixed(1);
  const catColor = { data: C.cyan, ml: C.yellow, core: C.accent, web: C.green, infra: C.purple, viz: C.orange };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "6px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontFamily: FM, color: C.textDim }}>
          Context: <span style={{ color: C.accent }}>{totalTokens}k</span> tokens loaded
        </span>
        <div style={{ width: 60, height: 4, borderRadius: 2, background: C.border, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, (totalTokens / 20) * 100)}%`, height: "100%", background: totalTokens > 15 ? C.orange : C.accent, borderRadius: 2, transition: "width 0.3s" }} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {skills.map(s => (
          <div key={s.id} onClick={() => toggle(s.id)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "5px 10px",
            cursor: "pointer", transition: "background 0.1s",
            opacity: s.active ? 1 : 0.45,
          }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceHi}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{
              width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${s.active ? C.accent : C.borderHi}`,
              background: s.active ? C.accentDim : "transparent", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 9, color: C.accentBright, transition: "all 0.15s",
            }}>{s.active ? "✓" : ""}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontFamily: FU, color: C.text }}>{s.label}</div>
            </div>
            <Badge color={catColor[s.cat]} bg={`${catColor[s.cat]}15`}>{s.cat}</Badge>
            <span style={{ fontSize: 9, fontFamily: FM, color: C.textDim, minWidth: 28, textAlign: "right" }}>{s.tokens}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Repo Manager ───
function RepoManager() {
  const [repos, setRepos] = useState([
    { name: "trv-superpowers", org: "travelers", branch: "main", active: true, files: 127, lang: "Python" },
    { name: "submission-mart", org: "travelers", branch: "feat/async-intake", active: true, files: 84, lang: "Python" },
    { name: "attune-ios", org: "personal", branch: "develop", active: false, files: 203, lang: "Swift" },
    { name: "pcoa-assistant", org: "travelers", branch: "main", active: false, files: 42, lang: "Python" },
    { name: "jobpilot", org: "personal", branch: "main", active: false, files: 31, lang: "Python" },
  ]);

  const toggleRepo = (name) => setRepos(repos.map(r => r.name === name ? { ...r, active: !r.active } : r));

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
      {repos.map(r => (
        <div key={r.name} onClick={() => toggleRepo(r.name)} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
          cursor: "pointer", transition: "all 0.12s", opacity: r.active ? 1 : 0.4,
          borderLeft: r.active ? `2px solid ${C.accent}` : "2px solid transparent",
        }}
          onMouseEnter={e => e.currentTarget.style.background = C.surfaceHi}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div style={{
            width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${r.active ? C.green : C.borderHi}`,
            background: r.active ? C.greenDim : "transparent", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 9, color: C.green, transition: "all 0.15s",
          }}>{r.active ? "✓" : ""}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontFamily: FM, color: r.active ? C.textBright : C.text }}>{r.name}</div>
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: FU, marginTop: 1 }}>
              {r.org} · <span style={{ color: C.purple }}>{r.branch}</span> · {r.files} files
            </div>
          </div>
          <Badge color={r.lang === "Python" ? C.yellow : C.orange} bg={r.lang === "Python" ? C.yellowDim : `${C.orange}15`}>{r.lang}</Badge>
        </div>
      ))}
    </div>
  );
}

// ─── Architecture Visualizer ───
function ArchViewer() {
  const nodes = [
    { id: "api", label: "FastAPI\nGateway", x: 160, y: 30, color: C.green, w: 80, h: 36 },
    { id: "agent", label: "Agent\nOrchestrator", x: 140, y: 100, color: C.accent, w: 96, h: 36, pulse: true },
    { id: "bedrock", label: "AWS\nBedrock", x: 50, y: 170, color: C.purple, w: 72, h: 36 },
    { id: "rag", label: "RAG\nRetriever", x: 170, y: 170, color: C.cyan, w: 72, h: 36 },
    { id: "db", label: "Submission\nMart", x: 280, y: 170, color: C.orange, w: 72, h: 36 },
    { id: "pipeline", label: "Intake\nPipeline", x: 280, y: 100, color: C.yellow, w: 72, h: 36 },
    { id: "charter", label: "Domain\nCharter", x: 50, y: 100, color: C.textDim, w: 72, h: 36 },
  ];

  const edges = [
    ["api", "agent"], ["agent", "bedrock"], ["agent", "rag"], ["agent", "db"],
    ["api", "pipeline"], ["pipeline", "db"], ["charter", "agent"],
  ];

  const getCenter = (n) => ({ cx: n.x + n.w / 2, cy: n.y + n.h / 2 });

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, position: "relative" }}>
      <svg viewBox="0 0 400 230" style={{ width: "100%", maxWidth: 500, height: "auto" }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Edges */}
        {edges.map(([from, to], i) => {
          const a = getCenter(nodes.find(n => n.id === from));
          const b = getCenter(nodes.find(n => n.id === to));
          return <line key={i} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={C.borderHi} strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />;
        })}
        {/* Nodes */}
        {nodes.map(n => {
          const { cx, cy } = getCenter(n);
          return (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="6" fill={C.surface}
                stroke={n.color} strokeWidth={n.pulse ? "1.5" : "1"} opacity={n.pulse ? 1 : 0.8}
                filter={n.pulse ? "url(#glow)" : undefined}
              />
              {n.label.split("\n").map((line, li) => (
                <text key={li} x={cx} y={n.y + 14 + li * 12} textAnchor="middle"
                  fill={n.color} fontSize="8.5" fontFamily="system-ui" fontWeight="600">{line}</text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Micro-Decision Log ───
function DecisionLog() {
  const decisions = [
    { t: "11:42:05", decision: "Use asyncio.gather() over sequential calls", rationale: "3x throughput for independent API requests", confidence: 0.92, impact: "perf", reversible: true },
    { t: "11:42:16", decision: "Add interaction features to XGBoost model", rationale: "Revenue × frequency captures spending velocity; tenure × NPS captures loyalty signal", confidence: 0.87, impact: "accuracy", reversible: true },
    { t: "11:41:33", decision: "Keep pandas over polars for this dataset", rationale: "1247 rows — polars overhead not justified. Team familiarity with pandas API.", confidence: 0.95, impact: "dx", reversible: true },
    { t: "11:40:58", decision: "Stratified train/test split", rationale: "Churn class imbalance (18% positive). Stratify preserves ratio.", confidence: 0.98, impact: "accuracy", reversible: false },
    { t: "11:40:22", decision: "XGBoost over LightGBM", rationale: "Better handling of missing values in revenue column. Marginal accuracy difference at this scale.", confidence: 0.78, impact: "accuracy", reversible: true },
  ];

  const impactColor = { perf: C.cyan, accuracy: C.green, dx: C.accent, security: C.red };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
      {decisions.map((d, i) => (
        <div key={i} style={{
          padding: "7px 10px", borderBottom: `1px solid ${C.border}08`,
          borderLeft: `2px solid ${impactColor[d.impact] || C.textDim}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 9, fontFamily: FM, color: C.textDim }}>{d.t}</span>
            <Badge color={impactColor[d.impact]} bg={`${impactColor[d.impact]}15`}>{d.impact}</Badge>
            <Badge color={d.confidence > 0.9 ? C.green : d.confidence > 0.8 ? C.yellow : C.orange}
              bg={d.confidence > 0.9 ? C.greenDim : d.confidence > 0.8 ? C.yellowDim : `${C.orange}15`}>
              {(d.confidence * 100).toFixed(0)}%
            </Badge>
            {d.reversible && <span style={{ fontSize: 8, color: C.textDim }}>↺ reversible</span>}
          </div>
          <div style={{ fontSize: 12, fontFamily: FU, color: C.textBright, lineHeight: "16px", marginBottom: 2 }}>{d.decision}</div>
          <div style={{ fontSize: 10.5, fontFamily: FU, color: C.textDim, lineHeight: "14px" }}>{d.rationale}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Audit Trail ───
function AuditLog() {
  const entries = [
    { t: "11:42:20", action: "PREVIEW_UPDATE", detail: "Feature importance chart re-rendered", user: "agent" },
    { t: "11:42:18", action: "FILE_CREATE", detail: "src/features.py (62 lines)", user: "agent" },
    { t: "11:42:12", action: "JIRA_UPDATE", detail: "DATA-1247 → In Review", user: "agent" },
    { t: "11:42:10", action: "TEST_RUN", detail: "pytest tests/test_pipeline.py — 12/12 passed", user: "agent" },
    { t: "11:42:08", action: "FILE_MODIFY", detail: "src/utils.py (+3/-1)", user: "agent" },
    { t: "11:42:07", action: "FILE_MODIFY", detail: "src/pipeline.py (+14/-8)", user: "agent" },
    { t: "11:41:55", action: "PROMPT_SENT", detail: "System + 3 skills + 2 repos loaded (8.2k tokens)", user: "system" },
    { t: "11:41:50", action: "SESSION_START", detail: "Work session initialized with 2 active repos", user: "tom" },
    { t: "11:41:48", action: "SKILL_TOGGLE", detail: "Enabled: Pandas Mastery, XGBoost Patterns", user: "tom" },
    { t: "11:41:45", action: "REPO_ACTIVATE", detail: "trv-superpowers, submission-mart", user: "tom" },
  ];

  const actionColor = {
    FILE_CREATE: C.green, FILE_MODIFY: C.green, JIRA_UPDATE: C.purple,
    TEST_RUN: C.cyan, PROMPT_SENT: C.accent, SESSION_START: C.yellow,
    SKILL_TOGGLE: C.orange, REPO_ACTIVATE: C.accent, PREVIEW_UPDATE: C.orange,
  };

  return (
    <div style={{ flex: 1, overflow: "auto", fontFamily: FM, fontSize: 10.5 }}>
      {entries.map((e, i) => (
        <div key={i} style={{
          display: "flex", gap: 8, padding: "4px 10px", borderBottom: `1px solid ${C.border}06`,
          alignItems: "flex-start",
        }}>
          <span style={{ color: C.textDim, minWidth: 52, fontSize: 9, paddingTop: 1 }}>{e.t}</span>
          <span style={{ color: actionColor[e.action] || C.text, minWidth: 90, fontSize: 9, fontWeight: 600, paddingTop: 1 }}>{e.action}</span>
          <span style={{ color: C.text, flex: 1, fontFamily: FU, fontSize: 11 }}>{e.detail}</span>
          <span style={{ color: C.textDim, fontSize: 9 }}>{e.user}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Prompt Layer ───
function PromptLayer() {
  const [activePrompt, setActivePrompt] = useState("system");
  const prompts = {
    system: `You are an expert Python developer working within VIBE OS.\nYou have access to the active repos, loaded skills, and Jira board.\n\nRules:\n- Always explain micro-decisions with confidence scores\n- Update Jira tickets as work progresses\n- Run tests after every file modification\n- Log all architectural decisions\n- Prefer explicit over implicit patterns`,
    task: `Current task: DATA-1248 XGBoost churn model\n\nContext:\n- Dataset: data/sales_q3.csv (1247 rows × 14 cols)\n- Target: churned (boolean, 18% positive rate)\n- Required: Feature engineering, train/test split, model fit, evaluation\n- Skills loaded: Pandas Mastery, XGBoost Patterns, Matplotlib`,
    repo: `Active repos indexed:\n\n[trv-superpowers] 127 files\n  Architecture: 3-layer context model\n  Key modules: agents/, context/, retrieval/\n\n[submission-mart] 84 files\n  Architecture: ETL pipeline\n  Key modules: intake/, transform/, validate/`,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: "6px 10px", borderBottom: `1px solid ${C.border}` }}>
        {["system", "task", "repo"].map(p => (
          <button key={p} onClick={() => setActivePrompt(p)} style={{
            fontSize: 10, fontFamily: FU, fontWeight: 600, padding: "3px 8px",
            borderRadius: 4, border: "none", cursor: "pointer",
            background: activePrompt === p ? C.accentDim : "transparent",
            color: activePrompt === p ? C.accentBright : C.textDim,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>{p}</button>
        ))}
      </div>
      <div style={{
        flex: 1, overflow: "auto", padding: 10,
        fontFamily: FM, fontSize: 11.5, color: C.text,
        lineHeight: "18px", whiteSpace: "pre-wrap",
      }}>
        {prompts[activePrompt]}
      </div>
    </div>
  );
}

// ─── Live Preview ───
function LivePreview() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <div style={{
        padding: "8px 12px", background: "#ffffff08", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.red }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.yellow }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
        </div>
        <span style={{ fontSize: 10, fontFamily: FM, color: C.textDim }}>localhost:3000/dashboard</span>
        <Dot color={C.green} pulse />
        <span style={{ fontSize: 9, color: C.green, fontFamily: FU }}>Live</span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        {/* Mock rendered dashboard */}
        <div style={{ width: "100%", maxWidth: 340 }}>
          <div style={{ fontSize: 14, fontFamily: FU, fontWeight: 700, color: C.textBright, marginBottom: 12 }}>Churn Prediction Dashboard</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Accuracy", value: "92.4%", color: C.green },
              { label: "Precision", value: "89.1%", color: C.accent },
              { label: "Recall", value: "86.7%", color: C.yellow },
            ].map(m => (
              <div key={m.label} style={{ background: C.surface, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 9, color: C.textDim, fontFamily: FU, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontFamily: FM, fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: C.surface, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: FU, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Feature Importance</div>
            {[
              { name: "days_since_last_order", val: 0.23 },
              { name: "payment_failures", val: 0.19 },
              { name: "revenue × frequency", val: 0.15 },
              { name: "support_tickets", val: 0.12 },
              { name: "login_frequency", val: 0.09 },
            ].map(f => (
              <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontFamily: FM, color: C.text, minWidth: 140 }}>{f.name}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.border, overflow: "hidden" }}>
                  <div style={{ width: `${f.val * 100 / 0.23}%`, height: "100%", background: `linear-gradient(90deg, ${C.accent}, ${C.accentBright})`, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 9, fontFamily: FM, color: C.textDim, minWidth: 28, textAlign: "right" }}>{f.val.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Claude Chat (enhanced) ───
function ClaudeChat() {
  const [msgs] = useState([
    { role: "system", text: "Session started · 2 repos · 5 skills · DATA-1247, DATA-1248 linked" },
    { role: "user", text: "Refactor the submission pipeline for async, then build the churn model. Update Jira as you go." },
    { role: "assistant", text: "I'll tackle these sequentially:\n\n① DATA-1247: Async refactor of pipeline.py\n② DATA-1248: XGBoost churn model\n\nStarting with the pipeline. I see 4 sequential API calls that can be parallelized...", working: true },
  ]);
  const [input, setInput] = useState("");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <div style={{ flex: 1, overflow: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "92%" }}>
            {m.role === "system" ? (
              <div style={{ fontSize: 10, fontFamily: FM, color: C.textDim, textAlign: "center", padding: "4px 12px", background: C.surfaceHi, borderRadius: 6 }}>
                {m.text}
              </div>
            ) : (
              <div style={{
                padding: "8px 11px", borderRadius: 10,
                borderTopLeftRadius: m.role === "user" ? 10 : 3,
                borderTopRightRadius: m.role === "user" ? 3 : 10,
                background: m.role === "user" ? C.accentDim : C.surfaceHi,
                border: `1px solid ${m.role === "user" ? C.accent + "25" : C.border}`,
                fontSize: 12.5, fontFamily: FU, color: C.text, lineHeight: "18px", whiteSpace: "pre-wrap",
              }}>
                {m.text}
                {m.working && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <Dot color={C.accent} pulse />
                    <span style={{ fontSize: 10, color: C.accent, fontFamily: FM }}>Working...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{
        padding: "8px 10px", borderTop: `1px solid ${C.border}`, background: C.surface,
        display: "flex", gap: 6, alignItems: "center",
      }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, padding: "0 10px",
        }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Describe intent..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: C.text, fontFamily: FU, fontSize: 12.5, padding: "9px 0",
            }} />
        </div>
        <button style={{
          background: C.accent, border: "none", borderRadius: 6, color: "#fff",
          padding: "8px 14px", cursor: "pointer", fontFamily: FU, fontSize: 11, fontWeight: 600,
        }}>Send</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN LAYOUT
// ═══════════════════════════════════════════════════════════════

export default function VibeOS() {
  const [leftTab, setLeftTab] = useState("repos");
  const [rightTab, setRightTab] = useState("stream");
  const [bottomTab, setBottomTab] = useState("decisions");
  const [centerTab, setCenterTab] = useState("preview");

  return (
    <div style={{
      width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
      background: C.bg, color: C.text, overflow: "hidden", fontFamily: FU,
    }}>
      {/* ─── Title Bar ─── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "5px 14px", background: C.bgAlt, borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 16, fontWeight: 800, fontFamily: FD,
            background: `linear-gradient(135deg, ${C.accentBright}, ${C.cyan})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>VIBE OS</span>
          <span style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.04em" }}>Agentic Development System</span>
          <Badge color={C.green} bg={C.greenDim}>● Session Active</Badge>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Badge color={C.text} bg={C.surfaceHi}>2 repos</Badge>
          <Badge color={C.text} bg={C.surfaceHi}>5 skills</Badge>
          <Badge color={C.text} bg={C.surfaceHi}>8.2k ctx</Badge>
          <IconBtn icon="⚙" title="Settings" />
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <Resizable dir="col" sizes={[22, 40, 38]} mins={[15, 25, 20]}>
        {/* LEFT COLUMN: Repos, Skills, Jira, Prompt Layer */}
        <Resizable dir="row" sizes={[55, 45]} mins={[30, 25]}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <TabStrip tabs={[
              { id: "repos", label: "Repos", icon: "◈" },
              { id: "skills", label: "Skills", icon: "◉" },
              { id: "jira", label: "Jira", icon: "◆" },
              { id: "prompt", label: "Prompt", icon: "▤" },
            ]} active={leftTab} onChange={setLeftTab} />
            {leftTab === "repos" && <><SectionHead title="Work Session Repos" icon="◈" right={<IconBtn icon="+" title="Add repo" />} /><RepoManager /></>}
            {leftTab === "skills" && <><SectionHead title="Context Skills" icon="◉" right={<IconBtn icon="+" title="Add skill" />} /><SkillsPanel /></>}
            {leftTab === "jira" && <><SectionHead title="Jira Board" icon="◆" right={<IconBtn icon="⟳" title="Sync" />} /><JiraPanel /></>}
            {leftTab === "prompt" && <><SectionHead title="Prompt Layer" icon="▤" right={<IconBtn icon="✎" title="Edit" />} /><PromptLayer /></>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <SectionHead title="Claude" icon="✦" right={<><IconBtn icon="⊞" title="New" /><IconBtn icon="⚙" title="Model" /></>} />
            <ClaudeChat />
          </div>
        </Resizable>

        {/* CENTER COLUMN: Preview / Architecture / Editor */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <TabStrip tabs={[
            { id: "preview", label: "Live Preview", icon: "◐" },
            { id: "arch", label: "Architecture", icon: "◇" },
            { id: "editor", label: "Editor", icon: "▪" },
          ]} active={centerTab} onChange={setCenterTab} accent={C.green} />
          {centerTab === "preview" && <><SectionHead title="Live Frontend" icon="◐" compact right={<><Dot color={C.green} pulse /><span style={{ fontSize: 9, color: C.green }}>Auto-refresh</span></>} /><LivePreview /></>}
          {centerTab === "arch" && <><SectionHead title="Repo Architecture" icon="◇" compact right={<><IconBtn icon="⟳" title="Rebuild" /><IconBtn icon="⤢" title="Expand" /></>} /><ArchViewer /></>}
          {centerTab === "editor" && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 12 }}>
              Monaco Editor integration here
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Agent Stream + Decisions + Audit */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <TabStrip tabs={[
            { id: "stream", label: "Agent Stream", icon: "▸" },
            { id: "decisions", label: "Decisions", icon: "◆", count: 5 },
            { id: "audit", label: "Audit Log", icon: "▤" },
          ]} active={rightTab} onChange={setRightTab} accent={C.cyan} />
          {rightTab === "stream" && <><SectionHead title="Live Agent Activity" icon="▸" compact right={<><Dot color={C.green} pulse /><span style={{ fontSize: 9, color: C.green }}>Streaming</span></>} /><AgentStream /></>}
          {rightTab === "decisions" && <><SectionHead title="Micro-Decision Record" icon="◆" compact right={<IconBtn icon="⤓" title="Export" />} /><DecisionLog /></>}
          {rightTab === "audit" && <><SectionHead title="Session Audit Trail" icon="▤" compact right={<IconBtn icon="⤓" title="Export" />} /><AuditLog /></>}
        </div>
      </Resizable>

      {/* ─── Status Bar ─── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "3px 14px", background: C.bgAlt, borderTop: `1px solid ${C.border}`,
        fontSize: 10, fontFamily: FM, color: C.textDim, flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot color={C.green} /> Python 3.12</span>
          <span>|</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot color={C.green} /> Claude Code</span>
          <span>|</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot color={C.green} /> Jira Synced</span>
          <span>|</span>
          <span>2 repos active</span>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <span>Session: 12m 34s</span>
          <span>|</span>
          <span>5 decisions · 10 actions</span>
          <span>|</span>
          <span>API: 14.2k tokens</span>
        </div>
      </div>

      {/* Animations + Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; scrollbar-width: thin; scrollbar-color: ${C.borderHi} transparent; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.borderHi}; border-radius: 4px; }
      `}</style>
    </div>
  );
}
