import { useState, useEffect, useMemo, useCallback } from "react";

// ── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  workers:"wt_workers", projects:"wt_projects", logs:"wt_logs", pins:"wt_pins"
};
const defaultWorkers = [
  { id:"w1", name:"Carlos Pérez",  dailyRate:120000, cedula:"12345678", phone:"3001234567" },
  { id:"w2", name:"Juan García",   dailyRate:100000, cedula:"23456789", phone:"3012345678" },
  { id:"w3", name:"Luis Martínez", dailyRate:90000,  cedula:"34567890", phone:"3023456789" },
];
const defaultProjects = [
  { id:"p1", name:"PROALCO – Segunda Etapa Solar", budget:50000000, status:"activo", lat:"", lng:"" },
  { id:"p2", name:"Mantenimiento Planta Norte",    budget:20000000, status:"activo", lat:"", lng:"" },
];
const novedades = ["Incapacidad","Capacitación","Permiso","Vacaciones","Día libre"];
const ADMIN     = { user:"casistpiv2026", pass:"901594783" };
const EMAILJS   = { serviceId:"service_ddxoc6q", templateId:"zadpb6s", publicKey:"paQD7l7QADewhUNjI" };

function load(key,def){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):def; }catch{ return def; } }
function save(key,val){ try{ localStorage.setItem(key,JSON.stringify(val)); }catch{} }

const today   = ()=>new Date().toISOString().slice(0,10);
const fmt     = (n)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
const fmtDate = (d)=>new Date(d+"T12:00:00").toLocaleDateString("es-CO",{weekday:"short",day:"2-digit",month:"short"});
const fmtTime = (ts)=>{ if(!ts) return ""; const d=new Date(ts); return d.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}); };

// ── GPS helpers ───────────────────────────────────────────────────────────────
function getGPS(){ return new Promise((res,rej)=>{
  if(!navigator.geolocation){ rej(new Error("GPS no disponible")); return; }
  navigator.geolocation.getCurrentPosition(
    (p)=>res({ lat:p.coords.latitude, lng:p.coords.longitude, acc:Math.round(p.coords.accuracy) }),
    (e)=>rej(e),
    { enableHighAccuracy:true, timeout:15000, maximumAge:0 }
  );
}); }

function distKm(lat1,lng1,lat2,lng2){
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lat2-lng2)*Math.PI/180; // typo kept: lng2-lng2 same as 0 — fixed below
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(((lng2-lng1)*Math.PI/180)/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function distancia(lat1,lng1,lat2,lng2){
  if(!lat1||!lng1||!lat2||!lng2) return null;
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  const km=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return km;
}

async function sendHealthAlert(workerName,cedula,observation,fecha){
  try{
    const res=await fetch("https://api.emailjs.com/api/v1.0/email/send",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ service_id:EMAILJS.serviceId, template_id:EMAILJS.templateId, user_id:EMAILJS.publicKey,
        template_params:{ to_email:"nmonsalve@pivmansolar.com", worker_name:workerName, cedula, fecha, observacion:observation } }),
    });
    return res.ok;
  }catch{ return false; }
}

