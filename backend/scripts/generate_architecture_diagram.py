import os
from pathlib import Path

def generate_svg():
    # Setup layout dimensions
    width = 1920
    height = 1200

    # Start constructing SVG string
    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">')
    
    # 1. Definitions (gradients, markers, filters, styles)
    svg.append('''  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#090d16"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>

    <!-- Component Box Gradients -->
    <linearGradient id="frontend-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0.05"/>
    </linearGradient>
    <linearGradient id="backend-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#6d28d9" stop-opacity="0.05"/>
    </linearGradient>
    <linearGradient id="storage-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#047857" stop-opacity="0.05"/>
    </linearGradient>
    <linearGradient id="agent-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ec4899" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#be185d" stop-opacity="0.05"/>
    </linearGradient>
    <linearGradient id="llm-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#64748b" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#475569" stop-opacity="0.05"/>
    </linearGradient>

    <!-- Glow/Drop Shadows -->
    <filter id="glow-frontend" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0ea5e9" flood-opacity="0.3"/>
    </filter>
    <filter id="glow-backend" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#8b5cf6" flood-opacity="0.3"/>
    </filter>
    <filter id="glow-storage" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#10b981" flood-opacity="0.3"/>
    </filter>
    <filter id="glow-agent" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#ec4899" flood-opacity="0.3"/>
    </filter>
    <filter id="glow-llm" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#64748b" flood-opacity="0.2"/>
    </filter>

    <!-- Arrow Markers -->
    <marker id="arrow-blue" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="#38bdf8"/>
    </marker>
    <marker id="arrow-purple" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="#a78bfa"/>
    </marker>
    <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="#34d399"/>
    </marker>
    <marker id="arrow-pink" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="#f472b6"/>
    </marker>
    <marker id="arrow-slate" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8"/>
    </marker>

    <!-- Global Styles -->
    <style>
      .main-title { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 38px; font-weight: 800; fill: #ffffff; letter-spacing: -0.5px; }
      .subtitle { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 500; fill: #94a3b8; }
      .group-title { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 18px; font-weight: 700; fill: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px; }
      .node-title { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 700; fill: #ffffff; }
      .node-desc { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 400; fill: #cbd5e1; }
      .stage-title { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 700; fill: #f472b6; }
      .stage-desc { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 500; fill: #e2e8f0; }
      .legend-text { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 600; fill: #94a3b8; }
    </style>
  </defs>''')

    # 2. Main Background
    svg.append(f'  <rect width="{width}" height="{height}" fill="url(#bg-grad)"/>')

    # 3. Canvas Grid Guidelines (subtle grid to match modern aesthetics)
    svg.append('  <g stroke="#ffffff" stroke-opacity="0.02" stroke-width="1">')
    for x in range(100, width, 100):
        svg.append(f'    <line x1="{x}" y1="0" x2="{x}" y2="{height}"/>')
    for y in range(100, height, 100):
        svg.append(f'    <line x1="0" y1="{y}" x2="{width}" y2="{y}"/>')
    svg.append('  </g>')

    # 4. Header Section
    svg.append('''  <g transform="translate(80, 80)">
    <text x="0" y="0" class="main-title">Jobest System Architecture Diagram</text>
    <text x="0" y="28" class="subtitle">Complete technical blueprint of the frontend components, backend routes, background queue, database, and multi-agent pipeline</text>
  </g>''')

    # Define groups
    groups = [
        {"name": "Frontend - Next.js 15 & React 19", "x": 60, "y": 160, "w": 320, "h": 860, "color": "#0ea5e9", "grad": "frontend-grad", "glow": "glow-frontend"},
        {"name": "FastAPI Web Server", "x": 420, "y": 160, "w": 320, "h": 860, "color": "#8b5cf6", "grad": "backend-grad", "glow": "glow-backend"},
        {"name": "Core Service & Workers", "x": 780, "y": 160, "w": 320, "h": 860, "color": "#10b981", "grad": "storage-grad", "glow": "glow-storage"},
        {"name": "Orchestrated AI Pipelines", "x": 1140, "y": 160, "w": 400, "h": 980, "color": "#ec4899", "grad": "agent-grad", "glow": "glow-agent"},
        {"name": "LLM Clients & Providers", "x": 1580, "y": 160, "w": 280, "h": 860, "color": "#64748b", "grad": "llm-grad", "glow": "glow-llm"}
    ]

    # Draw group frames
    for g in groups:
        svg.append(f'''  <!-- Group: {g["name"]} -->
  <g transform="translate({g["x"]}, {g["y"]})">
    <rect width="{g["w"]}" height="{g["h"]}" rx="16" ry="16" fill="url(#{g["grad"]})" stroke="{g["color"]}" stroke-opacity="0.3" stroke-width="2"/>
    <text x="20" y="35" class="group-title" fill="{g["color"]}">{g["name"]}</text>
  </g>''')

    # 5. Draw Nodes
    nodes = [
        # Frontend Column (Column 0, x_base = 60 + 20 = 80)
        {"id": "fe_shell", "x": 80, "y": 230, "w": 280, "h": 90, "color": "#38bdf8", "glow": "glow-frontend", "title": "App Shell Layout", "desc": "Handles core navbar, settings views, and authorization UI states."},
        {"id": "fe_jobs", "x": 80, "y": 360, "w": 280, "h": 90, "color": "#38bdf8", "glow": "glow-frontend", "title": "Jobs Portal", "desc": "JD ingestion workspace, skills definition, and rubric configurations."},
        {"id": "fe_candidates", "x": 80, "y": 490, "w": 280, "h": 90, "color": "#38bdf8", "glow": "glow-frontend", "title": "Candidate Portal", "desc": "Bulk resume PDF uploads and initial triage keyword-match scoring list."},
        {"id": "fe_runs", "x": 80, "y": 620, "w": 280, "h": 90, "color": "#38bdf8", "glow": "glow-frontend", "title": "Live Run Loader", "desc": "SSE-like real-time visual progress trackers for running agent workers."},
        {"id": "fe_reports", "x": 80, "y": 750, "w": 280, "h": 90, "color": "#38bdf8", "glow": "glow-frontend", "title": "Final Candidate Reports", "desc": "Renders evidence matching tables, footprint scores, and panel views."},
        {"id": "fe_copilot", "x": 80, "y": 880, "w": 280, "h": 90, "color": "#0ea5e9", "glow": "glow-frontend", "title": "Finalist AI Copilot UI", "desc": "Interactive chat workspace for executing pipeline commands & tool confirms."},

        # Backend Router Column (Column 1, x_base = 420 + 20 = 440)
        {"id": "be_main", "x": 440, "y": 230, "w": 280, "h": 90, "color": "#a78bfa", "glow": "glow-backend", "title": "FastAPI Main App Entry", "desc": "Initializes uvicorn, manages CORS origins, handles startup DB updates."},
        {"id": "be_auth", "x": 440, "y": 360, "w": 280, "h": 90, "color": "#a78bfa", "glow": "glow-backend", "title": "Base / Auth Routes", "desc": "User logins, organization invites, base system health diagnostics."},
        {"id": "be_org", "x": 440, "y": 490, "w": 280, "h": 90, "color": "#a78bfa", "glow": "glow-backend", "title": "Organization / Job Routes", "desc": "Handles postings, bulk uploads, triage triggers, and candidate lists."},
        {"id": "be_run_routes", "x": 440, "y": 620, "w": 280, "h": 90, "color": "#a78bfa", "glow": "glow-backend", "title": "Analysis Run Routes", "desc": "Enqueues pipeline executions, tracks worker slots, checks run statuses."},
        {"id": "be_ai_routes", "x": 440, "y": 750, "w": 280, "h": 90, "color": "#8b5cf6", "glow": "glow-backend", "title": "AI Copilot API Router", "desc": "Traces tool calls, executes workspace changes, and saves pending actions."},

        # Services / Worker Column (Column 2, x_base = 780 + 20 = 800)
        {"id": "srv_queue", "x": 800, "y": 230, "w": 280, "h": 90, "color": "#34d399", "glow": "glow-storage", "title": "Analysis Queue Manager", "desc": "Async worker consumer loop. Resolves parallel slots and concurrency limits."},
        {"id": "srv_pdf", "x": 800, "y": 360, "w": 280, "h": 90, "color": "#34d399", "glow": "glow-storage", "title": "PDF Ingestion Engine", "desc": "Extracts text from uploaded PDF resumes using the PyMuPDF library."},
        {"id": "srv_triage", "x": 800, "y": 490, "w": 280, "h": 90, "color": "#34d399", "glow": "glow-storage", "title": "Triage & Scoring Service", "desc": "Performs keyword scan matching and first-pass sorting (capped at 80)."},
        {"id": "srv_db", "x": 800, "y": 620, "w": 280, "h": 140, "color": "#10b981", "glow": "glow-storage", "title": "SQLAlchemy DB Connection", "desc": "Orchestrates SQLite transactional updates on 'jobest.db' containing candidate final outputs, run stage audits, and tokens."},

        # Multi-Agent Column (Column 3, x_base = 1140 + 20 = 1160)
        {"id": "agt_orch", "x": 1160, "y": 230, "w": 360, "h": 90, "color": "#f472b6", "glow": "glow-agent", "title": "Pipeline Orchestrator", "desc": "Coordinates the 12 pipeline specialist stages sequentially. Saves stage status updates."},
        {"id": "agt_stages", "x": 1160, "y": 360, "w": 360, "h": 500, "color": "#ec4899", "glow": "glow-agent", "title": "12 Specialist Agents Flow", "desc": ""},
        {"id": "agt_fetcher", "x": 1160, "y": 900, "w": 360, "h": 110, "color": "#f472b6", "glow": "glow-agent", "title": "Professional Footprint Fetcher", "desc": "Performs concurrent web queries via httpx. Visited pages include GitHub repos, scholar records, and portfolios. Excludes LinkedIn scraping."},

        # LLM Clients Column (Column 4, x_base = 1580 + 20 = 1600)
        {"id": "llm_client", "x": 1600, "y": 230, "w": 240, "h": 90, "color": "#94a3b8", "glow": "glow-llm", "title": "LLMClient & ModelRouter", "desc": "Main interface for agent LLM calls. Retries, repairs JSON, and caches runs."},
        {"id": "llm_mock", "x": 1600, "y": 360, "w": 240, "h": 70, "color": "#94a3b8", "glow": "glow-llm", "title": "Local Mock Mode", "desc": "Emulates static agent runs."},
        {"id": "llm_chutes", "x": 1600, "y": 470, "w": 240, "h": 70, "color": "#cbd5e1", "glow": "glow-llm", "title": "Chutes TEE Provider", "desc": "Primary Qwen 2.5 32B model TEE."},
        {"id": "llm_nvidia", "x": 1600, "y": 580, "w": 240, "h": 70, "color": "#cbd5e1", "glow": "glow-llm", "title": "NVIDIA NIM Router", "desc": "Fast cloud LLM inference API."},
        {"id": "llm_fallback", "x": 1600, "y": 690, "w": 240, "h": 70, "color": "#94a3b8", "glow": "glow-llm", "title": "OpenRouter Fallback", "desc": "Guarantees runtime uptime."}
    ]

    # Draw Nodes
    for n in nodes:
        svg.append(f'''  <!-- Node: {n["id"]} -->
  <g id="{n["id"]}">
    <rect x="{n["x"]}" y="{n["y"]}" width="{n["w"]}" height="{n["h"]}" rx="12" ry="12" fill="#1e293b" fill-opacity="0.75" stroke="{n["color"]}" stroke-width="1.5" filter="url(#{n["glow"]})"/>
    <text x="{n["x"]+16}" y="{n["y"]+28}" class="node-title">{n["title"]}</text>''')
        if n["desc"]:
            # Auto wrapping description text for 12px
            desc_lines = []
            words = n["desc"].split()
            current_line = ""
            limit = 35 if n["w"] > 250 else 28
            for w in words:
                if len(current_line) + len(w) + 1 > limit:
                    desc_lines.append(current_line)
                    current_line = w
                else:
                    current_line = f"{current_line} {w}" if current_line else w
            if current_line:
                desc_lines.append(current_line)
            
            for idx, line in enumerate(desc_lines[:3]):
                svg.append(f'    <text x="{n["x"]+16}" y="{n["y"]+48+(idx*16)}" class="node-desc">{line}</text>')
        svg.append('  </g>')

    # 6. Specific inner drawings for agent stages block (Node "agt_stages")
    stages = [
        "1. JD Deconstruction", "2. Hiring Context", "3. Resume Parsing", "4. Evidence Extraction",
        "5. Skill Transferability", "6. Footprint Fetcher", "7. Footprint Audit", "8. Risk Auditor",
        "9. Score Aggregator", "10. Panel Review", "11. Interview Generator", "12. Final Shortlist Report"
    ]
    
    # 2 columns inside agt_stages
    for idx, stg in enumerate(stages):
        col = idx % 2
        row = idx // 2
        sx = 1160 + 16 + (col * 170)
        sy = 360 + 45 + (row * 68)
        
        svg.append(f'''  <!-- Inner Stage: {stg} -->
  <g transform="translate({sx}, {sy})">
    <rect width="155" height="52" rx="8" ry="8" fill="#0f172a" fill-opacity="0.9" stroke="#ec4899" stroke-opacity="0.6" stroke-width="1"/>
    <text x="8" y="18" class="stage-title">{stg.split(".")[0]}. {stg.split(".")[1].strip()}</text>
    <text x="8" y="34" class="node-desc" font-size="10px">Pipeline Agent Stage</text>
  </g>''')

    # Add text descriptor inside the agt_stages header
    svg.append('  <text x="1176" y="392" class="node-desc" font-weight="700" fill="#f472b6">Sequential execution with cached intermediate state recovery</text>')

    # 7. Draw Connection Edges (data flow paths)
    edges = [
        # Frontend API requests -> FastAPI gateway (Cyan colored)
        {"d": "M 360 275 L 440 275", "marker": "arrow-blue", "color": "#38bdf8"},
        {"d": "M 360 405 L 440 405", "marker": "arrow-blue", "color": "#38bdf8"},
        {"d": "M 360 535 L 440 535", "marker": "arrow-blue", "color": "#38bdf8"},
        {"d": "M 360 665 L 440 665", "marker": "arrow-blue", "color": "#38bdf8"},
        {"d": "M 360 795 L 440 795", "marker": "arrow-blue", "color": "#38bdf8"},
        {"d": "M 360 925 C 400 925 400 805 440 805", "marker": "arrow-blue", "color": "#38bdf8"},

        # FastAPI gateway routes -> Core Services (Purple colored)
        {"d": "M 720 535 L 800 535", "marker": "arrow-purple", "color": "#a78bfa"}, # uploads/org -> PDF & Triage
        {"d": "M 720 665 L 800 275", "marker": "arrow-purple", "color": "#a78bfa"}, # runs -> queue
        {"d": "M 720 795 C 760 795 760 690 800 690", "marker": "arrow-purple", "color": "#a78bfa"}, # Copilot -> db / queue

        # Core Services interactions -> DB & Queue dispatcher (Green colored)
        {"d": "M 940 315 C 970 315 970 275 800 275", "marker": "arrow-green", "color": "#34d399"}, # Queue items to processor
        {"d": "M 940 405 C 970 405 970 650 940 650", "marker": "arrow-green", "color": "#34d399"}, # Ingestion parsing -> DB
        {"d": "M 940 535 C 970 535 970 670 940 670", "marker": "arrow-green", "color": "#34d399"}, # Triage scores -> DB
        {"d": "M 1080 275 L 1160 275", "marker": "arrow-green", "color": "#34d399"}, # Queue worker to PipelineOrchestrator

        # Pipeline Orchestrator -> Stages & Services (Pink colored)
        {"d": "M 1340 320 L 1340 360", "marker": "arrow-pink", "color": "#f472b6"}, # Orch to stages block
        {"d": "M 1340 860 L 1340 900", "marker": "arrow-pink", "color": "#f472b6"}, # stages block to Fetcher
        {"d": "M 1160 955 C 1080 955 1080 720 1080 720", "marker": "arrow-pink", "color": "#f472b6"}, # Fetcher metadata to DB
        {"d": "M 1160 295 C 1080 295 1080 635 1080 635", "marker": "arrow-pink", "color": "#f472b6"}, # Agent outputs to DB

        # Agent & Orchestrator -> LLM Client Router
        {"d": "M 1520 275 L 1600 275", "marker": "arrow-pink", "color": "#f472b6"}, # Orchestrator calls Client

        # LLM client router -> LLM API Providers (Slate colored)
        {"d": "M 1720 320 L 1720 360", "marker": "arrow-slate", "color": "#94a3b8"}, # client -> mock
        {"d": "M 1720 320 C 1720 340 1720 340 1720 470", "marker": "arrow-slate", "color": "#94a3b8"}, # client -> chutes
        {"d": "M 1720 320 C 1720 340 1720 340 1720 580", "marker": "arrow-slate", "color": "#94a3b8"}, # client -> nvidia
        {"d": "M 1720 320 C 1720 340 1720 340 1720 690", "marker": "arrow-slate", "color": "#94a3b8"}, # client -> fallback
    ]

    for e in edges:
        svg.append(f'  <path d="{e["d"]}" fill="none" stroke="{e["color"]}" stroke-width="2" marker-end="url(#{e["marker"]})"/>')

    # 8. Legend / Flow Indicators
    legend_items = [
        {"x": 60, "color": "#38bdf8", "text": "HTTP / Client API Call"},
        {"x": 300, "color": "#a78bfa", "text": "Backend Endpoint Route Trigger"},
        {"x": 580, "color": "#34d399", "text": "Background Task Concurrency / Ingestion Flow"},
        {"x": 930, "color": "#f472b6", "text": "Agent Stage Sequence & Context Evaluation"},
        {"x": 1280, "color": "#94a3b8", "text": "LLM Integration Provider Call"}
    ]

    svg.append('  <!-- Legend -->')
    svg.append('  <g transform="translate(60, 1080)">')
    svg.append('    <rect width="1800" height="60" rx="10" ry="10" fill="#1e293b" fill-opacity="0.5" stroke="#475569" stroke-width="1.5"/>')
    for item in legend_items:
        svg.append(f'''    <g transform="translate({item["x"]}, 20)">
      <line x1="0" y1="10" x2="30" y2="10" stroke="{item["color"]}" stroke-width="3"/>
      <circle cx="30" cy="10" r="4" fill="{item["color"]}"/>
      <text x="42" y="14" class="legend-text">{item["text"]}</text>
    </g>''')
    svg.append('  </g>')

    svg.append('</svg>')

    return '\n'.join(svg)

if __name__ == "__main__":
    output_dir = Path(__file__).resolve().parents[2] / "docs" / "submission"
    os.makedirs(output_dir, exist_ok=True)
    output_path = output_dir / "system-architecture.svg"
    
    print(f"Generating system-architecture.svg at {output_path}...")
    svg_content = generate_svg()
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print("Generation complete!")
