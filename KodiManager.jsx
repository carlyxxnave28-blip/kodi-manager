import { useState, useEffect } from "react";

// ─── UTILITIES ───────────────────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const addMonths = (dateStr, n) => { const d = new Date(dateStr); d.setMonth(d.getMonth() + parseInt(n)); return d; };
const daysFrom = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const t = new Date(dateStr); t.setHours(0,0,0,0);
  return Math.floor((t - today) / 86400000);
};
const fileToB64 = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
});
const getTenantStatus = (t) => {
  if (!t.payments?.length) return { label: "Hajalipa", color: "gray", days: null, expiry: null };
  const last = t.payments[t.payments.length - 1];
  const expiry = addMonths(last.date, t.rentDuration || 1);
  const days = daysFrom(expiry);
  if (t.isLocked) return { label: "Imefungwa", color: "red", days, expiry };
  if (days < 0) return { label: "Imedaiwa", color: "red", days, expiry };
  if (days <= 7) return { label: "Karibu Kwisha", color: "amber", days, expiry };
  return { label: "Imelipiwa", color: "green", days, expiry };
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tenants, setTenants] = useState([]);
  const [view, setView] = useState("home");
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null); // "addTenant"|"addPayment"|"addDoc"
  const [modalCtx, setModalCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifPerm, setNotifPerm] = useState("default");
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get("kodi_v2"); if (r) setTenants(JSON.parse(r.value)); } catch {}
      setLoading(false);
    })();
    if ("Notification" in window) setNotifPerm(Notification.permission);
  }, []);

  const save = async (arr) => { setTenants(arr); try { await window.storage.set("kodi_v2", JSON.stringify(arr)); } catch {} };
  const toast$ = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  // Auto-lock overdue > 7 days
  useEffect(() => {
    if (!tenants.length) return;
    let changed = false;
    const upd = tenants.map(t => {
      const s = getTenantStatus(t);
      if (s.days !== null && s.days < -7 && !t.isLocked) { changed = true; return { ...t, isLocked: true }; }
      return t;
    });
    if (changed) save(upd);
  });

  // Browser notifications
  useEffect(() => {
    if (notifPerm !== "granted" || !tenants.length) return;
    const seen = JSON.parse(localStorage.getItem("kodi_notif") || "{}");
    const today = new Date().toDateString();
    tenants.forEach(t => {
      const s = getTenantStatus(t);
      if (s.days !== null && s.days <= 7 && s.days >= 0 && seen[t.id] !== today) {
        new Notification(`🏠 KodiManager: ${t.name}`, { body: `Kodi inaisha ${s.days === 0 ? "leo" : `baada ya siku ${s.days}`} — ${fmt(s.expiry)}` });
        seen[t.id] = today;
      }
    });
    localStorage.setItem("kodi_notif", JSON.stringify(seen));
  }, [tenants, notifPerm]);

  const addTenant = (data) => {
    const t = { id: Date.now().toString(), ...data, payments: [], documents: [], isLocked: false, createdAt: new Date().toISOString() };
    save([...tenants, t]); setModal(null); toast$(`${data.name} amesajiliwa! ✅`);
  };
  const addPayment = (tId, data) => {
    const upd = tenants.map(t => t.id === tId ? { ...t, payments: [...t.payments, { id: Date.now().toString(), ...data }] } : t);
    save(upd); setModal(null); toast$("Malipo yamehifadhiwa! 💳");
  };
  const addDoc = (tId, data) => {
    const upd = tenants.map(t => t.id === tId ? { ...t, documents: [...(t.documents || []), { id: Date.now().toString(), ...data }] } : t);
    save(upd); setModal(null); toast$("Hati imehifadhiwa! 📄");
  };
  const toggleLock = (tId) => { save(tenants.map(t => t.id === tId ? { ...t, isLocked: !t.isLocked } : t)); };
  const deleteTenant = (tId) => {
    if (!confirm("Una uhakika? Mpangaji atafutwa kabisa.")) return;
    save(tenants.filter(t => t.id !== tId)); setSelectedId(null); toast$("Mpangaji amefutwa", "err");
  };

  const selected = tenants.find(t => t.id === selectedId);
  const defaulters = tenants.filter(t => { const s = getTenantStatus(t); return s.days !== null && s.days < 0; });
  const filtered = tenants.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.room.toLowerCase().includes(search.toLowerCase()));

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#060c18",flexDirection:"column",gap:12,fontFamily:"'Outfit',sans-serif"}}>
      <div style={{fontSize:"2.5rem"}}>🏠</div>
      <div style={{color:"#10b981",fontSize:"1rem",fontWeight:600}}>Inapakia KodiManager...</div>
    </div>
  );

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <style>{CSS}</style>

      {toast && <div className={`toast ${toast.type === "err" ? "toast-err" : "toast-ok"}`}>{toast.msg}</div>}

      <div className="app">
        {/* ── HEADER ── */}
        <header className="header">
          <div className="header-inner">
            <div className="brand">
              <div className="brand-icon">🏠</div>
              <div>
                <div className="brand-name">KodiManager</div>
                <div className="brand-sub">{tenants.length} wapangaji • {defaulters.length} wadaiwa</div>
              </div>
            </div>
            {notifPerm !== "granted" && (
              <button className="notif-btn" onClick={async () => {
                if ("Notification" in window) setNotifPerm(await Notification.requestPermission());
              }}>🔔 Wezesha Arifa</button>
            )}
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main className="main">
          {selected ? (
            <TenantDetail tenant={selected} onBack={() => setSelectedId(null)}
              onAddPayment={() => { setModalCtx(selected.id); setModal("addPayment"); }}
              onAddDoc={() => { setModalCtx(selected.id); setModal("addDoc"); }}
              onToggleLock={() => toggleLock(selected.id)}
              onDelete={() => deleteTenant(selected.id)}
            />
          ) : view === "home" ? (
            <HomeView tenants={filtered} search={search} setSearch={setSearch} onSelect={setSelectedId} />
          ) : view === "overview" ? (
            <OverviewView tenants={filtered} search={search} setSearch={setSearch} onSelect={id => setSelectedId(id)} />
          ) : (
            <DefaultersView tenants={defaulters} onSelect={id => setSelectedId(id)} onToggleLock={toggleLock} />
          )}
        </main>

        {/* ── FAB ── */}
        {!selected && (
          <button className="fab" onClick={() => setModal("addTenant")} title="Ongeza mpangaji">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        )}

        {/* ── BOTTOM NAV ── */}
        {!selected && (
          <nav className="bottom-nav">
            <NavBtn active={view==="home"} onClick={() => setView("home")} label="Nyumbani"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill={view==="home"?"#10b981":"none"} stroke={view==="home"?"#10b981":"#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
            />
            <NavBtn active={view==="overview"} onClick={() => setView("overview")} label="Maelezo"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={view==="overview"?"#10b981":"#6b7280"} strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="4" height="15"/><rect x="10" y="3" width="4" height="19"/><rect x="18" y="11" width="4" height="11"/></svg>}
            />
            <NavBtn active={view==="defaulters"} onClick={() => setView("defaulters")} label="Wadaiwa" badge={defaulters.length}
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={view==="defaulters"?"#ef4444":"#6b7280"} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
            />
          </nav>
        )}
      </div>

      {/* ── MODALS ── */}
      {modal === "addTenant" && <AddTenantModal onAdd={addTenant} onClose={() => setModal(null)} />}
      {modal === "addPayment" && <AddPaymentModal tenantId={modalCtx} onAdd={addPayment} onClose={() => setModal(null)} />}
      {modal === "addDoc" && <AddDocModal tenantId={modalCtx} onAdd={addDoc} onClose={() => setModal(null)} />}
    </>
  );
}