function exportExcel(workers,projects,logs){
  const rows=[["Fecha","Trabajador","Ubicación / Proyecto","Tipo","Lat","Lng","Precisión(m)","Valor Día (COP)","Total (COP)"]];
  workers.forEach((w)=>{
    logs.filter((l)=>l.workerId===w.id).sort((a,b)=>a.date.localeCompare(b.date)).forEach((l)=>{
      const proj=projects.find((p)=>p.id===l.projectId);
      const ubicLabel=l.ubicacion==="proyecto"?(proj?proj.name:l.projectId)
        :l.ubicacion==="garantia"?`Garantía – ${proj?proj.name:l.projectId}`
        :l.isNovedad?l.projectId:l.ubicacion||l.projectId;
      rows.push([l.date,w.name,ubicLabel,l.isNovedad?"Novedad":"Trabajo",l.gps?.lat||"",l.gps?.lng||"",l.gps?.acc||"",w.dailyRate,w.dailyRate]);
    });
  });
  const ws=rows.map((r)=>r.join("\t")).join("\n");
  const blob=new Blob(["\ufeff"+ws],{type:"text/tab-separated-values;charset=utf-8;"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`nomina_${today()}.xls`; a.click();
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S={
  app:    {minHeight:"100vh",background:"#0a0e1a",color:"#e8eaf6",fontFamily:"'DM Sans','Segoe UI',sans-serif",paddingBottom:80},
  header: {background:"linear-gradient(135deg,#1a2240 0%,#0d1530 100%)",borderBottom:"1px solid #1e2d50",padding:"18px 20px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"},
  logo:   {fontSize:18,fontWeight:700,color:"#60a5fa",letterSpacing:"-0.5px"},
  sub:    {fontSize:11,color:"#64748b",marginTop:2},
  nav:    {position:"fixed",bottom:0,left:0,right:0,background:"#0d1530",borderTop:"1px solid #1e2d50",display:"flex",justifyContent:"space-around",padding:"8px 0 10px",zIndex:100},
  navBtn: (a)=>({background:"none",border:"none",color:a?"#60a5fa":"#475569",fontSize:11,fontWeight:a?700:400,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 12px",borderRadius:8}),
  navIcon:{fontSize:20},
  card:   {background:"#111827",border:"1px solid #1e2d50",borderRadius:14,padding:16,marginBottom:12},
  label:  {fontSize:11,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:6,display:"block"},
  input:  {width:"100%",background:"#0a0e1a",border:"1px solid #1e2d50",borderRadius:8,padding:"10px 12px",color:"#e8eaf6",fontSize:14,outline:"none",boxSizing:"border-box"},
  textarea:{width:"100%",background:"#0a0e1a",border:"1px solid #1e2d50",borderRadius:8,padding:"10px 12px",color:"#e8eaf6",fontSize:14,outline:"none",boxSizing:"border-box",minHeight:90,resize:"vertical"},
  select: {width:"100%",background:"#0a0e1a",border:"1px solid #1e2d50",borderRadius:8,padding:"10px 12px",color:"#e8eaf6",fontSize:14,outline:"none",boxSizing:"border-box"},
  btn:    (c="#3b82f6")=>({background:c,color:"#fff",border:"none",borderRadius:10,padding:"12px 20px",fontWeight:700,fontSize:14,cursor:"pointer",width:"100%",marginTop:8}),
  btnSm:  {background:"#1e3a5f",color:"#60a5fa",border:"1px solid #2563eb",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:600},
  badge:  (c="#1e3a5f")=>({background:c,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600,display:"inline-block"}),
  row:    {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6},
  statBox:{background:"#0d1530",border:"1px solid #1e2d50",borderRadius:12,padding:14,flex:1,textAlign:"center"},
  statNum:{fontSize:22,fontWeight:800,color:"#60a5fa"},
  statLbl:{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:1},
  progress:    ()=>({height:8,borderRadius:4,background:"#1e2d50",overflow:"hidden",marginTop:6}),
  progressFill:(pct,c="#3b82f6")=>({height:"100%",width:`${pct}%`,background:c,borderRadius:4,transition:"width 0.8s ease"}),
  section:     {padding:"16px 16px 0"},
  sectionTitle:{fontSize:13,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:12},
  msg:    (ok)=>({background:ok?"#052e16":"#2d0a0a",border:`1px solid ${ok?"#16a34a":"#dc2626"}`,color:ok?"#4ade80":"#f87171",borderRadius:10,padding:"10px 14px",fontSize:13,marginBottom:10,textAlign:"center"}),
  tab:    (a)=>({background:a?"#1e3a5f":"none",border:a?"1px solid #2563eb":"1px solid #1e2d50",color:a?"#60a5fa":"#64748b",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontWeight:a?700:400}),
  optBtn: (a)=>({background:a?"#1e3a5f":"#0d1530",border:`2px solid ${a?"#3b82f6":"#1e2d50"}`,color:a?"#60a5fa":"#94a3b8",borderRadius:12,padding:"12px 14px",cursor:"pointer",textAlign:"left",width:"100%",marginBottom:8,fontSize:13,fontWeight:a?700:400,display:"flex",alignItems:"center",gap:10}),
  yesno:  (a,c)=>({background:a?c==="yes"?"#052e16":"#2d0a0a":"#0d1530",border:`2px solid ${a?c==="yes"?"#16a34a":"#dc2626":"#1e2d50"}`,color:a?c==="yes"?"#4ade80":"#f87171":"#94a3b8",borderRadius:12,padding:"14px",cursor:"pointer",flex:1,textAlign:"center",fontWeight:700,fontSize:15}),
};

// ═══ WELCOME ═════════════════════════════════════════════════════════════════
function Welcome({onSelect}){
  return(
    <div style={{minHeight:"100vh",background:"#0a0e1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');*{box-sizing:border-box;}`}</style>
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{fontSize:56,marginBottom:8}}>⚡</div>
        <div style={{fontSize:28,fontWeight:800,color:"#60a5fa",letterSpacing:"-1px"}}>WorkTrack</div>
        <div style={{fontSize:13,color:"#64748b",marginTop:4}}>Control de asistencia y nómina</div>
      </div>
      <div style={{width:"100%",maxWidth:340}}>
        <p style={{textAlign:"center",color:"#94a3b8",fontSize:14,marginBottom:20}}>¿Cómo deseas ingresar?</p>
        <div onClick={()=>onSelect("worker")} style={{background:"linear-gradient(135deg,#1e3a5f,#1a2d4a)",border:"1px solid #2563eb",borderRadius:16,padding:"20px 24px",cursor:"pointer",marginBottom:12,display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:"#1e3a5f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>👷</div>
          <div><div style={{fontWeight:700,fontSize:16,color:"#e8eaf6"}}>Colaborador</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>Registra tu asistencia diaria</div></div>
          <div style={{marginLeft:"auto",color:"#3b82f6",fontSize:22}}>›</div>
        </div>
        <div onClick={()=>onSelect("admin")} style={{background:"linear-gradient(135deg,#1a2d1a,#0f1e0f)",border:"1px solid #16a34a",borderRadius:16,padding:"20px 24px",cursor:"pointer",display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:"#052e16",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🔐</div>
          <div><div style={{fontWeight:700,fontSize:16,color:"#e8eaf6"}}>Administrador</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>Gestión de proyectos y nómina</div></div>
          <div style={{marginLeft:"auto",color:"#22c55e",fontSize:22}}>›</div>
        </div>
      </div>
      <div style={{marginTop:32,fontSize:11,color:"#334155"}}>PIVMAN SOLAR S.A.S.</div>
    </div>
  );
}

// ═══ WORKER LOGIN ════════════════════════════════════════════════════════════
function WorkerLogin({workers,pins,setPins,onLogin,onBack}){
  const [step,setCedula_step]=useState("cedula");
  const [cedula,setCedula]=useState("");
  const [pin,setPin]=useState("");
  const [pin2,setPin2]=useState("");
  const [phone,setPhone]=useState("");
  const [msg,setMsg]=useState(null);
  const [found,setFound]=useState(null);
  function checkCedula(){const w=workers.find((x)=>x.cedula===cedula.trim());if(!w){setMsg({ok:false,txt:"Cédula no registrada. Contacta al administrador."});return;}setFound(w);setMsg(null);if(pins[w.id])setCedula_step("pin");else setCedula_step("setpin");}
  function checkPin(){if(pins[found.id]===pin){onLogin(found);}else{setMsg({ok:false,txt:"PIN incorrecto."});setPin("");}}
  function setNewPin(){if(pin.length<4){setMsg({ok:false,txt:"Mínimo 4 dígitos."});return;}if(pin!==pin2){setMsg({ok:false,txt:"Los PINs no coinciden."});return;}const u={...pins,[found.id]:pin};setPins(u);save(STORAGE_KEYS.pins,u);onLogin(found);}
  function recoverPin(){if(phone.trim()===found.phone){const u={...pins};delete u[found.id];setPins(u);save(STORAGE_KEYS.pins,u);setMsg({ok:true,txt:"PIN restablecido. Crea uno nuevo."});setTimeout(()=>{setMsg(null);setPin("");setPin2("");setCedula_step("setpin");},2000);}else{setMsg({ok:false,txt:"Número de celular incorrecto."}); }}
  return(
    <div style={{minHeight:"100vh",background:"#0a0e1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');*{box-sizing:border-box;}`}</style>
      <div style={{width:"100%",maxWidth:360}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:13,marginBottom:20,display:"flex",alignItems:"center",gap:6}}>‹ Volver</button>
        <div style={{textAlign:"center",marginBottom:28}}><div style={{fontSize:40}}>👷</div><div style={{fontSize:20,fontWeight:800,color:"#e8eaf6",marginTop:8}}>Acceso Colaborador</div>{found&&<div style={{fontSize:13,color:"#60a5fa",marginTop:4}}>{found.name}</div>}</div>
        {msg&&<div style={S.msg(msg.ok)}>{msg.txt}</div>}
        {step==="cedula"&&<div style={S.card}><span style={S.label}>Número de cédula</span><input style={S.input} type="number" placeholder="Ej: 1234567890" value={cedula} onChange={(e)=>setCedula(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&checkCedula()}/><button style={S.btn()} onClick={checkCedula}>Continuar →</button></div>}
        {step==="pin"&&<div style={S.card}><span style={S.label}>Ingresa tu PIN</span><input style={{...S.input,letterSpacing:8,fontSize:20,textAlign:"center"}} type="password" inputMode="numeric" maxLength={8} placeholder="● ● ● ●" value={pin} onChange={(e)=>setPin(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&checkPin()}/><button style={S.btn()} onClick={checkPin}>Ingresar</button><button onClick={()=>{setCedula_step("recover");setMsg(null);}} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:12,marginTop:10,width:"100%",textAlign:"center"}}>¿Olvidaste tu PIN?</button></div>}
        {step==="setpin"&&<div style={S.card}><div style={{fontSize:13,color:"#f59e0b",marginBottom:12,textAlign:"center"}}>👋 Primera vez — crea tu PIN</div><span style={S.label}>Nuevo PIN (mínimo 4 dígitos)</span><input style={{...S.input,letterSpacing:8,fontSize:20,textAlign:"center",marginBottom:8}} type="password" inputMode="numeric" maxLength={8} placeholder="● ● ● ●" value={pin} onChange={(e)=>setPin(e.target.value)}/><span style={S.label}>Confirma tu PIN</span><input style={{...S.input,letterSpacing:8,fontSize:20,textAlign:"center"}} type="password" inputMode="numeric" maxLength={8} placeholder="● ● ● ●" value={pin2} onChange={(e)=>setPin2(e.target.value)}/><button style={S.btn("#16a34a")} onClick={setNewPin}>Guardar PIN e ingresar</button></div>}
        {step==="recover"&&<div style={S.card}><div style={{fontSize:13,color:"#94a3b8",marginBottom:12,textAlign:"center"}}>Ingresa el celular registrado por el administrador</div><span style={S.label}>Número de celular</span><input style={S.input} type="tel" placeholder="Ej: 3001234567" value={phone} onChange={(e)=>setPhone(e.target.value)}/><button style={S.btn("#f59e0b")} onClick={recoverPin}>Verificar y restablecer PIN</button><button onClick={()=>{setCedula_step("pin");setMsg(null);}} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:12,marginTop:10,width:"100%",textAlign:"center"}}>← Volver al PIN</button></div>}
      </div>
    </div>
  );
}

// ═══ ADMIN LOGIN ═════════════════════════════════════════════════════════════
function AdminLogin({onLogin,onBack}){
  const [user,setUser]=useState(""); const [pass,setPass]=useState(""); const [msg,setMsg]=useState(null); const [show,setShow]=useState(false);
  function check(){if(user===ADMIN.user&&pass===ADMIN.pass)onLogin();else setMsg({ok:false,txt:"Usuario o contraseña incorrectos."});}
  return(
    <div style={{minHeight:"100vh",background:"#0a0e1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');*{box-sizing:border-box;}`}</style>
      <div style={{width:"100%",maxWidth:360}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:13,marginBottom:20,display:"flex",alignItems:"center",gap:6}}>‹ Volver</button>
        <div style={{textAlign:"center",marginBottom:28}}><div style={{fontSize:40}}>🔐</div><div style={{fontSize:20,fontWeight:800,color:"#e8eaf6",marginTop:8}}>Acceso Administrador</div><div style={{fontSize:12,color:"#64748b",marginTop:4}}>PIVMAN SOLAR S.A.S.</div></div>
        {msg&&<div style={S.msg(msg.ok)}>{msg.txt}</div>}
        <div style={S.card}>
          <span style={S.label}>Usuario</span><input style={{...S.input,marginBottom:8}} placeholder="Usuario" value={user} onChange={(e)=>setUser(e.target.value)}/>
          <span style={S.label}>Contraseña</span>
          <div style={{position:"relative"}}><input style={{...S.input,paddingRight:44}} type={show?"text":"password"} placeholder="Contraseña" value={pass} onChange={(e)=>setPass(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&check()}/><button onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:16}}>{show?"🙈":"👁"}</button></div>
          <button style={S.btn("#16a34a")} onClick={check}>Ingresar al panel</button>
        </div>
      </div>
    </div>
  );
}

// ═══ WORKER CHECKIN ══════════════════════════════════════════════════════════
function WorkerCheckin({worker,projects,onComplete,onBack}){
  const [step,setStep]=useState("ubicacion");
  const [ubicTipo,setUbicTipo]=useState("");
  const [projectId,setProjectId]=useState("");
  const [garantiaId,setGarantiaId]=useState("");
  const [saludResp,setSaludResp]=useState("");
  const [observ,setObserv]=useState("");
  const [sending,setSending]=useState(false);
  const [msg,setMsg]=useState(null);
  const activeProjects=projects.filter((p)=>p.status!=="cerrado");

  async function finishCheckin(){
    setSending(true);
    setMsg({ok:true,txt:"📍 Obteniendo ubicación GPS..."});
    let gps=null;
    try{ gps=await getGPS(); }catch(e){ gps=null; }
    let emailOk=true;
    if(saludResp==="si"&&observ.trim()) emailOk=await sendHealthAlert(worker.name,worker.cedula,observ,today());
    const entry={
      id:Date.now().toString(), workerId:worker.id, date:today(), timestamp:Date.now(),
      ubicacion:ubicTipo,
      projectId:ubicTipo==="proyecto"?projectId:ubicTipo==="garantia"?garantiaId:"",
      isNovedad:false, saludAlerta:saludResp==="si", observacion:saludResp==="si"?observ:"",
      gps,
    };
    setSending(false);
    onComplete(entry,emailOk,gps);
  }

  if(step==="ubicacion") return(
    <div style={{minHeight:"100vh",background:"#0a0e1a",display:"flex",flexDirection:"column",padding:24}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');*{box-sizing:border-box;}`}</style>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:13,marginBottom:16,display:"flex",alignItems:"center",gap:6}}>‹ Salir</button>
      <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:32}}>📍</div><div style={{fontSize:18,fontWeight:800,color:"#e8eaf6",marginTop:6}}>¿Dónde estás hoy?</div><div style={{fontSize:12,color:"#60a5fa",marginTop:2}}>{worker.name} · {today()}</div></div>
      <div style={{fontSize:12,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Proyectos activos</div>
      {activeProjects.map((p)=>(<button key={p.id} style={S.optBtn(ubicTipo==="proyecto"&&projectId===p.id)} onClick={()=>{setUbicTipo("proyecto");setProjectId(p.id);}}><span style={{fontSize:20}}>🏗</span><div><div style={{fontWeight:700}}>{p.name}</div><div style={{fontSize:11,color:"#64748b"}}>Proyecto activo</div></div></button>))}
      <div style={{fontSize:12,color:"#64748b",textTransform:"uppercase",letterSpacing:1,margin:"12px 0 10px"}}>Otras ubicaciones</div>
      {[["bodega","🏭","Bodega"],["mantenimiento","🔧","Mantenimiento"],["garantia","🔄","Elaborando Garantía"]].map(([val,icon,label])=>(<button key={val} style={S.optBtn(ubicTipo===val)} onClick={()=>{setUbicTipo(val);setProjectId("");}}><span style={{fontSize:20}}>{icon}</span><div><div style={{fontWeight:700}}>{label}</div></div></button>))}
      {msg&&<div style={{...S.msg(false),marginTop:8}}>{msg.txt}</div>}
      <button style={{...S.btn("#3b82f6"),marginTop:16}} onClick={()=>{if(!ubicTipo){setMsg({ok:false,txt:"Selecciona tu ubicación."});return;}if(ubicTipo==="proyecto"&&!projectId){setMsg({ok:false,txt:"Selecciona el proyecto."});return;}if(ubicTipo==="garantia"){setStep("garantia");}else setStep("sst");}}>Continuar →</button>
    </div>
  );

  if(step==="garantia") return(
    <div style={{minHeight:"100vh",background:"#0a0e1a",display:"flex",flexDirection:"column",padding:24}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');*{box-sizing:border-box;}`}</style>
      <button onClick={()=>setStep("ubicacion")} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:13,marginBottom:16,display:"flex",alignItems:"center",gap:6}}>‹ Volver</button>
      <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:32}}>🔄</div><div style={{fontSize:18,fontWeight:800,color:"#e8eaf6",marginTop:6}}>¿Garantía de qué proyecto?</div></div>
      <div style={{fontSize:12,color:"#22c55e",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Activos</div>
      {projects.filter(p=>p.status!=="cerrado").map((p)=>(<button key={p.id} style={S.optBtn(garantiaId===p.id)} onClick={()=>setGarantiaId(p.id)}><span>🟢</span><div style={{fontWeight:700,fontSize:13}}>{p.name}</div></button>))}
      <div style={{fontSize:12,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,margin:"12px 0 8px"}}>Cerrados</div>
      {projects.filter(p=>p.status==="cerrado").length===0?<div style={{fontSize:13,color:"#334155",marginBottom:8}}>No hay proyectos cerrados.</div>:projects.filter(p=>p.status==="cerrado").map((p)=>(<button key={p.id} style={S.optBtn(garantiaId===p.id)} onClick={()=>setGarantiaId(p.id)}><span>🔴</span><div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:11,color:"#64748b"}}>Cerrado</div></div></button>))}
      {msg&&<div style={{...S.msg(false),marginTop:8}}>{msg.txt}</div>}
      <button style={{...S.btn("#f59e0b"),marginTop:16}} onClick={()=>{if(!garantiaId){setMsg({ok:false,txt:"Selecciona el proyecto."});return;}setStep("sst");}}>Continuar →</button>
    </div>
  );

  if(step==="sst") return(
    <div style={{minHeight:"100vh",background:"#0a0e1a",display:"flex",flexDirection:"column",padding:24}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');*{box-sizing:border-box;}`}</style>
      <div style={{textAlign:"center",marginBottom:28}}><div style={{fontSize:36}}>❤️</div><div style={{fontSize:18,fontWeight:800,color:"#e8eaf6",marginTop:6}}>Encuesta de Salud</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>Seguridad y Salud en el Trabajo</div></div>
      <div style={{...S.card,borderColor:"#1e3a5f"}}>
        <div style={{fontSize:15,fontWeight:600,color:"#e8eaf6",marginBottom:16,lineHeight:1.5}}>¿Tienes alguna condición de salud a reportar que te impida ejercer correctamente tus actividades hoy?</div>
        <div style={{display:"flex",gap:12,marginBottom:16}}>
          <button style={S.yesno(saludResp==="si","yes")} onClick={()=>setSaludResp("si")}>✅ Sí</button>
          <button style={S.yesno(saludResp==="no","no")} onClick={()=>setSaludResp("no")}>✗ No</button>
        </div>
        {saludResp==="si"&&<div style={{marginTop:4}}><span style={S.label}>Describe tu condición de salud</span><textarea style={S.textarea} placeholder="Describe aquí tu condición..." value={observ} onChange={(e)=>setObserv(e.target.value)}/><div style={{fontSize:11,color:"#f59e0b",marginTop:6}}>⚠️ Será enviado a nmonsalve@pivmansolar.com</div></div>}
      </div>
      <div style={{...S.card,background:"#0d1530",borderColor:"#1e3a5f"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>📍</span><div><div style={{fontSize:13,fontWeight:600,color:"#e8eaf6"}}>Captura de ubicación GPS</div><div style={{fontSize:11,color:"#64748b"}}>Se capturará automáticamente al registrar</div></div></div>
      </div>
      {msg&&<div style={S.msg(msg.ok)}>{msg.txt}</div>}
      <button style={S.btn(saludResp==="si"?"#dc2626":"#16a34a")} disabled={!saludResp||sending}
        onClick={()=>{if(!saludResp){setMsg({ok:false,txt:"Por favor responde la pregunta."});return;}if(saludResp==="si"&&!observ.trim()){setMsg({ok:false,txt:"Describe tu condición de salud."});return;}finishCheckin();}}>
        {sending?"⏳ Registrando y obteniendo GPS...":"✓ Completar registro"}
      </button>
    </div>
  );
  return null;
}

// ═══ MAPA DE UBICACIONES (Admin) ══════════════════════════════════════════════
function MapaUbicaciones({logs,workers,projects}){
  const [filtroFecha,setFiltroFecha]=useState(today());

  const logsDelDia=logs.filter((l)=>l.date===filtroFecha&&l.gps);
  const sinGps=logs.filter((l)=>l.date===filtroFecha&&!l.gps).length;

  return(
    <div>
      <div style={{...S.card,display:"flex",gap:8,alignItems:"center"}}>
        <div style={{flex:1}}>
          <span style={S.label}>Ver ubicaciones del día</span>
          <input type="date" style={S.input} value={filtroFecha} onChange={(e)=>setFiltroFecha(e.target.value)}/>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <div style={S.statBox}><div style={S.statNum}>{logsDelDia.length}</div><div style={S.statLbl}>Con GPS</div></div>
        <div style={S.statBox}><div style={{...S.statNum,color:"#f59e0b"}}>{sinGps}</div><div style={S.statLbl}>Sin GPS</div></div>
      </div>

      {logsDelDia.length===0&&(
        <div style={{...S.card,textAlign:"center",padding:"28px 16px"}}>
          <div style={{fontSize:32,marginBottom:8}}>🗺️</div>
          <div style={{color:"#64748b",fontSize:13}}>No hay registros con GPS para esta fecha.</div>
        </div>
      )}

      {logsDelDia.map((l)=>{
        const w=workers.find((x)=>x.id===l.workerId);
        const p=projects.find((x)=>x.id===l.projectId);
        const ubicLabel=l.ubicacion==="proyecto"?(p?p.name:"Proyecto")
          :l.ubicacion==="garantia"?`Garantía – ${p?p.name:""}`
          :l.ubicacion==="bodega"?"🏭 Bodega"
          :l.ubicacion==="mantenimiento"?"🔧 Mantenimiento":"—";

        // Calcular distancia si el proyecto tiene coordenadas
        let distInfo=null;
        if(l.ubicacion==="proyecto"&&p&&p.lat&&p.lng&&l.gps){
          const km=distancia(l.gps.lat,l.gps.lng,parseFloat(p.lat),parseFloat(p.lng));
          const m=Math.round(km*1000);
          distInfo={ m, ok:m<=500 };
        }

        const mapsUrl=`https://www.google.com/maps?q=${l.gps.lat},${l.gps.lng}`;

        return(
          <div key={l.id} style={{...S.card,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>{w?.name||"?"}</div>
                <div style={{fontSize:12,color:"#64748b"}}>{ubicLabel}</div>
                <div style={{fontSize:11,color:"#475569",marginTop:2}}>🕐 {fmtTime(l.timestamp)}</div>
              </div>
              {distInfo&&(
                <div style={{...S.badge(distInfo.ok?"#052e16":"#450a0a"),fontSize:12}}>
                  {distInfo.ok?"✅":"⚠️"} {distInfo.m<1000?`${distInfo.m}m`:`${(distInfo.m/1000).toFixed(1)}km`}
                </div>
              )}
            </div>

            {/* GPS info */}
            <div style={{background:"#0d1530",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <div><div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:1}}>Latitud</div><div style={{fontSize:13,fontWeight:600,color:"#60a5fa"}}>{l.gps.lat.toFixed(6)}</div></div>
                <div><div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:1}}>Longitud</div><div style={{fontSize:13,fontWeight:600,color:"#60a5fa"}}>{l.gps.lng.toFixed(6)}</div></div>
                <div><div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:1}}>Precisión</div><div style={{fontSize:13,fontWeight:600,color:"#f59e0b"}}>±{l.gps.acc}m</div></div>
              </div>
            </div>

            {distInfo&&!distInfo.ok&&(
              <div style={{background:"#2d0a0a",border:"1px solid #dc2626",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#f87171",marginBottom:8}}>
                ⚠️ El colaborador está a más de 500m del proyecto registrado
              </div>
            )}

            <a href={mapsUrl} target="_blank" rel="noreferrer"
              style={{display:"block",background:"#1e3a5f",border:"1px solid #2563eb",borderRadius:8,padding:"8px 12px",textAlign:"center",color:"#60a5fa",fontSize:12,fontWeight:700,textDecoration:"none"}}>
              🗺️ Ver en Google Maps
            </a>
          </div>
        );
      })}
    </div>
  );
}

// ═══ APP PRINCIPAL ════════════════════════════════════════════════════════════
export default function App(){
  const [workers, setWorkers] =useState(()=>load(STORAGE_KEYS.workers, defaultWorkers));
  const [projects,setProjects]=useState(()=>load(STORAGE_KEYS.projects,defaultProjects));
  const [logs,    setLogs]    =useState(()=>load(STORAGE_KEYS.logs,    []));
  const [pins,    setPins]    =useState(()=>load(STORAGE_KEYS.pins,    {}));

  const [auth,         setAuth]        =useState("welcome");
  const [currentWorker,setCurrentWorker]=useState(null);
  const [view,         setView]        =useState("admin");
  const [checkinDone,  setCheckinDone] =useState(false);
  const [checkinMsg,   setCheckinMsg]  =useState(null);
  const [adminTab,     setAdminTab]    =useState("workers");
  const [newWorker,    setNewWorker]   =useState({name:"",dailyRate:"",cedula:"",phone:""});
  const [newProject,   setNewProject]  =useState({name:"",budget:"",lat:"",lng:""});
  const [dashRange,    setDashRange]   =useState({from:today().slice(0,7)+"-01",to:today()});

  useEffect(()=>save(STORAGE_KEYS.workers, workers), [workers]);
  useEffect(()=>save(STORAGE_KEYS.projects,projects),[projects]);
  useEffect(()=>save(STORAGE_KEYS.logs,    logs),    [logs]);

  function handleCheckinComplete(entry,emailOk,gps){
    setLogs((p)=>[...p,entry]);
    setCheckinDone(true);
    let txt=gps
      ?"✓ Asistencia registrada. GPS capturado correctamente."
      :"✓ Asistencia registrada. No se pudo obtener GPS (verifica permisos de ubicación).";
    if(entry.saludAlerta) txt+=emailOk?" Alerta SST enviada.":" Alerta SST no enviada — verifica EmailJS.";
    setCheckinMsg({ok:true,txt});
  }

  const dashStats=useMemo(()=>{
    const filtered=logs.filter((l)=>!l.isNovedad&&l.date>=dashRange.from&&l.date<=dashRange.to);
    return projects.map((p)=>{
      const pLogs=filtered.filter((l)=>l.projectId===p.id);
      let cost=0; pLogs.forEach((l)=>{const w=workers.find((x)=>x.id===l.workerId);if(w)cost+=w.dailyRate;});
      return{...p,days:pLogs.length,cost,pct:p.budget?Math.min(100,(cost/p.budget)*100):0};
    });
  },[logs,projects,workers,dashRange]);

  const workerStats=useMemo(()=>workers.map((w)=>{
    const wLogs=logs.filter((l)=>l.workerId===w.id&&!l.isNovedad&&l.date>=dashRange.from&&l.date<=dashRange.to);
    return{...w,days:wLogs.length,total:wLogs.length*w.dailyRate};
  }),[logs,workers,dashRange]);

  const novedadStats=useMemo(()=>{
    const nLogs=logs.filter((l)=>l.isNovedad&&l.date>=dashRange.from&&l.date<=dashRange.to);
    const map={};novedades.forEach((n)=>{map[n]=nLogs.filter((l)=>l.projectId===n).length;});return map;
  },[logs,dashRange]);

  if(auth==="welcome") return <Welcome onSelect={(t)=>setAuth(t==="worker"?"workerLogin":"adminLogin")}/>;
  if(auth==="workerLogin") return <WorkerLogin workers={workers} pins={pins} setPins={setPins} onLogin={(w)=>{setCurrentWorker(w);setCheckinDone(false);setAuth("checkin");}} onBack={()=>setAuth("welcome")}/>;
  if(auth==="adminLogin") return <AdminLogin onLogin={()=>{setAuth("admin");setView("admin");}} onBack={()=>setAuth("welcome")}/>;
  if(auth==="checkin"&&!checkinDone) return <WorkerCheckin worker={currentWorker} projects={projects} onComplete={handleCheckinComplete} onBack={()=>setAuth("welcome")}/>;

  return(
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');*{box-sizing:border-box;}select option{background:#0a0e1a;}`}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div><div style={S.logo}>⚡ WorkTrack</div><div style={S.sub}>{auth==="checkin"?`👷 ${currentWorker?.name}`:"🔧 Administrador"}</div></div>
        <button onClick={()=>{setAuth("welcome");setCurrentWorker(null);setCheckinDone(false);}} style={{background:"#1e2d50",border:"1px solid #2d3f6b",color:"#94a3b8",borderRadius:8,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>Salir</button>
      </div>

      {/* COLABORADOR post-checkin */}
      {auth==="checkin"&&checkinDone&&(
        <div style={S.section}>
          {checkinMsg&&<div style={{...S.msg(checkinMsg.ok),marginBottom:16}}>{checkinMsg.txt}</div>}
          <div style={{...S.card,textAlign:"center",padding:"28px 20px"}}>
            <div style={{fontSize:48,marginBottom:8}}>✅</div>
            <div style={{fontSize:18,fontWeight:800,color:"#4ade80"}}>¡Registro completado!</div>
            <div style={{fontSize:13,color:"#64748b",marginTop:8}}>Tu asistencia del día ha sido registrada.</div>
            <div style={{fontSize:12,color:"#475569",marginTop:6}}>{today()}</div>
          </div>
          <div style={{...S.sectionTitle,marginTop:8}}>Mi historial reciente</div>
          {logs.filter((l)=>l.workerId===currentWorker?.id).slice(-5).reverse().map((l)=>{
            const proj=projects.find((p)=>p.id===l.projectId);
            const ubicLabel=l.ubicacion==="proyecto"?(proj?proj.name:"Proyecto"):l.ubicacion==="garantia"?`Garantía – ${proj?proj.name:""}`:l.ubicacion==="bodega"?"Bodega":l.ubicacion==="mantenimiento"?"Mantenimiento":l.projectId;
            return(<div key={l.id} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:13,fontWeight:600}}>{ubicLabel}</div><div style={{fontSize:11,color:"#64748b"}}>{fmtDate(l.date)}</div></div><div style={{display:"flex",gap:6}}>{l.gps&&<div style={S.badge("#052e16")}>📍GPS</div>}{l.saludAlerta&&<div style={S.badge("#450a0a")}>⚠️SST</div>}</div></div>);
          })}
        </div>
      )}

      {/* ADMIN */}
      {auth==="admin"&&view==="admin"&&(
        <div style={S.section}>
          <div style={S.sectionTitle}>Panel Administrador</div>
          <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
            {["workers","projects","logs"].map((t)=>(<button key={t} style={S.tab(adminTab===t)} onClick={()=>setAdminTab(t)}>{t==="workers"?"👷 Trabajadores":t==="projects"?"🏗 Proyectos":"📋 Registros"}</button>))}
          </div>

          {adminTab==="workers"&&(
            <>
              <div style={S.card}>
                <span style={S.label}>Agregar trabajador</span>
                <input placeholder="Nombre completo" style={{...S.input,marginBottom:8}} value={newWorker.name} onChange={(e)=>setNewWorker({...newWorker,name:e.target.value})}/>
                <input placeholder="Cédula" type="number" style={{...S.input,marginBottom:8}} value={newWorker.cedula} onChange={(e)=>setNewWorker({...newWorker,cedula:e.target.value})}/>
                <input placeholder="Celular" type="tel" style={{...S.input,marginBottom:8}} value={newWorker.phone} onChange={(e)=>setNewWorker({...newWorker,phone:e.target.value})}/>
                <input placeholder="Valor día (COP)" type="number" style={{...S.input,marginBottom:8}} value={newWorker.dailyRate} onChange={(e)=>setNewWorker({...newWorker,dailyRate:e.target.value})}/>
                <button style={S.btn()} onClick={()=>{if(!newWorker.name||!newWorker.cedula||!newWorker.dailyRate)return;setWorkers((p)=>[...p,{id:Date.now().toString(),name:newWorker.name,cedula:newWorker.cedula,phone:newWorker.phone,dailyRate:Number(newWorker.dailyRate)}]);setNewWorker({name:"",dailyRate:"",cedula:"",phone:""});}}>+ Agregar trabajador</button>
              </div>
              {workers.map((w)=>(<div key={w.id} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:700}}>{w.name}</div><div style={{fontSize:12,color:"#64748b"}}>CC {w.cedula} · {fmt(w.dailyRate)}/día</div><div style={{fontSize:11,color:"#475569"}}>📱 {w.phone||"Sin celular"}</div></div><button style={{...S.btnSm,color:"#f87171",borderColor:"#7f1d1d"}} onClick={()=>setWorkers((p)=>p.filter((x)=>x.id!==w.id))}>Eliminar</button></div>))}
            </>
          )}

          {adminTab==="projects"&&(
            <>
              <div style={S.card}>
                <span style={S.label}>Agregar proyecto</span>
                <input placeholder="Nombre del proyecto" style={{...S.input,marginBottom:8}} value={newProject.name} onChange={(e)=>setNewProject({...newProject,name:e.target.value})}/>
                <input placeholder="Presupuesto mano de obra (COP)" type="number" style={{...S.input,marginBottom:8}} value={newProject.budget} onChange={(e)=>setNewProject({...newProject,budget:e.target.value})}/>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <input placeholder="Latitud proyecto (opcional)" style={S.input} value={newProject.lat} onChange={(e)=>setNewProject({...newProject,lat:e.target.value})}/>
                  <input placeholder="Longitud proyecto (opcional)" style={S.input} value={newProject.lng} onChange={(e)=>setNewProject({...newProject,lng:e.target.value})}/>
                </div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>💡 Las coordenadas permiten calcular la distancia del colaborador al proyecto</div>
                <button style={S.btn()} onClick={()=>{if(!newProject.name)return;setProjects((p)=>[...p,{id:Date.now().toString(),name:newProject.name,budget:Number(newProject.budget)||0,status:"activo",lat:newProject.lat,lng:newProject.lng}]);setNewProject({name:"",budget:"",lat:"",lng:""});}}>+ Agregar proyecto</button>
              </div>
              {projects.map((p)=>(<div key={p.id} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{flex:1}}><div style={{fontWeight:700}}>{p.name}</div><div style={{fontSize:12,color:"#64748b"}}>Presupuesto: {fmt(p.budget)}</div>{p.lat&&<div style={{fontSize:11,color:"#475569"}}>📍 {p.lat}, {p.lng}</div>}<div style={{marginTop:4}}><span style={S.badge(p.status==="cerrado"?"#450a0a":"#052e16")}>{p.status==="cerrado"?"🔴 Cerrado":"🟢 Activo"}</span></div></div><div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}><button style={{...S.btnSm,color:p.status==="cerrado"?"#4ade80":"#f59e0b",borderColor:p.status==="cerrado"?"#16a34a":"#92400e"}} onClick={()=>setProjects((prev)=>prev.map((x)=>x.id===p.id?{...x,status:x.status==="cerrado"?"activo":"cerrado"}:x))}>{p.status==="cerrado"?"Reabrir":"Cerrar"}</button><button style={{...S.btnSm,color:"#f87171",borderColor:"#7f1d1d"}} onClick={()=>setProjects((pr)=>pr.filter((x)=>x.id!==p.id))}>Eliminar</button></div></div>))}
            </>
          )}

          {adminTab==="logs"&&(
            <>
              <div style={{...S.card,background:"#0d1530",marginBottom:12}}><div style={{fontSize:13,color:"#94a3b8"}}>Total registros: <strong style={{color:"#60a5fa"}}>{logs.length}</strong></div></div>
              {logs.slice(-30).reverse().map((l)=>{
                const w=workers.find((x)=>x.id===l.workerId);
                const p=projects.find((x)=>x.id===l.projectId);
                const ubicLabel=l.ubicacion==="proyecto"?(p?p.name:"Proyecto"):l.ubicacion==="garantia"?`Garantía – ${p?p.name:""}`:l.ubicacion==="bodega"?"🏭 Bodega":l.ubicacion==="mantenimiento"?"🔧 Mantenimiento":l.projectId;
                return(<div key={l.id} style={{...S.card,padding:"10px 14px"}}><div style={S.row}><span style={{fontWeight:600,fontSize:13}}>{w?.name||"?"}</span><span style={{fontSize:11,color:"#64748b"}}>{fmtDate(l.date)}</span></div><div style={{fontSize:12,color:"#94a3b8"}}>{ubicLabel}</div><div style={{display:"flex",gap:6,marginTop:4}}>{l.gps&&<span style={S.badge("#052e16")}>📍 GPS</span>}{l.saludAlerta&&<span style={{...S.badge("#450a0a"),fontSize:11}}>⚠️ SST</span>}</div>{l.saludAlerta&&<div style={{fontSize:11,color:"#f87171",marginTop:4}}>⚠️ {l.observacion}</div>}</div>);
              })}
            </>
          )}
        </div>
      )}

      {/* UBICACIONES */}
      {auth==="admin"&&view==="ubicaciones"&&(
        <div style={S.section}>
          <div style={S.sectionTitle}>📍 Ubicaciones del Personal</div>
          <MapaUbicaciones logs={logs} workers={workers} projects={projects}/>
        </div>
      )}

      {/* DASHBOARD */}
      {auth==="admin"&&view==="dashboard"&&(
        <div style={S.section}>
          <div style={S.sectionTitle}>Dashboard Nómina</div>
          <div style={{...S.card,display:"flex",gap:8}}>
            <div style={{flex:1}}><span style={S.label}>Desde</span><input type="date" style={S.input} value={dashRange.from} onChange={(e)=>setDashRange({...dashRange,from:e.target.value})}/></div>
            <div style={{flex:1}}><span style={S.label}>Hasta</span><input type="date" style={S.input} value={dashRange.to} onChange={(e)=>setDashRange({...dashRange,to:e.target.value})}/></div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <div style={S.statBox}><div style={S.statNum}>{dashStats.reduce((a,b)=>a+b.days,0)}</div><div style={S.statLbl}>Días Totales</div></div>
            <div style={S.statBox}><div style={{...S.statNum,fontSize:16}}>{fmt(workerStats.reduce((a,b)=>a+b.total,0))}</div><div style={S.statLbl}>Costo Total</div></div>
          </div>
          <div style={S.sectionTitle}>Por Proyecto</div>
          {dashStats.map((p)=>(<div key={p.id} style={S.card}><div style={S.row}><span style={{fontWeight:700,fontSize:14}}>{p.name}</span><span style={S.badge(p.pct>80?"#450a0a":"#052e16")}>{p.days} días</span></div><div style={S.row}><span style={{fontSize:12,color:"#64748b"}}>Costo MO: <strong style={{color:"#e8eaf6"}}>{fmt(p.cost)}</strong></span><span style={{fontSize:12,color:"#64748b"}}>Presup: {fmt(p.budget)}</span></div><div style={S.progress()}><div style={S.progressFill(p.pct,p.pct>80?"#ef4444":"#22c55e")}/></div><div style={{fontSize:11,color:"#64748b",marginTop:4,textAlign:"right"}}>{p.pct.toFixed(1)}%</div></div>))}
          <div style={S.sectionTitle}>Por Trabajador</div>
          {workerStats.sort((a,b)=>b.days-a.days).map((w)=>(<div key={w.id} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:700}}>{w.name}</div><div style={{fontSize:12,color:"#64748b"}}>{w.days} días · {fmt(w.dailyRate)}/día</div></div><div style={{textAlign:"right"}}><div style={{fontWeight:800,color:"#60a5fa",fontSize:15}}>{fmt(w.total)}</div><div style={{fontSize:11,color:"#64748b"}}>total período</div></div></div>))}
          <button style={S.btn("#16a34a")} onClick={()=>exportExcel(workers,projects,logs)}>⬇ Exportar Excel de Nómina</button>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav style={S.nav}>
        {auth==="admin"&&[["admin","⚙️","Admin"],["ubicaciones","📍","Ubicaciones"],["dashboard","📊","Dashboard"]].map(([v,icon,label])=>(<button key={v} style={S.navBtn(view===v)} onClick={()=>setView(v)}><span style={S.navIcon}>{icon}</span>{label}</button>))}
        {auth==="checkin"&&checkinDone&&(<button style={S.navBtn(true)}><span style={S.navIcon}>✅</span>Registrado</button>)}
      </nav>
    </div>
  );
}