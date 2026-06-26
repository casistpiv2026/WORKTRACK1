import { useState, useEffect, useMemo } from "react";

// ── Persistent Storage ──────────────────────────────────────────────────────
const STORAGE_KEYS = { workers: "wt_workers", projects: "wt_projects", logs: "wt_logs" };

const defaultWorkers = [
  { id: "w1", name: "Carlos Pérez", dailyRate: 120000 },
  { id: "w2", name: "Juan García", dailyRate: 100000 },
  { id: "w3", name: "Luis Martínez", dailyRate: 90000 },
];
const defaultProjects = [
  { id: "p1", name: "PROALCO – Segunda Etapa Solar", budget: 50000000 },
  { id: "p2", name: "Mantenimiento Planta Norte", budget: 20000000 },
];
const novedades = ["Incapacidad", "Capacitación", "Permiso", "Vacaciones", "Día libre"];

function load(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ── Helpers ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short" });

// ── Excel Export ─────────────────────────────────────────────────────────────
function exportExcel(workers, projects, logs) {
  const rows = [["Fecha", "Trabajador", "Proyecto / Novedad", "Días", "Valor Día (COP)", "Total (COP)"]];
  workers.forEach((w) => {
    const wLogs = logs.filter((l) => l.workerId === w.id).sort((a, b) => a.date.localeCompare(b.date));
    wLogs.forEach((l) => {
      const proj = projects.find((p) => p.id === l.projectId);
      rows.push([l.date, w.name, proj ? proj.name : l.projectId, 1, w.dailyRate, w.dailyRate]);
    });
  });
  const ws = rows.map((r) => r.join("\t")).join("\n");
  const blob = new Blob(["\ufeff" + ws], { type: "text/tab-separated-values;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `nomina_${today()}.xls`; a.click();
}

// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [workers, setWorkers] = useState(() => load(STORAGE_KEYS.workers, defaultWorkers));
  const [projects, setProjects] = useState(() => load(STORAGE_KEYS.projects, defaultProjects));
  const [logs, setLogs] = useState(() => load(STORAGE_KEYS.logs, []));
  const [view, setView] = useState("worker"); // worker | admin | dashboard
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerLog, setWorkerLog] = useState({ projectId: "", date: today(), isNovedad: false, novedad: "" });
  const [logMsg, setLogMsg] = useState(null);
  const [adminTab, setAdminTab] = useState("workers");
  const [newWorker, setNewWorker] = useState({ name: "", dailyRate: "" });
  const [newProject, setNewProject] = useState({ name: "", budget: "" });
  const [dashRange, setDashRange] = useState({ from: today().slice(0, 7) + "-01", to: today() });

  useEffect(() => save(STORAGE_KEYS.workers, workers), [workers]);
  useEffect(() => save(STORAGE_KEYS.projects, projects), [projects]);
  useEffect(() => save(STORAGE_KEYS.logs, logs), [logs]);

  // ── Worker: submit daily log ─────────────────────────────────────────────
  function submitLog() {
    if (!selectedWorker) return;
    const entry = {
      id: Date.now().toString(), workerId: selectedWorker.id,
      date: workerLog.date,
      projectId: workerLog.isNovedad ? workerLog.novedad : workerLog.projectId,
      isNovedad: workerLog.isNovedad,
    };
    if (!entry.projectId) { setLogMsg({ ok: false, txt: "Selecciona un proyecto o novedad." }); return; }
    const dup = logs.find((l) => l.workerId === entry.workerId && l.date === entry.date);
    if (dup) { setLogMsg({ ok: false, txt: "Ya registraste asistencia para esta fecha." }); return; }
    setLogs((prev) => [...prev, entry]);
    setLogMsg({ ok: true, txt: "✓ Registro guardado correctamente." });
    setTimeout(() => setLogMsg(null), 3000);
  }

  // ── Dashboard stats ──────────────────────────────────────────────────────
  const dashStats = useMemo(() => {
    const filtered = logs.filter((l) => !l.isNovedad && l.date >= dashRange.from && l.date <= dashRange.to);
    return projects.map((p) => {
      const pLogs = filtered.filter((l) => l.projectId === p.id);
      let cost = 0;
      pLogs.forEach((l) => { const w = workers.find((x) => x.id === l.workerId); if (w) cost += w.dailyRate; });
      return { ...p, days: pLogs.length, cost, pct: p.budget ? Math.min(100, (cost / p.budget) * 100) : 0 };
    });
  }, [logs, projects, workers, dashRange]);

  const workerStats = useMemo(() => {
    return workers.map((w) => {
      const wLogs = logs.filter((l) => l.workerId === w.id && !l.isNovedad && l.date >= dashRange.from && l.date <= dashRange.to);
      const total = wLogs.length * w.dailyRate;
      return { ...w, days: wLogs.length, total };
    });
  }, [logs, workers, dashRange]);

  const novedadStats = useMemo(() => {
    const nLogs = logs.filter((l) => l.isNovedad && l.date >= dashRange.from && l.date <= dashRange.to);
    const map = {};
    novedades.forEach((n) => { map[n] = nLogs.filter((l) => l.projectId === n).length; });
    return map;
  }, [logs, dashRange]);

  // ── Styles ───────────────────────────────────────────────────────────────
  const S = {
    app: { minHeight: "100vh", background: "#0a0e1a", color: "#e8eaf6", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", paddingBottom: 80 },
    header: { background: "linear-gradient(135deg,#1a2240 0%,#0d1530 100%)", borderBottom: "1px solid #1e2d50", padding: "18px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    logo: { fontSize: 18, fontWeight: 700, color: "#60a5fa", letterSpacing: "-0.5px" },
    sub: { fontSize: 11, color: "#64748b", marginTop: 2 },
    nav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d1530", borderTop: "1px solid #1e2d50", display: "flex", justifyContent: "space-around", padding: "8px 0 10px", zIndex: 100 },
    navBtn: (active) => ({ background: "none", border: "none", color: active ? "#60a5fa" : "#475569", fontSize: 11, fontWeight: active ? 700 : 400, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 16px", borderRadius: 8, transition: "color .2s" }),
    navIcon: { fontSize: 20 },
    card: { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 16, marginBottom: 12 },
    label: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "block" },
    input: { width: "100%", background: "#0a0e1a", border: "1px solid #1e2d50", borderRadius: 8, padding: "10px 12px", color: "#e8eaf6", fontSize: 14, outline: "none", boxSizing: "border-box" },
    select: { width: "100%", background: "#0a0e1a", border: "1px solid #1e2d50", borderRadius: 8, padding: "10px 12px", color: "#e8eaf6", fontSize: 14, outline: "none", boxSizing: "border-box" },
    btn: (color = "#3b82f6") => ({ background: color, color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%", marginTop: 8 }),
    btnSm: { background: "#1e3a5f", color: "#60a5fa", border: "1px solid #2563eb", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 },
    badge: (c = "#1e3a5f") => ({ background: c, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, display: "inline-block" }),
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    statBox: { background: "#0d1530", border: "1px solid #1e2d50", borderRadius: 12, padding: 14, flex: 1, textAlign: "center" },
    statNum: { fontSize: 22, fontWeight: 800, color: "#60a5fa" },
    statLbl: { fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
    progress: (pct, c = "#3b82f6") => ({ height: 8, borderRadius: 4, background: "#1e2d50", overflow: "hidden", marginTop: 6, position: "relative" }),
    progressFill: (pct, c = "#3b82f6") => ({ height: "100%", width: `${pct}%`, background: c, borderRadius: 4, transition: "width 0.8s ease" }),
    section: { padding: "16px 16px 0" },
    sectionTitle: { fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
    msg: (ok) => ({ background: ok ? "#052e16" : "#2d0a0a", border: `1px solid ${ok ? "#16a34a" : "#dc2626"}`, color: ok ? "#4ade80" : "#f87171", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 10, textAlign: "center" }),
    tab: (a) => ({ background: a ? "#1e3a5f" : "none", border: a ? "1px solid #2563eb" : "1px solid #1e2d50", color: a ? "#60a5fa" : "#64748b", borderRadius: 8, padding: "6px 16px", fontSize: 12, cursor: "pointer", fontWeight: a ? 700 : 400 }),
  };

  // ═══════════════ RENDER ═══════════════════════════════════════════════════
  return (
    <div style={S.app}>
      {/* Google Font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap'); * { box-sizing: border-box; } select option { background: #0a0e1a; }`}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div>
          <div style={S.logo}>⚡ WorkTrack</div>
          <div style={S.sub}>Control de asistencia y nómina</div>
        </div>
        <div style={S.badge("#1e3a5f")}>
          {view === "worker" ? "👷 Trabajador" : view === "admin" ? "🔧 Admin" : "📊 Dashboard"}
        </div>
      </div>

      {/* ── VISTA TRABAJADOR ─────────────────────────────────────────────── */}
      {view === "worker" && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Registro Diario</div>

          {!selectedWorker ? (
            <div>
              <div style={{ ...S.card, marginBottom: 8 }}>
                <span style={S.label}>¿Quién eres hoy?</span>
                <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 12px" }}>Selecciona tu nombre para registrar tu asistencia.</p>
              </div>
              {workers.map((w) => (
                <div key={w.id} onClick={() => setSelectedWorker(w)}
                  style={{ ...S.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "border .2s", borderColor: "#1e3a5f" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👷</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Valor día: {fmt(w.dailyRate)}</div>
                  </div>
                  <div style={{ marginLeft: "auto", color: "#3b82f6", fontSize: 20 }}>›</div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ ...S.card, background: "#0d1530", display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👷</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{selectedWorker.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Valor día: {fmt(selectedWorker.dailyRate)}</div>
                </div>
                <button onClick={() => { setSelectedWorker(null); setLogMsg(null); }} style={{ ...S.btnSm, marginLeft: "auto" }}>Cambiar</button>
              </div>

              {logMsg && <div style={S.msg(logMsg.ok)}>{logMsg.txt}</div>}

              <div style={S.card}>
                <span style={S.label}>Fecha</span>
                <input type="date" style={S.input} value={workerLog.date} onChange={(e) => setWorkerLog({ ...workerLog, date: e.target.value })} />
              </div>

              <div style={S.card}>
                <span style={S.label}>Tipo de registro</span>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button style={S.tab(!workerLog.isNovedad)} onClick={() => setWorkerLog({ ...workerLog, isNovedad: false })}>🏗 Proyecto</button>
                  <button style={S.tab(workerLog.isNovedad)} onClick={() => setWorkerLog({ ...workerLog, isNovedad: true })}>📋 Novedad</button>
                </div>

                {!workerLog.isNovedad ? (
                  <>
                    <span style={S.label}>Proyecto en el que estás hoy</span>
                    <select style={S.select} value={workerLog.projectId} onChange={(e) => setWorkerLog({ ...workerLog, projectId: e.target.value })}>
                      <option value="">— Selecciona un proyecto —</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <span style={S.label}>Tipo de novedad</span>
                    <select style={S.select} value={workerLog.novedad} onChange={(e) => setWorkerLog({ ...workerLog, novedad: e.target.value })}>
                      <option value="">— Selecciona novedad —</option>
                      {novedades.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </>
                )}
              </div>

              <button style={S.btn("#16a34a")} onClick={submitLog}>✓ Registrar asistencia</button>

              {/* Historial del trabajador */}
              <div style={{ ...S.sectionTitle, marginTop: 20 }}>Mi historial reciente</div>
              {logs.filter((l) => l.workerId === selectedWorker.id).slice(-5).reverse().map((l) => {
                const proj = projects.find((p) => p.id === l.projectId);
                return (
                  <div key={l.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{proj ? proj.name : l.projectId}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(l.date)}</div>
                    </div>
                    <div style={S.badge(l.isNovedad ? "#2d1b00" : "#052e16")}>{l.isNovedad ? "📋 Novedad" : "🏗 Proyecto"}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── VISTA ADMIN ──────────────────────────────────────────────────── */}
      {view === "admin" && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Panel Administrador</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["workers", "projects", "logs"].map((t) => (
              <button key={t} style={S.tab(adminTab === t)} onClick={() => setAdminTab(t)}>
                {t === "workers" ? "👷 Trabajadores" : t === "projects" ? "🏗 Proyectos" : "📋 Registros"}
              </button>
            ))}
          </div>

          {/* Workers */}
          {adminTab === "workers" && (
            <>
              <div style={S.card}>
                <span style={S.label}>Agregar trabajador</span>
                <input placeholder="Nombre completo" style={{ ...S.input, marginBottom: 8 }} value={newWorker.name} onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })} />
                <input placeholder="Valor día (COP)" type="number" style={{ ...S.input, marginBottom: 8 }} value={newWorker.dailyRate} onChange={(e) => setNewWorker({ ...newWorker, dailyRate: e.target.value })} />
                <button style={S.btn()} onClick={() => {
                  if (!newWorker.name || !newWorker.dailyRate) return;
                  setWorkers((prev) => [...prev, { id: Date.now().toString(), name: newWorker.name, dailyRate: Number(newWorker.dailyRate) }]);
                  setNewWorker({ name: "", dailyRate: "" });
                }}>+ Agregar trabajador</button>
              </div>
              {workers.map((w) => (
                <div key={w.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{fmt(w.dailyRate)} / día</div>
                  </div>
                  <button style={{ ...S.btnSm, color: "#f87171", borderColor: "#7f1d1d" }} onClick={() => setWorkers((p) => p.filter((x) => x.id !== w.id))}>Eliminar</button>
                </div>
              ))}
            </>
          )}

          {/* Projects */}
          {adminTab === "projects" && (
            <>
              <div style={S.card}>
                <span style={S.label}>Agregar proyecto / novedad</span>
                <input placeholder="Nombre del proyecto" style={{ ...S.input, marginBottom: 8 }} value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} />
                <input placeholder="Presupuesto mano de obra (COP)" type="number" style={{ ...S.input, marginBottom: 8 }} value={newProject.budget} onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })} />
                <button style={S.btn()} onClick={() => {
                  if (!newProject.name) return;
                  setProjects((prev) => [...prev, { id: Date.now().toString(), name: newProject.name, budget: Number(newProject.budget) || 0 }]);
                  setNewProject({ name: "", budget: "" });
                }}>+ Agregar proyecto</button>
              </div>
              {projects.map((p) => (
                <div key={p.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Presupuesto MO: {fmt(p.budget)}</div>
                  </div>
                  <button style={{ ...S.btnSm, color: "#f87171", borderColor: "#7f1d1d" }} onClick={() => setProjects((pr) => pr.filter((x) => x.id !== p.id))}>Eliminar</button>
                </div>
              ))}
              <div style={{ ...S.card, background: "#0d1530", marginTop: 4 }}>
                <span style={S.label}>Novedades predefinidas</span>
                {novedades.map((n) => <div key={n} style={{ ...S.badge("#1e2d50"), margin: "4px 4px 0 0" }}>{n}</div>)}
              </div>
            </>
          )}

          {/* Logs management */}
          {adminTab === "logs" && (
            <>
              <div style={{ ...S.card, background: "#0d1530", marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>Total registros: <strong style={{ color: "#60a5fa" }}>{logs.length}</strong></div>
              </div>
              {logs.slice(-20).reverse().map((l) => {
                const w = workers.find((x) => x.id === l.workerId);
                const p = projects.find((x) => x.id === l.projectId);
                return (
                  <div key={l.id} style={{ ...S.card, padding: "10px 14px" }}>
                    <div style={S.row}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{w?.name || "?"}</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(l.date)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{p ? p.name : l.projectId}</div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── VISTA DASHBOARD ──────────────────────────────────────────────── */}
      {view === "dashboard" && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Dashboard Nómina</div>

          {/* Rango de fechas */}
          <div style={{ ...S.card, display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={S.label}>Desde</span>
              <input type="date" style={S.input} value={dashRange.from} onChange={(e) => setDashRange({ ...dashRange, from: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={S.label}>Hasta</span>
              <input type="date" style={S.input} value={dashRange.to} onChange={(e) => setDashRange({ ...dashRange, to: e.target.value })} />
            </div>
          </div>

          {/* KPIs globales */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={S.statBox}>
              <div style={S.statNum}>{dashStats.reduce((a, b) => a + b.days, 0)}</div>
              <div style={S.statLbl}>Días Totales</div>
            </div>
            <div style={S.statBox}>
              <div style={{ ...S.statNum, fontSize: 16 }}>{fmt(workerStats.reduce((a, b) => a + b.total, 0))}</div>
              <div style={S.statLbl}>Costo Total</div>
            </div>
          </div>

          {/* Por proyecto */}
          <div style={S.sectionTitle}>Por Proyecto</div>
          {dashStats.map((p) => (
            <div key={p.id} style={S.card}>
              <div style={S.row}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                <span style={S.badge(p.pct > 80 ? "#450a0a" : "#052e16")}>{p.days} días</span>
              </div>
              <div style={S.row}>
                <span style={{ fontSize: 12, color: "#64748b" }}>Costo MO: <strong style={{ color: "#e8eaf6" }}>{fmt(p.cost)}</strong></span>
                <span style={{ fontSize: 12, color: "#64748b" }}>Presup: {fmt(p.budget)}</span>
              </div>
              <div style={S.progress(p.pct)}><div style={S.progressFill(p.pct, p.pct > 80 ? "#ef4444" : "#22c55e")} /></div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, textAlign: "right" }}>{p.pct.toFixed(1)}% del presupuesto</div>
            </div>
          ))}

          {/* Por trabajador */}
          <div style={S.sectionTitle}>Por Trabajador</div>
          {workerStats.sort((a, b) => b.days - a.days).map((w) => (
            <div key={w.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{w.name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{w.days} días · {fmt(w.dailyRate)}/día</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, color: "#60a5fa", fontSize: 15 }}>{fmt(w.total)}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>total período</div>
              </div>
            </div>
          ))}

          {/* Novedades */}
          <div style={S.sectionTitle}>Novedades del período</div>
          <div style={{ ...S.card, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {novedades.map((n) => (
              <div key={n} style={{ background: "#0d1530", border: "1px solid #1e2d50", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 100 }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: "#f59e0b" }}>{novedadStats[n]}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{n}</div>
              </div>
            ))}
          </div>

          {/* Export */}
          <button style={S.btn("#16a34a")} onClick={() => exportExcel(workers, projects, logs)}>
            ⬇ Exportar Excel de Nómina
          </button>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav style={S.nav}>
        {[["worker", "👷", "Asistencia"], ["dashboard", "📊", "Dashboard"], ["admin", "⚙️", "Admin"]].map(([v, icon, label]) => (
          <button key={v} style={S.navBtn(view === v)} onClick={() => setView(v)}>
            <span style={S.navIcon}>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}