// ─── NAV BUTTON ──────────────────────────────────────────────────────────────
function NavBtn({ active, onClick, label, icon, badge }) {
  return (
    <button className={`nav-btn ${active ? "nav-btn--active" : ""}`} onClick={onClick}>
      <div style={{position:"relative",display:"inline-block"}}>
        {icon}
        {badge > 0 && <span className="nav-badge">{badge}</span>}
      </div>
      <span>{label}</span>
    </button>
  );
}

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
function HomeView({ tenants, search, setSearch, onSelect }) {
  const stats = [
    { label: "Wanaolipa", value: tenants.filter(t => getTenantStatus(t).color === "green").length, color: "#10b981", icon: "✅" },
    { label: "Karibu Kwisha", value: tenants.filter(t => getTenantStatus(t).color === "amber").length, color: "#f59e0b", icon: "⚠️" },
    { label: "Wadaiwa", value: tenants.filter(t => getTenantStatus(t).color === "red").length, color: "#ef4444", icon: "🔴" },
    { label: "Wote", value: tenants.length, color: "#818cf8", icon: "👥" },
  ];
  return (
    <div className="view slide-up">
      <div className="stats-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card" style={{"--accent": s.color}}>
            <span className="stat-icon">{s.icon}</span>
            <span className="stat-val">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Tafuta jina au chumba..." />
      <div className="section-head"><span className="section-title">Wapangaji Wote</span><span className="section-sub">Gusa kadi kuona zaidi</span></div>
      {tenants.length === 0
        ? <Empty icon="🏘️" title="Hakuna wapangaji" sub='Gusa "+" hapa chini kuongeza mpangaji' />
        : <div className="card-list">{tenants.map(t => <TenantCard key={t.id} tenant={t} onClick={() => onSelect(t.id)} />)}</div>
      }
    </div>
  );
}

