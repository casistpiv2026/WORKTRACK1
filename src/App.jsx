import { useState, useEffect, useMemo } from "react";

// ── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  workers: "wt_workers", projects: "wt_projects",
  logs: "wt_logs", pins: "wt_pins"
};

const defaultWorkers = [
  { id: "w1", name: "Carlos Pérez", dailyRate: 120000, cedula: "12345678", phone: "3001234567" },
  { id: "w2", name: "Juan García",  dailyRate: 100000, cedula: "23456789", phone: "3012345678" },
  { id: "w3", name: "Luis Martínez",dailyRate: 90000,  cedula: "34567890", phone: "3023456789" },
];
const defaultProjects = [
  { id: "p1", name: "PROALCO – Segunda Etapa Solar", budget: 50000000 },
  { id: "p2", name: "Mantenimiento Planta Norte",    budget: 20000000 },
];
const novedades = ["Incapacidad","Capacitación","Permiso","Vacaciones","Día libre"];
const ADMIN = { user: "casistpiv2026", pass: "901594783" };

function load(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

const today   = () => new Date().toISOString().slice(0,10);
const fmt     = (n) => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
const fmtDate = (d) => new Date(d+"T12:00:00").toLocaleDateString("es-CO",{weekday:"short",day:"2-digit",month:"short"});

function exportExcel(workers, projects, logs) {
  const rows = [["Fecha","Trabajador","Proyecto / Novedad","Días","Valor Día (COP)","Total (COP)"]];
  workers.forEach((w) => {
    logs.filter((l)=>l.workerId===w.id).sort((a,b)=>a.date.localeCompare(b.date)).forEach((l)=>{
      const proj = projects.find((p)=>p.id===l.projectId);
      rows.push([l.date, w.name, proj ? proj.name : l.projectId, 1, w.dailyRate, w.dailyRate]);
    });
  });
  const ws   = rows.map((r)=>r.join("\t")).join("\n");
  const blob = new Blob(["\ufeff"+ws],{type:"text/tab-separated-values;charset=utf-8;"});
  const a    = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `nomina_${today()}.xls`; a.click();
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  app:     { minHeight:"100vh", background:"#0a0e1a", color:"#e8eaf6", fontFamily:"'DM Sans','Segoe UI',sans-serif", paddingBottom:80 },
  header:  { background:"linear-gradient(135deg,#1a2240 0%,#0d1530 100%)", borderBottom:"1px solid #1e2d50", padding:"18px 20px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" },
  logo:    { fontSize:18, fontWeight:700, color:"#60a5fa", letterSpacing:"-0.5px" },
  sub:     { fontSize:11, color:"#64748b", marginTop:2 },
  nav:     { position:"fixed", bottom:0, left:0, right:0, background:"#0d1530", borderTop:"1px solid #1e2d50", display:"flex", justifyContent:"space-around", padding:"8px 0 10px", zIndex:100 },
  navBtn:  (a)=>({ background:"none", border:"none", color:a?"#60a5fa":"#475569", fontSize:11, fontWeight:a?700:400, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"4px 16px", borderRadius:8 }),
  navIcon: { fontSize:20 },
  card:    { background:"#111827", border:"1px solid #1e2d50", borderRadius:14, padding:16, marginBottom:12 },
  label:   { fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block" },
  input:   { width:"100%", background:"#0a0e1a", border:"1px solid #1e2d50", borderRadius:8, padding:"10px 12px", color:"#e8eaf6", fontSize:14, outline:"none", boxSizing:"border-box" },
  select:  { width:"100%", background:"#0a0e1a", border:"1px solid #1e2d50", borderRadius:8, padding:"10px 12px", color:"#e8eaf6", fontSize:14, outline:"none", boxSizing:"border-box" },
  btn:     (c="#3b82f6")=>({ background:c, color:"#fff", border:"none", borderRadius:10, padding:"12px 20px", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%", marginTop:8 }),
  btnSm:   { background:"#1e3a5f", color:"#60a5fa", border:"1px solid #2563eb", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer", fontWeight:600 },
  badge:   (c="#1e3a5f")=>({ background:c, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:600, display:"inline-block" }),
  row:     { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 },
  statBox: { background:"#0d1530", border:"1px solid #1e2d50", borderRadius:12, padding:14, flex:1, textAlign:"center" },
  statNum: { fontSize:22, fontWeight:800, color:"#60a5fa" },
  statLbl: { fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:1 },
  progress:     ()=>({ height:8, borderRadius:4, background:"#1e2d50", overflow:"hidden", marginTop:6 }),
  progressFill: (pct,c="#3b82f6")=>({ height:"100%", width:`${pct}%`, background:c, borderRadius:4, transition:"width 0.8s ease" }),
  section:      { padding:"16px 16px 0" },
  sectionTitle: { fontSize:13, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginBottom:12 },
  msg:     (ok)=>({ background:ok?"#052e16":"#2d0a0a", border:`1px solid ${ok?"#16a34a":"#dc2626"}`, color:ok?"#4ade80":"#f87171", borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:10, textAlign:"center" }),
  tab:     (a)=>({ background:a?"#1e3a5f":"none", border:a?"1px solid #2563eb":"1px solid #1e2d50", color:a?"#60a5fa":"#64748b", borderRadius:8, padding:"6px 16px", fontSize:12, cursor:"pointer", fontWeight:a?700:400 }),
};

// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA DE BIENVENIDA
// ═══════════════════════════════════════════════════════════════════════════
function Welcome({ onSelect }) {
  return (
    <div style={{ minHeight:"100vh", background:"#0a0e1a", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap'); *{box-sizing:border-box;}`}</style>
      <div style={{ textAlign:"center", marginBottom:40 }}>
        <div style={{ fontSize:56, marginBottom:8 }}>⚡</div>
        <div style={{ fontSize:28, fontWeight:800, color:"#60a5fa", letterSpacing:"-1px" }}>WorkTrack</div>
        <div style={{ fontSize:13, color:"#64748b", marginTop:4 }}>Control de asistencia y nómina</div>
      </div>
      <div style={{ width:"100%", maxWidth:340 }}>
        <p style={{ textAlign:"center", color:"#94a3b8", fontSize:14, marginBottom:20 }}>¿Cómo deseas ingresar?</p>
        <div onClick={()=>onSelect("worker")} style={{ background:"linear-gradient(135deg,#1e3a5f,#1a2d4a)", border:"1px solid #2563eb", borderRadius:16, padding:"20px 24px", cursor:"pointer", marginBottom:12, display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:"#1e3a5f", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>👷</div>
          <div>
            <div style={{ fontWeight:700, fontSize:16, color:"#e8eaf6" }}>Colaborador</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>Registra tu asistencia diaria</div>
          </div>
          <div style={{ marginLeft:"auto", color:"#3b82f6", fontSize:22 }}>›</div>
        </div>
        <div onClick={()=>onSelect("admin")} style={{ background:"linear-gradient(135deg,#1a2d1a,#0f1e0f)", border:"1px solid #16a34a", borderRadius:16, padding:"20px 24px", cursor:"pointer", display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:"#052e16", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>🔐</div>
          <div>
            <div style={{ fontWeight:700, fontSize:16, color:"#e8eaf6" }}>Administrador</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>Gestión de proyectos y nómina</div>
          </div>
          <div style={{ marginLeft:"auto", color:"#22c55e", fontSize:22 }}>›</div>
        </div>
      </div>
      <div style={{ marginTop:32, fontSize:11, color:"#334155" }}>PIVMAN SOLAR S.A.S.</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN COLABORADOR
// ═══════════════════════════════════════════════════════════════════════════
function WorkerLogin({ workers, pins, setPins, onLogin, onBack }) {
  const [step, setStep]       = useState("cedula"); // cedula | pin | setpin | recover
  const [cedula, setCedula]   = useState("");
  const [pin, setPin]         = useState("");
  const [pin2, setPin2]       = useState("");
  const [phone, setPhone]     = useState("");
  const [msg, setMsg]         = useState(null);
  const [found, setFound]     = useState(null);

  function checkCedula() {
    const w = workers.find((x)=>x.cedula===cedula.trim());
    if (!w) { setMsg({ok:false,txt:"Cédula no registrada. Contacta al administrador."}); return; }
    setFound(w);
    setMsg(null);
    if (pins[w.id]) setStep("pin"); else setStep("setpin");
  }

  function checkPin() {
    if (pins[found.id]===pin) { onLogin(found); }
    else { setMsg({ok:false,txt:"PIN incorrecto. Intenta de nuevo."}); setPin(""); }
  }

  function setNewPin() {
    if (pin.length<4) { setMsg({ok:false,txt:"El PIN debe tener al menos 4 dígitos."}); return; }
    if (pin!==pin2)   { setMsg({ok:false,txt:"Los PINs no coinciden."}); return; }
    const updated = {...pins, [found.id]:pin};
    setPins(updated);
    save(STORAGE_KEYS.pins, updated);
    onLogin(found);
  }

  function recoverPin() {
    if (phone.trim()===found.phone) {
      const updated = {...pins}; delete updated[found.id];
      setPins(updated); save(STORAGE_KEYS.pins, updated);
      setMsg({ok:true,txt:"PIN restablecido. Ahora crea uno nuevo."});
      setTimeout(()=>{ setMsg(null); setPin(""); setPin2(""); setStep("setpin"); },2000);
    } else {
      setMsg({ok:false,txt:"Número de celular incorrecto."});
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0a0e1a", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap'); *{box-sizing:border-box;}`}</style>
      <div style={{ width:"100%", maxWidth:360 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:13, marginBottom:20, display:"flex", alignItems:"center", gap:6 }}>‹ Volver</button>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:40 }}>👷</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#e8eaf6", marginTop:8 }}>Acceso Colaborador</div>
          {found && <div style={{ fontSize:13, color:"#60a5fa", marginTop:4 }}>{found.name}</div>}
        </div>

        {msg && <div style={S.msg(msg.ok)}>{msg.txt}</div>}

        {/* PASO 1: cédula */}
        {step==="cedula" && (
          <div style={S.card}>
            <span style={S.label}>Número de cédula</span>
            <input style={S.input} type="number" placeholder="Ej: 1234567890" value={cedula} onChange={(e)=>setCedula(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&checkCedula()} />
            <button style={S.btn()} onClick={checkCedula}>Continuar →</button>
          </div>
        )}

        {/* PASO 2: ingresar PIN */}
        {step==="pin" && (
          <div style={S.card}>
            <span style={S.label}>Ingresa tu PIN</span>
            <input style={{...S.input, letterSpacing:8, fontSize:20, textAlign:"center"}} type="password" inputMode="numeric" maxLength={8} placeholder="● ● ● ●" value={pin} onChange={(e)=>setPin(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&checkPin()} />
            <button style={S.btn()} onClick={checkPin}>Ingresar</button>
            <button onClick={()=>{setStep("recover");setMsg(null);}} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:12, marginTop:10, width:"100%", textAlign:"center" }}>¿Olvidaste tu PIN?</button>
          </div>
        )}

        {/* PASO 3: crear PIN */}
        {step==="setpin" && (
          <div style={S.card}>
            <div style={{ fontSize:13, color:"#f59e0b", marginBottom:12, textAlign:"center" }}>👋 Primera vez — crea tu PIN de acceso</div>
            <span style={S.label}>Nuevo PIN (mínimo 4 dígitos)</span>
            <input style={{...S.input, letterSpacing:8, fontSize:20, textAlign:"center", marginBottom:8}} type="password" inputMode="numeric" maxLength={8} placeholder="● ● ● ●" value={pin} onChange={(e)=>setPin(e.target.value)} />
            <span style={S.label}>Confirma tu PIN</span>
            <input style={{...S.input, letterSpacing:8, fontSize:20, textAlign:"center"}} type="password" inputMode="numeric" maxLength={8} placeholder="● ● ● ●" value={pin2} onChange={(e)=>setPin2(e.target.value)} />
            <button style={S.btn("#16a34a")} onClick={setNewPin}>Guardar PIN e ingresar</button>
          </div>
        )}

        {/* PASO 4: recuperar PIN */}
        {step==="recover" && (
          <div style={S.card}>
            <div style={{ fontSize:13, color:"#94a3b8", marginBottom:12, textAlign:"center" }}>Ingresa el número de celular registrado por el administrador</div>
            <span style={S.label}>Número de celular</span>
            <input style={S.input} type="tel" placeholder="Ej: 3001234567" value={phone} onChange={(e)=>setPhone(e.target.value)} />
            <button style={S.btn("#f59e0b")} onClick={recoverPin}>Verificar y restablecer PIN</button>
            <button onClick={()=>{setStep("pin");setMsg(null);}} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:12, marginTop:10, width:"100%", textAlign:"center" }}>← Volver al PIN</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN ADMINISTRADOR
// ═══════════════════════════════════════════════════════════════════════════
function AdminLogin({ onLogin, onBack }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [msg,  setMsg]  = useState(null);
  const [show, setShow] = useState(false);

  function check() {
    if (user===ADMIN.user && pass===ADMIN.pass) { onLogin(); }
    else { setMsg({ok:false,txt:"Usuario o contraseña incorrectos."}); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0a0e1a", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap'); *{box-sizing:border-box;}`}</style>
      <div style={{ width:"100%", maxWidth:360 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:13, marginBottom:20, display:"flex", alignItems:"center", gap:6 }}>‹ Volver</button>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:40 }}>🔐</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#e8eaf6", marginTop:8 }}>Acceso Administrador</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>PIVMAN SOLAR S.A.S.</div>
        </div>
        {msg && <div style={S.msg(msg.ok)}>{msg.txt}</div>}
        <div style={S.card}>
          <span style={S.label}>Usuario</span>
          <input style={{...S.input, marginBottom:8}} placeholder="Usuario" value={user} onChange={(e)=>setUser(e.target.value)} />
          <span style={S.label}>Contraseña</span>
          <div style={{ position:"relative" }}>
            <input style={{...S.input, paddingRight:44}} type={show?"text":"password"} placeholder="Contraseña" value={pass} onChange={(e)=>setPass(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&check()} />
            <button onClick={()=>setShow(!show)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:16 }}>{show?"🙈":"👁"}</button>
          </div>
          <button style={S.btn("#16a34a")} onClick={check}>Ingresar al panel</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [workers,  setWorkers]  = useState(()=>load(STORAGE_KEYS.workers,  defaultWorkers));
  const [projects, setProjects] = useState(()=>load(STORAGE_KEYS.projects, defaultProjects));
  const [logs,     setLogs]     = useState(()=>load(STORAGE_KEYS.logs,     []));
  const [pins,     setPins]     = useState(()=>load(STORAGE_KEYS.pins,     {}));

  // auth: null | "welcome" | "workerLogin" | "adminLogin" | "worker" | "admin"
  const [auth,           setAuth]           = useState("welcome");
  const [currentWorker,  setCurrentWorker]  = useState(null);
  const [view,           setView]           = useState("worker");
  const [workerLog,      setWorkerLog]      = useState({ projectId:"", date:today(), isNovedad:false, novedad:"" });
  const [logMsg,         setLogMsg]         = useState(null);
  const [adminTab,       setAdminTab]       = useState("workers");
  const [newWorker,      setNewWorker]      = useState({ name:"", dailyRate:"", cedula:"", phone:"" });
  const [newProject,     setNewProject]     = useState({ name:"", budget:"" });
  const [dashRange,      setDashRange]      = useState({ from:today().slice(0,7)+"-01", to:today() });

  useEffect(()=>save(STORAGE_KEYS.workers,  workers),  [workers]);
  useEffect(()=>save(STORAGE_KEYS.projects, projects), [projects]);
  useEffect(()=>save(STORAGE_KEYS.logs,     logs),     [logs]);

  // ── Worker log ────────────────────────────────────────────────────────
  function submitLog() {
    if (!currentWorker) return;
    const entry = {
      id:Date.now().toString(), workerId:currentWorker.id,
      date:workerLog.date,
      projectId:workerLog.isNovedad ? workerLog.novedad : workerLog.projectId,
      isNovedad:workerLog.isNovedad,
    };
    if (!entry.projectId) { setLogMsg({ok:false,txt:"Selecciona un proyecto o novedad."}); return; }
    if (logs.find((l)=>l.workerId===entry.workerId&&l.date===entry.date)) {
      setLogMsg({ok:false,txt:"Ya registraste asistencia para esta fecha."}); return;
    }
    setLogs((p)=>[...p,entry]);
    setLogMsg({ok:true,txt:"✓ Registro guardado correctamente."});
    setTimeout(()=>setLogMsg(null),3000);
  }

  // ── Dashboard stats ───────────────────────────────────────────────────
  const dashStats = useMemo(()=>{
    const filtered = logs.filter((l)=>!l.isNovedad&&l.date>=dashRange.from&&l.date<=dashRange.to);
    return projects.map((p)=>{
      const pLogs = filtered.filter((l)=>l.projectId===p.id);
      let cost = 0;
      pLogs.forEach((l)=>{ const w=workers.find((x)=>x.id===l.workerId); if(w) cost+=w.dailyRate; });
      return {...p, days:pLogs.length, cost, pct:p.budget?Math.min(100,(cost/p.budget)*100):0};
    });
  },[logs,projects,workers,dashRange]);

  const workerStats = useMemo(()=>workers.map((w)=>{
    const wLogs = logs.filter((l)=>l.workerId===w.id&&!l.isNovedad&&l.date>=dashRange.from&&l.date<=dashRange.to);
    return {...w, days:wLogs.length, total:wLogs.length*w.dailyRate};
  }),[logs,workers,dashRange]);

  const novedadStats = useMemo(()=>{
    const nLogs = logs.filter((l)=>l.isNovedad&&l.date>=dashRange.from&&l.date<=dashRange.to);
    const map = {};
    novedades.forEach((n)=>{ map[n]=nLogs.filter((l)=>l.projectId===n).length; });
    return map;
  },[logs,dashRange]);

  // ── AUTH SCREENS ──────────────────────────────────────────────────────
  if (auth==="welcome")
    return <Welcome onSelect={(t)=>setAuth(t==="worker"?"workerLogin":"adminLogin")} />;

  if (auth==="workerLogin")
    return <WorkerLogin workers={workers} pins={pins} setPins={setPins}
      onLogin={(w)=>{ setCurrentWorker(w); setAuth("worker"); setView("worker"); }}
      onBack={()=>setAuth("welcome")} />;

  if (auth==="adminLogin")
    return <AdminLogin
      onLogin={()=>{ setAuth("admin"); setView("admin"); }}
      onBack={()=>setAuth("welcome")} />;

  // ── MAIN APP ──────────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap'); *{box-sizing:border-box;} select option{background:#0a0e1a;}`}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div>
          <div style={S.logo}>⚡ WorkTrack</div>
          <div style={S.sub}>
            {auth==="worker" ? `👷 ${currentWorker?.name}` : "🔧 Administrador"}
          </div>
        </div>
        <button onClick={()=>{ setAuth("welcome"); setCurrentWorker(null); }}
          style={{ background:"#1e2d50", border:"1px solid #2d3f6b", color:"#94a3b8", borderRadius:8, padding:"5px 12px", fontSize:11, cursor:"pointer" }}>
          Salir
        </button>
      </div>

      {/* ── VISTA COLABORADOR ────────────────────────────────────────── */}
      {auth==="worker" && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Registro Diario</div>
          {logMsg && <div style={S.msg(logMsg.ok)}>{logMsg.txt}</div>}

          <div style={S.card}>
            <span style={S.label}>Fecha</span>
            <input type="date" style={S.input} value={workerLog.date}
              onChange={(e)=>setWorkerLog({...workerLog,date:e.target.value})} />
          </div>

          <div style={S.card}>
            <span style={S.label}>Tipo de registro</span>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <button style={S.tab(!workerLog.isNovedad)} onClick={()=>setWorkerLog({...workerLog,isNovedad:false})}>🏗 Proyecto</button>
              <button style={S.tab(workerLog.isNovedad)}  onClick={()=>setWorkerLog({...workerLog,isNovedad:true})}>📋 Novedad</button>
            </div>
            {!workerLog.isNovedad ? (
              <>
                <span style={S.label}>Proyecto en el que estás hoy</span>
                <select style={S.select} value={workerLog.projectId}
                  onChange={(e)=>setWorkerLog({...workerLog,projectId:e.target.value})}>
                  <option value="">— Selecciona un proyecto —</option>
                  {projects.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </>
            ) : (
              <>
                <span style={S.label}>Tipo de novedad</span>
                <select style={S.select} value={workerLog.novedad}
                  onChange={(e)=>setWorkerLog({...workerLog,novedad:e.target.value})}>
                  <option value="">— Selecciona novedad —</option>
                  {novedades.map((n)=><option key={n} value={n}>{n}</option>)}
                </select>
              </>
            )}
          </div>

          <button style={S.btn("#16a34a")} onClick={submitLog}>✓ Registrar asistencia</button>

          <div style={{...S.sectionTitle, marginTop:20}}>Mi historial reciente</div>
          {logs.filter((l)=>l.workerId===currentWorker?.id).slice(-5).reverse().map((l)=>{
            const proj = projects.find((p)=>p.id===l.projectId);
            return (
              <div key={l.id} style={{...S.card, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{proj?proj.name:l.projectId}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{fmtDate(l.date)}</div>
                </div>
                <div style={S.badge(l.isNovedad?"#2d1b00":"#052e16")}>{l.isNovedad?"📋 Novedad":"🏗 Proyecto"}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── VISTA ADMIN ──────────────────────────────────────────────── */}
      {auth==="admin" && view==="admin" && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Panel Administrador</div>
          <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
            {["workers","projects","logs"].map((t)=>(
              <button key={t} style={S.tab(adminTab===t)} onClick={()=>setAdminTab(t)}>
                {t==="workers"?"👷 Trabajadores":t==="projects"?"🏗 Proyectos":"📋 Registros"}
              </button>
            ))}
          </div>

          {adminTab==="workers" && (
            <>
              <div style={S.card}>
                <span style={S.label}>Agregar trabajador</span>
                <input placeholder="Nombre completo" style={{...S.input,marginBottom:8}} value={newWorker.name} onChange={(e)=>setNewWorker({...newWorker,name:e.target.value})} />
                <input placeholder="Cédula" type="number" style={{...S.input,marginBottom:8}} value={newWorker.cedula} onChange={(e)=>setNewWorker({...newWorker,cedula:e.target.value})} />
                <input placeholder="Celular (para recuperar PIN)" type="tel" style={{...S.input,marginBottom:8}} value={newWorker.phone} onChange={(e)=>setNewWorker({...newWorker,phone:e.target.value})} />
                <input placeholder="Valor día (COP)" type="number" style={{...S.input,marginBottom:8}} value={newWorker.dailyRate} onChange={(e)=>setNewWorker({...newWorker,dailyRate:e.target.value})} />
                <button style={S.btn()} onClick={()=>{
                  if (!newWorker.name||!newWorker.cedula||!newWorker.dailyRate) return;
                  setWorkers((p)=>[...p,{id:Date.now().toString(),name:newWorker.name,cedula:newWorker.cedula,phone:newWorker.phone,dailyRate:Number(newWorker.dailyRate)}]);
                  setNewWorker({name:"",dailyRate:"",cedula:"",phone:""});
                }}>+ Agregar trabajador</button>
              </div>
              {workers.map((w)=>(
                <div key={w.id} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:700}}>{w.name}</div>
                    <div style={{fontSize:12,color:"#64748b"}}>CC {w.cedula} · {fmt(w.dailyRate)}/día</div>
                    <div style={{fontSize:11,color:"#475569"}}>📱 {w.phone||"Sin celular"}</div>
                  </div>
                  <button style={{...S.btnSm,color:"#f87171",borderColor:"#7f1d1d"}}
                    onClick={()=>setWorkers((p)=>p.filter((x)=>x.id!==w.id))}>Eliminar</button>
                </div>
              ))}
            </>
          )}

          {adminTab==="projects" && (
            <>
              <div style={S.card}>
                <span style={S.label}>Agregar proyecto</span>
                <input placeholder="Nombre del proyecto" style={{...S.input,marginBottom:8}} value={newProject.name} onChange={(e)=>setNewProject({...newProject,name:e.target.value})} />
                <input placeholder="Presupuesto mano de obra (COP)" type="number" style={{...S.input,marginBottom:8}} value={newProject.budget} onChange={(e)=>setNewProject({...newProject,budget:e.target.value})} />
                <button style={S.btn()} onClick={()=>{
                  if (!newProject.name) return;
                  setProjects((p)=>[...p,{id:Date.now().toString(),name:newProject.name,budget:Number(newProject.budget)||0}]);
                  setNewProject({name:"",budget:""});
                }}>+ Agregar proyecto</button>
              </div>
              {projects.map((p)=>(
                <div key={p.id} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:700}}>{p.name}</div>
                    <div style={{fontSize:12,color:"#64748b"}}>Presupuesto MO: {fmt(p.budget)}</div>
                  </div>
                  <button style={{...S.btnSm,color:"#f87171",borderColor:"#7f1d1d"}}
                    onClick={()=>setProjects((pr)=>pr.filter((x)=>x.id!==p.id))}>Eliminar</button>
                </div>
              ))}
              <div style={{...S.card,background:"#0d1530",marginTop:4}}>
                <span style={S.label}>Novedades predefinidas</span>
                {novedades.map((n)=><div key={n} style={{...S.badge("#1e2d50"),margin:"4px 4px 0 0"}}>{n}</div>)}
              </div>
            </>
          )}

          {adminTab==="logs" && (
            <>
              <div style={{...S.card,background:"#0d1530",marginBottom:12}}>
                <div style={{fontSize:13,color:"#94a3b8"}}>Total registros: <strong style={{color:"#60a5fa"}}>{logs.length}</strong></div>
              </div>
              {logs.slice(-20).reverse().map((l)=>{
                const w = workers.find((x)=>x.id===l.workerId);
                const p = projects.find((x)=>x.id===l.projectId);
                return (
                  <div key={l.id} style={{...S.card,padding:"10px 14px"}}>
                    <div style={S.row}>
                      <span style={{fontWeight:600,fontSize:13}}>{w?.name||"?"}</span>
                      <span style={{fontSize:11,color:"#64748b"}}>{fmtDate(l.date)}</span>
                    </div>
                    <div style={{fontSize:12,color:"#94a3b8"}}>{p?p.name:l.projectId}</div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── VISTA DASHBOARD ──────────────────────────────────────────── */}
      {auth==="admin" && view==="dashboard" && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Dashboard Nómina</div>
          <div style={{...S.card,display:"flex",gap:8}}>
            <div style={{flex:1}}>
              <span style={S.label}>Desde</span>
              <input type="date" style={S.input} value={dashRange.from} onChange={(e)=>setDashRange({...dashRange,from:e.target.value})} />
            </div>
            <div style={{flex:1}}>
              <span style={S.label}>Hasta</span>
              <input type="date" style={S.input} value={dashRange.to} onChange={(e)=>setDashRange({...dashRange,to:e.target.value})} />
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <div style={S.statBox}>
              <div style={S.statNum}>{dashStats.reduce((a,b)=>a+b.days,0)}</div>
              <div style={S.statLbl}>Días Totales</div>
            </div>
            <div style={S.statBox}>
              <div style={{...S.statNum,fontSize:16}}>{fmt(workerStats.reduce((a,b)=>a+b.total,0))}</div>
              <div style={S.statLbl}>Costo Total</div>
            </div>
          </div>
          <div style={S.sectionTitle}>Por Proyecto</div>
          {dashStats.map((p)=>(
            <div key={p.id} style={S.card}>
              <div style={S.row}>
                <span style={{fontWeight:700,fontSize:14}}>{p.name}</span>
                <span style={S.badge(p.pct>80?"#450a0a":"#052e16")}>{p.days} días</span>
              </div>
              <div style={S.row}>
                <span style={{fontSize:12,color:"#64748b"}}>Costo MO: <strong style={{color:"#e8eaf6"}}>{fmt(p.cost)}</strong></span>
                <span style={{fontSize:12,color:"#64748b"}}>Presup: {fmt(p.budget)}</span>
              </div>
              <div style={S.progress()}><div style={S.progressFill(p.pct,p.pct>80?"#ef4444":"#22c55e")} /></div>
              <div style={{fontSize:11,color:"#64748b",marginTop:4,textAlign:"right"}}>{p.pct.toFixed(1)}% del presupuesto</div>
            </div>
          ))}
          <div style={S.sectionTitle}>Por Trabajador</div>
          {workerStats.sort((a,b)=>b.days-a.days).map((w)=>(
            <div key={w.id} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:700}}>{w.name}</div>
                <div style={{fontSize:12,color:"#64748b"}}>{w.days} días · {fmt(w.dailyRate)}/día</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,color:"#60a5fa",fontSize:15}}>{fmt(w.total)}</div>
                <div style={{fontSize:11,color:"#64748b"}}>total período</div>
              </div>
            </div>
          ))}
          <div style={S.sectionTitle}>Novedades del período</div>
          <div style={{...S.card,display:"flex",flexWrap:"wrap",gap:8}}>
            {novedades.map((n)=>(
              <div key={n} style={{background:"#0d1530",border:"1px solid #1e2d50",borderRadius:10,padding:"8px 14px",textAlign:"center",minWidth:100}}>
                <div style={{fontWeight:800,fontSize:20,color:"#f59e0b"}}>{novedadStats[n]}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{n}</div>
              </div>
            ))}
          </div>
          <button style={S.btn("#16a34a")} onClick={()=>exportExcel(workers,projects,logs)}>
            ⬇ Exportar Excel de Nómina
          </button>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav style={S.nav}>
        {auth==="worker" && (
          <button style={S.navBtn(true)}>
            <span style={S.navIcon}>👷</span>Asistencia
          </button>
        )}
        {auth==="admin" && [["admin","⚙️","Admin"],["dashboard","📊","Dashboard"]].map(([v,icon,label])=>(
          <button key={v} style={S.navBtn(view===v)} onClick={()=>setView(v)}>
            <span style={S.navIcon}>{icon}</span>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}