// ─── OVERVIEW VIEW ───────────────────────────────────────────────────────────
function OverviewView({ tenants, search, setSearch, onSelect }) {
  return (
    <div className="view slide-up">
      <div className="section-head"><span className="section-title">Maelezo ya Wote</span><span className="section-sub">Rekodi kamili ya kila mpangaji</span></div>
      <SearchBar value={search} onChange={setSearch} placeholder="Tafuta mpangaji..." />
      {tenants.length === 0
        ? <Empty icon="📋" title="Hakuna wapangaji" sub="Anza kwa kuongeza wapangaji" />
        : <div className="card-list">{tenants.map(t => <OverviewCard key={t.id} tenant={t} onClick={() => onSelect(t.id)} />)}</div>
      }
    </div>
  );
}

// ─── DEFAULTERS VIEW ─────────────────────────────────────────────────────────
function DefaultersView({ tenants, onSelect, onToggleLock }) {
  return (
    <div className="view slide-up">
      <div className="section-head">
        <span className="section-title" style={{color:"#ef4444"}}>⚠️ Wadaiwa</span>
        <span className="section-sub">Wapangaji ambao muda wao wa kodi umekwisha</span>
      </div>
      {tenants.length === 0
        ? <Empty icon="🎉" title="Hakuna wadaiwa!" sub="Wapangaji wote wanalipa kwa wakati — hongera!" />
        : <div className="card-list">{tenants.map(t => <DefaulterCard key={t.id} tenant={t} onSelect={() => onSelect(t.id)} onToggleLock={() => onToggleLock(t.id)} />)}</div>
      }
    </div>
  );
}

// ─── TENANT DETAIL ───────────────────────────────────────────────────────────
function TenantDetail({ tenant, onBack, onAddPayment, onAddDoc, onToggleLock, onDelete }) {
  const [tab, setTab] = useState("payments");
  const status = getTenantStatus(tenant);
  const totalPaid = tenant.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const isOverdue = status.days !== null && status.days < 0;

  return (
    <div className="view slide-up">
      <button className="back-btn" onClick={onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        Rudi
      </button>

      {/* Profile card */}
      <div className="detail-header">
        <div className="detail-avatar">{tenant.name[0].toUpperCase()}</div>
        <div className="detail-info">
          <div className="detail-name">{tenant.name} {tenant.isLocked ? "🔒" : ""}</div>
          <div className="detail-room">Chumba {tenant.room}</div>
          <span className={`tag tag-${status.color}`}>{status.label}</span>
        </div>
      </div>

      <div className="info-grid">
        <Chip label="📞 Simu" value={tenant.phone} />
        <Chip label="💰 Kodi/Mwezi" value={`KES ${Number(tenant.rentAmount).toLocaleString()}`} color="#10b981" />
        <Chip label="📅 Muda" value={`Miezi ${tenant.rentDuration}`} />
        <Chip label="✅ Imelipiwa" value={`KES ${totalPaid.toLocaleString()}`} color="#10b981" />
      </div>

      {status.expiry && (
        <div className={`expiry-bar ${isOverdue ? "expiry-bar--red" : status.days <= 7 ? "expiry-bar--amber" : "expiry-bar--green"}`}>
          <span>{isOverdue ? "⚠️ Kodi iliisha" : status.days === 0 ? "⏰ Inaisha leo" : `📅 Inaisha baada ya siku ${status.days}`}</span>
          <span className="expiry-date">{fmt(status.expiry)}</span>
        </div>
      )}
      {isOverdue && (
        <div className="debt-bar">
          <span>📛 Imechelewa kwa siku {Math.abs(status.days)}</span>
          {tenant.isLocked && <span className="locked-badge">🔒 Imefungwa</span>}
        </div>
      )}

      <div className="action-row">
        <button className="btn-primary" onClick={onAddPayment}>+ Ongeza Malipo</button>
        <button className={`btn-lock ${tenant.isLocked ? "btn-lock--unlock" : "btn-lock--lock"}`} onClick={onToggleLock}>
          {tenant.isLocked ? "🔓 Fungua" : "🔒 Funga"}
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === "payments" ? "tab--active" : ""}`} onClick={() => setTab("payments")}>
          💳 Malipo ({tenant.payments.length})
        </button>
        <button className={`tab ${tab === "docs" ? "tab--active" : ""}`} onClick={() => setTab("docs")}>
          📄 Hati ({(tenant.documents || []).length})
        </button>
      </div>

      {tab === "payments" ? (
        tenant.payments.length === 0
          ? <Empty icon="💳" title="Hakuna malipo" sub="Gusa 'Ongeza Malipo' kurekodi" />
          : <div className="card-list">
              {[...tenant.payments].reverse().map((p, i) => (
                <div key={p.id} className="payment-card">
                  <div className="payment-top">
                    <div>
                      <div className="payment-amount">KES {Number(p.amount).toLocaleString()}</div>
                      <div className="payment-date">{fmt(p.date)}</div>
                      {p.notes && <div className="payment-note">{p.notes}</div>}
                    </div>
                    <div className="payment-right">
                      {p.receiptNo && <div className="receipt-no">#{p.receiptNo}</div>}
                      <div className="receipt-num">Risiti {tenant.payments.length - i}</div>
                    </div>
                  </div>
                  {p.receiptImage && (
                    <img src={p.receiptImage} className="receipt-img" alt="risiti" onClick={() => window.open(p.receiptImage)} />
                  )}
                </div>
              ))}
            </div>
      ) : (
        <div>
          <button className="btn-ghost" style={{width:"100%",marginBottom:10}} onClick={onAddDoc}>+ Ongeza Hati / Kitambulisho</button>
          {(tenant.documents || []).length === 0
            ? <Empty icon="📄" title="Hakuna hati" sub="Ongeza nakala za vitambulisho vya mpangaji" />
            : <div className="card-list">
                {tenant.documents.map(d => (
                  <div key={d.id} className="doc-card">
                    <div className="doc-name">{d.name || "Hati"}</div>
                    {d.type && <div className="doc-type">{d.type}</div>}
                    {d.image && <img src={d.image} className="doc-img" alt={d.name} onClick={() => window.open(d.image)} />}
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      <div className="divider" />
      <button className="btn-delete" onClick={onDelete}>🗑️ Futa Mpangaji Huyu</button>
    </div>
  );
}

// ─── TENANT CARD (Home) ───────────────────────────────────────────────────────
function TenantCard({ tenant, onClick }) {
  const s = getTenantStatus(tenant);
  const last = tenant.payments.at(-1);
  const colors = { green: "#10b981", amber: "#f59e0b", red: "#ef4444", gray: "#6b7280" };
  const c = colors[s.color];
  return (
    <div className="card" style={{"--left": c, cursor:"pointer"}} onClick={onClick}>
      <div className="card-row">
        <div className="avatar" style={{"--c": c}}>{tenant.name[0].toUpperCase()}</div>
        <div className="card-info">
          <div className="card-name">{tenant.name} {tenant.isLocked ? "🔒" : ""}</div>
          <div className="card-sub">Chumba {tenant.room} · {tenant.phone}</div>
        </div>
        <span className={`tag tag-${s.color}`}>{s.label}</span>
      </div>
      <div className="card-dates">
        <div className="date-box">
          <div className="date-label">Alilipa</div>
          <div className="date-val">{last ? fmt(last.date) : "Bado"}</div>
        </div>
        <div className="date-box">
          <div className="date-label">Inaisha</div>
          <div className="date-val" style={{color: c}}>{s.expiry ? fmt(s.expiry) : "—"}</div>
        </div>
      </div>
    </div>
  );
}

// ─── OVERVIEW CARD ───────────────────────────────────────────────────────────
function OverviewCard({ tenant, onClick }) {
  const s = getTenantStatus(tenant);
  const totalPaid = tenant.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  return (
    <div className="card" onClick={onClick} style={{cursor:"pointer"}}>
      <div className="card-row" style={{marginBottom:10}}>
        <div className="avatar" style={{"--c":"#818cf8"}}>{tenant.name[0].toUpperCase()}</div>
        <div className="card-info">
          <div className="card-name">{tenant.name} {tenant.isLocked ? "🔒" : ""}</div>
          <div className="card-sub">Chumba {tenant.room} · {tenant.phone}</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div className="info-grid" style={{gap:6}}>
        <Chip label="Kodi" value={`KES ${Number(tenant.rentAmount).toLocaleString()}`} color="#10b981" small />
        <Chip label="Malipo" value={`${tenant.payments.length} risiti`} color="#818cf8" small />
        <Chip label="Jumla Lilipiwa" value={`KES ${totalPaid.toLocaleString()}`} color="#10b981" small />
        <Chip label="Hali" value={s.label} color={s.color==="green"?"#10b981":s.color==="amber"?"#f59e0b":"#ef4444"} small />
      </div>
    </div>
  );
}

// ─── DEFAULTER CARD ──────────────────────────────────────────────────────────
function DefaulterCard({ tenant, onSelect, onToggleLock }) {
  const s = getTenantStatus(tenant);
  return (
    <div className="card" style={{"--left":"#ef4444"}}>
      <div className="card-row" style={{marginBottom:10}}>
        <div className="avatar" style={{"--c":"#ef4444"}}>{tenant.name[0].toUpperCase()}</div>
        <div className="card-info">
          <div className="card-name">{tenant.name}</div>
          <div className="card-sub">Chumba {tenant.room} · {tenant.phone}</div>
        </div>
        <span className="tag tag-red">{tenant.isLocked ? "🔒 Imefungwa" : `Siku ${Math.abs(s.days)}`}</span>
      </div>
      <div className="info-grid" style={{gap:6,marginBottom:10}}>
        <Chip label="Kodi Iliisha" value={fmt(s.expiry)} color="#ef4444" small />
        <Chip label="Imechelewa" value={`Siku ${Math.abs(s.days)}`} color="#ef4444" small />
      </div>
      <div className="action-row">
        <button className="btn-ghost" style={{flex:1}} onClick={onSelect}>Maelezo</button>
        <button className={`btn-lock ${tenant.isLocked ? "btn-lock--unlock" : "btn-lock--lock"}`} style={{flex:1}} onClick={onToggleLock}>
          {tenant.isLocked ? "🔓 Fungua" : "🔒 Funga"}
        </button>
      </div>
    </div>
  );
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
function Chip({ label, value, color, small }) {
  return (
    <div className={`chip ${small ? "chip--small" : ""}`}>
      <div className="chip-label">{label}</div>
      <div className="chip-val" style={{color: color || "#f1f5f9"}}>{value}</div>
    </div>
  );
}
function Empty({ icon, title, sub }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
    </div>
  );
}
function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="search-wrap">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" style={{flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input className="search-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function AddTenantModal({ onAdd, onClose }) {
  const [f, setF] = useState({ name:"", phone:"", room:"", rentAmount:"", rentDuration:"1", notes:"" });
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  const submit = () => { if (!f.name || !f.phone || !f.room || !f.rentAmount) return alert("Jaza sehemu zote zilizo na *"); onAdd(f); };
  return (
    <Modal title="➕ Sajili Mpangaji Mpya" onClose={onClose}>
      <Field label="Jina Kamili *"><input className="inp" placeholder="John Kamau" value={f.name} onChange={e=>s("name",e.target.value)} /></Field>
      <Field label="Nambari ya Simu *"><input className="inp" placeholder="0712 345 678" type="tel" value={f.phone} onChange={e=>s("phone",e.target.value)} /></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Chumba / Nambari *"><input className="inp" placeholder="A1" value={f.room} onChange={e=>s("room",e.target.value)} /></Field>
        <Field label="Kodi/Mwezi (KES) *"><input className="inp" placeholder="8000" type="number" value={f.rentAmount} onChange={e=>s("rentAmount",e.target.value)} /></Field>
      </div>
      <Field label="Muda wa Kodi">
        <select className="inp" value={f.rentDuration} onChange={e=>s("rentDuration",e.target.value)}>
          {[1,2,3,6,12].map(m => <option key={m} value={m}>{m} {m===1?"Mwezi":"Miezi"}</option>)}
        </select>
      </Field>
      <Field label="Maelezo (hiari)"><textarea className="inp" rows={2} style={{resize:"none"}} placeholder="Maelezo mengine..." value={f.notes} onChange={e=>s("notes",e.target.value)} /></Field>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Ghairi</button>
        <button className="btn-primary" onClick={submit}>Sajili</button>
      </div>
    </Modal>
  );
}

function AddPaymentModal({ tenantId, onAdd, onClose }) {
  const [f, setF] = useState({ date: new Date().toISOString().split("T")[0], amount:"", receiptNo:"", notes:"", receiptImage:null });
  const [uploading, setUploading] = useState(false);
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  const handleImg = async (e) => { const file = e.target.files[0]; if (!file) return; setUploading(true); try { s("receiptImage", await fileToB64(file)); } catch {} setUploading(false); };
  const submit = () => { if (!f.amount || !f.date) return alert("Jaza kiasi na tarehe"); onAdd(tenantId, f); };
  return (
    <Modal title="💳 Rekodi Malipo" onClose={onClose}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Kiasi (KES) *"><input className="inp" placeholder="8000" type="number" value={f.amount} onChange={e=>s("amount",e.target.value)} /></Field>
        <Field label="Tarehe ya Malipo *"><input className="inp" type="date" value={f.date} onChange={e=>s("date",e.target.value)} /></Field>
      </div>
      <Field label="Nambari ya Risiti"><input className="inp" placeholder="RCP-001" value={f.receiptNo} onChange={e=>s("receiptNo",e.target.value)} /></Field>
      <Field label="Picha ya Risiti">
        <label className="upload-zone">
          {uploading ? "⏳ Inapakia..." : f.receiptImage ? "✅ Picha imepakiwa — gusa kubadilisha" : "📎 Gusa kupakia picha ya risiti"}
          <input type="file" accept="image/*" onChange={handleImg} style={{display:"none"}} />
        </label>
        {f.receiptImage && <img src={f.receiptImage} className="preview-img" alt="risiti" />}
      </Field>
      <Field label="Maelezo (hiari)"><input className="inp" placeholder="Kodi ya Januari 2025..." value={f.notes} onChange={e=>s("notes",e.target.value)} /></Field>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Ghairi</button>
        <button className="btn-primary" onClick={submit}>Hifadhi</button>
      </div>
    </Modal>
  );
}

function AddDocModal({ tenantId, onAdd, onClose }) {
  const [f, setF] = useState({ name:"", type:"Kitambulisho cha Taifa", image:null });
  const [uploading, setUploading] = useState(false);
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  const handleImg = async (e) => { const file = e.target.files[0]; if (!file) return; setUploading(true); try { s("image", await fileToB64(file)); } catch {} setUploading(false); };
  const submit = () => { if (!f.image) return alert("Pakia picha ya hati kwanza"); onAdd(tenantId, { ...f, uploadedAt: new Date().toISOString() }); };
  return (
    <Modal title="📄 Ongeza Hati" onClose={onClose}>
      <Field label="Aina ya Hati">
        <select className="inp" value={f.type} onChange={e=>s("type",e.target.value)}>
          {["Kitambulisho cha Taifa","Cheki ya Benki","Risiti ya Malipo","Mkataba wa Kukodisha","Nyaraka Nyingine"].map(o => <option key={o}>{o}</option>)}
        </select>
      </Field>
      <Field label="Jina la Hati"><input className="inp" placeholder="Mfano: ID ya John" value={f.name} onChange={e=>s("name",e.target.value)} /></Field>
      <Field label="Picha ya Hati *">
        <label className="upload-zone">
          {uploading ? "⏳ Inapakia..." : f.image ? "✅ Picha imepakiwa — gusa kubadilisha" : "📎 Gusa kupakia picha ya hati"}
          <input type="file" accept="image/*" onChange={handleImg} style={{display:"none"}} />
        </label>
        {f.image && <img src={f.image} className="preview-img" alt="hati" />}
      </Field>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Ghairi</button>
        <button className="btn-primary" onClick={submit}>Hifadhi</button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return <div className="field"><label className="field-label">{label}</label>{children}</div>;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #060c18; color: #f1f5f9; font-family: 'Outfit', sans-serif; -webkit-tap-highlight-color: transparent; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111827; } ::-webkit-scrollbar-thumb { background: #10b981; border-radius: 4px; }
  input, select, textarea, button { font-family: inherit; }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* HEADER */
  .header { position: sticky; top: 0; z-index: 40; background: rgba(6,12,24,0.9); backdrop-filter: blur(16px); border-bottom: 1px solid #111827; }
  .header-inner { max-width: 640px; margin: 0 auto; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-icon { width: 38px; height: 38px; background: linear-gradient(135deg,#10b981,#059669); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0; }
  .brand-name { font-size: 1.05rem; font-weight: 800; color: #f1f5f9; letter-spacing: -0.3px; }
  .brand-sub { font-size: 0.7rem; color: #6b7280; }
  .notif-btn { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #10b981; border-radius: 8px; padding: 6px 12px; font-size: 0.75rem; cursor: pointer; font-weight: 600; white-space: nowrap; }

  /* MAIN */
  .main { flex: 1; max-width: 640px; width: 100%; margin: 0 auto; padding: 12px 14px 100px; }
  .view { display: flex; flex-direction: column; gap: 12px; }

  /* STATS */
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat-card { background: #111827; border: 1px solid #1f2937; border-top: 2px solid var(--accent); border-radius: 14px; padding: 14px 12px; display: flex; flex-direction: column; gap: 2px; }
  .stat-icon { font-size: 1.3rem; }
  .stat-val { font-size: 1.8rem; font-weight: 900; color: var(--accent); line-height: 1; }
  .stat-label { font-size: 0.75rem; color: #6b7280; font-weight: 500; }

  /* SECTION HEAD */
  .section-head { display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }
  .section-title { font-size: 1.15rem; font-weight: 700; color: #f1f5f9; }
  .section-sub { font-size: 0.78rem; color: #6b7280; }

  /* SEARCH */
  .search-wrap { display: flex; align-items: center; gap: 10px; background: #111827; border: 1.5px solid #1f2937; border-radius: 12px; padding: 10px 14px; }
  .search-input { flex: 1; background: transparent; border: none; outline: none; color: #f1f5f9; font-size: 0.9rem; }
  .search-input::placeholder { color: #4b5563; }

  /* CARD LIST */
  .card-list { display: flex; flex-direction: column; gap: 9px; }

  /* CARD */
  .card { background: #111827; border: 1px solid #1f2937; border-left: 3px solid var(--left, #1f2937); border-radius: 14px; padding: 14px; transition: border-color 0.2s; }
  .card:active { opacity: 0.85; }
  .card-row { display: flex; align-items: center; gap: 11px; }
  .card-info { flex: 1; min-width: 0; }
  .card-name { font-weight: 600; font-size: 0.98rem; color: #f1f5f9; }
  .card-sub { font-size: 0.76rem; color: #6b7280; margin-top: 1px; }
  .card-dates { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 10px; }
  .date-box { background: #1a2234; border-radius: 9px; padding: 7px 10px; }
  .date-label { font-size: 0.63rem; color: #6b7280; margin-bottom: 2px; }
  .date-val { font-size: 0.82rem; font-weight: 600; color: #f1f5f9; }

  /* AVATAR */
  .avatar { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.05rem; font-weight: 800; flex-shrink: 0; background: rgba(from var(--c) r g b / 0.15); color: var(--c, #9ca3af); border: 1px solid rgba(from var(--c) r g b / 0.2); }

  /* TAGS */
  .tag { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; flex-shrink: 0; }
  .tag-green { background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.25); }
  .tag-amber { background: rgba(245,158,11,0.12); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); }
  .tag-red   { background: rgba(239,68,68,0.12);  color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }
  .tag-gray  { background: rgba(156,163,175,0.1); color: #9ca3af; border: 1px solid rgba(156,163,175,0.2); }

  /* CHIP */
  .chip { background: #1a2234; border-radius: 9px; padding: 8px 10px; }
  .chip--small { padding: 5px 8px; }
  .chip-label { font-size: 0.65rem; color: #6b7280; margin-bottom: 2px; }
  .chip-val { font-size: 0.85rem; font-weight: 600; }
  .chip--small .chip-val { font-size: 0.78rem; }

  /* INFO GRID */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  /* DETAIL */
  .detail-header { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 18px; display: flex; align-items: center; gap: 14px; }
  .detail-avatar { width: 58px; height: 58px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 900; background: linear-gradient(135deg,rgba(16,185,129,0.2),rgba(5,150,105,0.1)); color: #10b981; border: 1px solid rgba(16,185,129,0.3); flex-shrink: 0; }
  .detail-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .detail-name { font-size: 1.2rem; font-weight: 700; color: #f1f5f9; }
  .detail-room { font-size: 0.8rem; color: #6b7280; }

  /* EXPIRY BARS */
  .expiry-bar { border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight: 600; }
  .expiry-bar--green { background: rgba(16,185,129,0.08); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
  .expiry-bar--amber { background: rgba(245,158,11,0.08); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
  .expiry-bar--red   { background: rgba(239,68,68,0.08);  color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
  .expiry-date { font-size: 0.88rem; opacity: 0.9; }
  .debt-bar { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #ef4444; font-weight: 600; }
  .locked-badge { background: rgba(239,68,68,0.15); padding: 2px 8px; border-radius: 8px; font-size: 0.78rem; }

  /* TABS */
  .tabs { display: flex; background: #111827; border-radius: 12px; padding: 4px; gap: 4px; }
  .tab { flex: 1; padding: 10px; border-radius: 9px; border: none; background: transparent; color: #6b7280; font-weight: 600; cursor: pointer; font-size: 0.85rem; transition: all 0.2s; }
  .tab--active { background: #1f2937; color: #10b981; }

  /* PAYMENTS */
  .payment-card { background: #111827; border: 1px solid #1f2937; border-left: 3px solid #10b981; border-radius: 13px; padding: 13px; }
  .payment-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
  .payment-amount { font-size: 1.05rem; font-weight: 700; color: #10b981; }
  .payment-date { font-size: 0.78rem; color: #6b7280; margin-top: 2px; }
  .payment-note { font-size: 0.78rem; color: #9ca3af; margin-top: 4px; font-style: italic; }
  .payment-right { text-align: right; }
  .receipt-no { font-family: 'DM Mono', monospace; font-size: 0.75rem; background: rgba(16,185,129,0.1); color: #10b981; padding: 2px 8px; border-radius: 6px; }
  .receipt-num { font-size: 0.7rem; color: #6b7280; margin-top: 4px; }
  .receipt-img { width: 100%; border-radius: 8px; margin-top: 10px; max-height: 200px; object-fit: cover; cursor: pointer; }

  /* DOCS */
  .doc-card { background: #111827; border: 1px solid #1f2937; border-radius: 13px; padding: 13px; }
  .doc-name { font-weight: 600; font-size: 0.95rem; margin-bottom: 4px; }
  .doc-type { font-size: 0.78rem; color: #6b7280; margin-bottom: 8px; }
  .doc-img { width: 100%; border-radius: 8px; max-height: 220px; object-fit: cover; cursor: pointer; }

  /* BUTTONS */
  .btn-primary { background: linear-gradient(135deg,#10b981,#059669); color: white; border: none; border-radius: 11px; padding: 13px 18px; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s, transform 0.1s; }
  .btn-primary:active { opacity: 0.85; transform: scale(0.97); }
  .btn-ghost { background: transparent; border: 1.5px solid #374151; color: #9ca3af; border-radius: 11px; padding: 12px 18px; font-size: 0.9rem; cursor: pointer; font-weight: 600; transition: all 0.2s; }
  .btn-ghost:hover { border-color: #10b981; color: #10b981; }
  .btn-lock { border: none; border-radius: 11px; padding: 13px 18px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s; }
  .btn-lock--lock { background: rgba(239,68,68,0.1); color: #ef4444; }
  .btn-lock--unlock { background: rgba(16,185,129,0.1); color: #10b981; }
  .btn-delete { width: 100%; padding: 13px; border-radius: 11px; border: 1px solid rgba(239,68,68,0.25); background: rgba(239,68,68,0.06); color: #ef4444; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
  .action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }

  /* BACK */
  .back-btn { display: flex; align-items: center; gap: 6px; background: transparent; border: none; color: #10b981; cursor: pointer; font-weight: 700; font-size: 0.92rem; padding: 0; margin-bottom: 4px; }

  /* DIVIDER */
  .divider { height: 1px; background: #1f2937; margin: 4px 0; }

  /* EMPTY */
  .empty { text-align: center; padding: 48px 20px; color: #6b7280; }
  .empty-icon { font-size: 3rem; margin-bottom: 12px; }
  .empty-title { font-weight: 700; font-size: 1.05rem; color: #9ca3af; margin-bottom: 6px; }
  .empty-sub { font-size: 0.85rem; }

  /* FAB */
  .fab { position: fixed; bottom: 82px; right: 18px; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg,#10b981,#059669); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 24px rgba(16,185,129,0.45); z-index: 50; transition: transform 0.2s, box-shadow 0.2s; }
  .fab:active { transform: scale(0.92); box-shadow: 0 2px 14px rgba(16,185,129,0.35); }

  /* BOTTOM NAV */
  .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(10,16,30,0.97); border-top: 1px solid #111827; display: flex; padding: 8px 0 max(12px, env(safe-area-inset-bottom)); z-index: 50; backdrop-filter: blur(20px); }
  .nav-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; flex: 1; background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 0.68rem; font-weight: 700; padding: 4px; position: relative; }
  .nav-btn--active { color: #10b981; }
  .nav-badge { position: absolute; top: -2px; right: 16px; background: #ef4444; color: white; border-radius: 10px; padding: 1px 5px; font-size: 0.6rem; font-weight: 800; line-height: 1.3; }

  /* MODAL */
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); z-index: 100; display: flex; align-items: flex-end; justify-content: center; }
  @media(min-width:600px) { .overlay { align-items: center; } }
  .modal { background: #0f1924; border: 1px solid #1f2937; border-radius: 22px 22px 0 0; width: 100%; max-width: 520px; padding: 20px; max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
  @media(min-width:600px) { .modal { border-radius: 22px; } }
  .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .modal-title { font-size: 1.1rem; font-weight: 800; color: #f1f5f9; }
  .close-btn { background: #1f2937; border: none; color: #9ca3af; border-radius: 8px; width: 32px; height: 32px; cursor: pointer; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; }
  .modal-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }

  /* FORM */
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 0.78rem; color: #9ca3af; font-weight: 600; }
  .inp { background: #1a2234; border: 1.5px solid #1f2937; border-radius: 11px; padding: 12px 13px; color: #f1f5f9; font-size: 0.92rem; outline: none; transition: border-color 0.2s; width: 100%; }
  .inp:focus { border-color: #10b981; }
  .upload-zone { display: block; background: #1a2234; border: 1.5px dashed #374151; border-radius: 11px; padding: 18px; text-align: center; cursor: pointer; color: #6b7280; font-size: 0.875rem; transition: border-color 0.2s; }
  .upload-zone:hover { border-color: #10b981; }
  .preview-img { width: 100%; border-radius: 9px; margin-top: 8px; max-height: 160px; object-fit: cover; }

  /* TOAST */
  .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); padding: 10px 20px; border-radius: 12px; z-index: 200; font-weight: 700; font-size: 0.88rem; box-shadow: 0 4px 20px rgba(0,0,0,0.4); white-space: nowrap; animation: slideDown 0.3s ease; }
  .toast-ok  { background: #064e3b; color: #6ee7b7; border: 1px solid rgba(16,185,129,0.3); }
  .toast-err { background: #7f1d1d; color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); }
  @keyframes slideDown { from { transform: translateX(-50%) translateY(-12px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }
  .slide-up { animation: slideUp 0.28s ease; }
  @keyframes slideUp { from { transform: translateY(16px); opacity:0; } to { transform: translateY(0); opacity:1; } }
`;
