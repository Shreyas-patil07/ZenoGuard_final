import React, { useEffect, useMemo, useRef, useState } from 'react';
import logoNoBg from './assets/logo_no_bg.png';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  FileWarning,
  IndianRupee,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: API_URL, timeout: 15000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// Auto-logout on 401 — stale/invalid token
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  signup: (name, email, password) => api.post('/auth/signup', { name, email, password }),
};

function saveSession(data) {
  if (data?.access_token) localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('user', JSON.stringify(data || {}));
}

function userFromStorage() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

function Protected({ children }) {
  return localStorage.getItem('access_token') ? children : <Navigate to="/login" replace />;
}

function Brand() {
  return <Link className="brand" to="/"><img src={logoNoBg} alt="ZenoGuard" className="brand-logo" /></Link>;
}

function Topbar() {
  const navigate = useNavigate();
  const loggedIn = !!localStorage.getItem('access_token');
  const logout = () => { localStorage.clear(); navigate('/login'); };
  return <header className="topbar">
    <Brand />
    <nav className="topnav">
      {loggedIn ? <><Link to="/dashboard">Dashboard</Link><Link to="/claims">Claims</Link><Link to="/wallet">Wallet</Link></> : <><a href="#how-it-works">How it works</a><a href="#security">Security</a><a href="#coverage">Coverage</a></>}
    </nav>
    {loggedIn ? <button className="ghost-btn" onClick={logout}><LogOut size={16}/> Logout</button> : <Link className="primary-btn" to="/login">Login <ArrowRight size={16}/></Link>}
  </header>;
}

function Home() {
  return <div className="home-page"><Topbar/>
    <section className="hero-section">
      <div className="hero-copy">
        <div className="eyebrow"><Zap size={14}/> AI-NEGOTIATED MICRO-INSURANCE</div>
        <h1>Protection that adapts to your <span>hustle.</span></h1>
        <p>ZenoGuard turns your gig-work activity into dynamic protection, verifies claims with ML, and routes approved payouts through smart contracts.</p>
        <div className="hero-actions"><Link className="primary-btn large" to="/signup">Create account <ArrowRight size={18}/></Link><a className="secondary-btn large" href="#how-it-works">See how it works</a></div>
        <div className="trust-row"><span><ShieldCheck size={16}/> AI risk scoring</span><span><LockKeyhole size={16}/> Auditable records</span><span><Activity size={16}/> Automated settlement</span></div>
      </div>
      <div className="hero-visual"><div className="hero-glow"/><div className="protection-card">
        <div className="card-icon"><ShieldCheck/></div><span>LIVE PROTECTION</span><strong>₹5,000</strong><small>Potential claim coverage</small>
        <div className="meter"><i/></div><div className="mini-grid"><div><b>₹13.52</b><span>Indicative premium</span></div><div><b>94%</b><span>AI confidence</span></div></div>
      </div></div>
    </section>
    <section id="how-it-works" className="section"><div className="section-title"><div className="eyebrow">HOW IT WORKS</div><h2>One protection loop, three simple steps.</h2></div><div className="feature-grid">
      <Feature n="01" icon={<Activity/>} title="Sync your work" text="Your earnings and work pattern become the inputs for a transparent risk profile."/>
      <Feature n="02" icon={<BrainCircuit/>} title="AI prices risk" text="Premium and claim models turn work signals and evidence into decisions."/>
      <Feature n="03" icon={<ShieldCheck/>} title="Settle on-chain" text="Verified claims move through the insurance contracts and payout pool."/>
    </div></section>
    <section id="security" className="dark-section"><div><div className="eyebrow">SECURITY</div><h2>AI finds the signal. Smart contracts enforce the settlement.</h2><p>Large evidence stays off-chain. Critical policy, claim and payout state is enforced by the blockchain layer.</p></div><div className="security-stack"><span>ML</span><b>→</b><span>Oracle</span><b>→</b><span>Claim Manager</span><b>→</b><span>Worker Wallet</span></div></section>
    <section id="coverage" className="section centered"><div className="eyebrow">READY WHEN YOU ARE</div><h2>Protect the income behind your hustle.</h2><Link className="primary-btn large" to="/signup">Get started <ArrowRight size={18}/></Link></section>
    <footer className="footer"><Brand/><span>© 2026 ZenoGuard</span></footer>
  </div>;
}

function Feature({ n, icon, title, text }) { return <article className="feature-card"><div className="feature-top"><span>{n}</span><div className="feature-icon">{icon}</div></div><h3>{title}</h3><p>{text}</p></article>; }

function AuthPage({ mode }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', password:'', confirm:'' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (isSignup && form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const { data } = isSignup ? await auth.signup(form.name, form.email, form.password) : await auth.login(form.email, form.password);
      saveSession(data); navigate(isSignup ? '/dashboard' : '/dashboard');
    } catch (err) { setError(err.response?.data?.detail || 'Request failed. Check the backend and your credentials.'); }
    finally { setBusy(false); }
  };
  return <div className="auth-page"><div className="ambient ambient-a"/><div className="ambient ambient-b"/><div className="auth-card"><Brand/><div className="auth-content"><div className="eyebrow">AI-NEGOTIATED MICRO-INSURANCE</div><h1>{isSignup ? 'Build your protection profile.' : 'Welcome back.'}</h1><p className="muted">{isSignup ? 'Start with your identity and gig-work profile.' : 'Sign in to manage your protection.'}</p>{error&&<div className="alert error">{error}</div>}
    <form className="form-stack" onSubmit={submit}>{isSignup&&<label>Full name<input required placeholder="Your name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>}<label>Email address<input required type="email" placeholder="you@example.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Password<input required type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>{isSignup&&<label>Confirm password<input required type="password" placeholder="Repeat password" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})}/></label>}<button className="primary-btn submit" disabled={busy}>{busy?'Please wait...':isSignup?'Create account':'Log in'}<ArrowRight size={17}/></button></form>
    <div className="auth-footer">{isSignup ? <>Already registered? <Link to="/login">Log in</Link></> : <>New to ZenoGuard? <Link to="/signup">Create an account</Link></>}</div></div></div><Link className="back-home" to="/">← Back to home</Link></div>;
}

function Shell({ title, children }) {
  const navigate = useNavigate(); const user = userFromStorage();
  const [open, setOpen] = useState(false);
  const logout = () => { localStorage.clear(); navigate('/login'); };
  return <div className="app-shell"><aside className={`sidebar ${open?'open':''}`}><div className="side-brand"><Brand/><button className="mobile-close" onClick={()=>setOpen(false)}><X/></button></div><div className="side-user"><div className="avatar">{(user?.name||'G').slice(0,1).toUpperCase()}</div><div><b>{user?.name||'Guardian'}</b><span>Gig worker</span></div></div><nav className="side-nav"><Link to="/dashboard">Overview</Link><Link to="/claims">Claims</Link><Link to="/wallet">Wallet</Link><Link to="/dashboard#profile">Protection</Link></nav><button className="side-logout" onClick={logout}><LogOut size={17}/> Logout</button></aside><main className="app-main"><header className="mobile-top"><button className="menu-btn" onClick={()=>setOpen(true)}><Menu/></button><Brand/><Bell size={19}/></header><div className="page-head"><div><div className="eyebrow">ZENOGUARD PROTECTION</div><h1>{title}</h1></div><div className="status-pill"><ShieldCheck size={16}/> Protection active</div></div>{children}</main></div>;
}

function Dashboard() {
  const user = userFromStorage();
  const [premium, setPremium] = useState(null);
  const [msg, setMsg]         = useState('');
  const [earn, setEarn]       = useState({ income:'', hours_worked:'' });
  const [busy, setBusy]       = useState(false);
  const [tier, setTier]       = useState('standard');
  const [duration, setDuration] = useState(30);
  const [activePolicy, setActivePolicyDash] = useState(null);

  const TIERS = [
    { key:'basic',    label:'Basic',    accident:'₹2,500', weather:'₹500' },
    { key:'standard', label:'Standard', accident:'₹5,000', weather:'₹1,000' },
    { key:'plus',     label:'Plus',     accident:'₹10,000',weather:'₹2,000' },
  ];

  const load = async () => {
    try {
      const [premRes, apRes] = await Promise.allSettled([
        api.get(`/premium/calculate?tier=${tier}&duration_days=${duration}`),
        api.get('/premium/active-policy'),
      ]);
      if (premRes.status === 'fulfilled') setPremium(premRes.value.data);
      if (apRes.status === 'fulfilled') {
        const ap = apRes.value.data;
        setActivePolicyDash(ap.has_active_policy ? ap.policy : null);
        if (ap.has_active_policy && ap.policy) {
          setTier(ap.policy.tier);
          setDuration(ap.policy.duration_days);
        }
      }
    } catch(e) {
      setMsg(e.response?.data?.detail || 'Could not load premium. Make sure the backend is running.');
    }
  };

  useEffect(() => { load(); }, [tier, duration]);

  const save = async e => {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      await api.post('/earnings/upload', { income:+earn.income, hours_worked:+earn.hours_worked });
      setMsg('Earnings saved.');
      setEarn({ income:'', hours_worked:'' });
      await load();
    } catch(e) {
      setMsg(e.response?.data?.detail || 'Could not save earnings.');
    } finally { setBusy(false); }
  };

  const selectedTier = TIERS.find(t => t.key === tier) || TIERS[1];

  const selectedTierInfo = TIERS.find(t => t.key === tier) || TIERS[1];

  return (
    <Shell title={`Welcome back, ${user?.name||'Guardian'}.`}>
      <div className="dashboard-grid">
        {/* Premium card */}
        <div className="metric-card featured">
          <div className="metric-label"><ShieldCheck size={17}/> ACTIVE PROTECTION</div>
          <strong>₹{Number(premium?.premium ?? 0).toFixed(2)}</strong>
          <span>/ day · {selectedTierInfo.label} plan · {duration} days</span>
          {premium?.total_premium && (
            <span style={{fontSize:12,color:'#94a3b8',marginTop:2}}>
              Total for {duration} days: ₹{premium.total_premium}
            </span>
          )}
          <div className="metric-bottom">
            <span>Risk score {premium?.risk_score ?? '—'}</span>
            <button onClick={load}><RefreshCw size={15}/></button>
          </div>
          <p style={{fontSize:10,color:'#475569',margin:'6px 0 0'}}>[Prototype Assumption] — not IRDAI-approved rates</p>
        </div>

        {/* Coverage card — locked if active policy exists */}
        <div className="metric-card">
          <div className="metric-label" style={{display:'flex',alignItems:'center',gap:6}}>
            <IndianRupee size={17}/> COVERAGE
            {activePolicy && <span style={{fontSize:10,background:'#dcfce7',color:'#16a34a',borderRadius:99,padding:'2px 8px',fontWeight:700}}>🔒 LOCKED</span>}
          </div>

          {activePolicy ? (
            /* Locked state */
            <>
              <h3 style={{margin:'6px 0 4px',color:'#15803d'}}>
                {activePolicy.tier_label} · {activePolicy.duration_days} days
              </h3>
              <p style={{margin:'2px 0',fontSize:13}}>
                Accident: ₹{activePolicy.coverage?.accident?.toLocaleString('en-IN')}
                &nbsp;|&nbsp; Weather: ₹{activePolicy.coverage?.weather?.toLocaleString('en-IN')}
              </p>
              <p style={{margin:'6px 0 0',fontSize:11,color:'#64748b'}}>
                {activePolicy.days_remaining} days remaining · expires {activePolicy.end_date ? new Date(activePolicy.end_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
              </p>
              <p style={{margin:'4px 0 0',fontSize:10,color:'#94a3b8'}}>
                Plan locked until expiry — go to Wallet to top up
              </p>
            </>
          ) : (
            /* Unlocked — show tier/duration selectors */
            <>
              <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
                {TIERS.map(t => (
                  <button key={t.key} onClick={()=>setTier(t.key)} style={{
                    padding:'4px 12px', borderRadius:99, fontSize:11, fontWeight:700,
                    cursor:'pointer', border:'1px solid',
                    background: tier===t.key ? '#0f172a' : '#f1f5f9',
                    color:      tier===t.key ? '#fff'    : '#64748b',
                    borderColor: tier===t.key ? '#0f172a' : '#e2e8f0',
                  }}>{t.label}</button>
                ))}
              </div>
              <h3 style={{margin:'4px 0 2px'}}>
                Accident: {selectedTierInfo.accident} &nbsp;|&nbsp; Weather: {selectedTierInfo.weather}
              </h3>
              <div style={{display:'flex',gap:6,marginTop:6}}>
                {[7,30,90].map(d => (
                  <button key={d} onClick={()=>setDuration(d)} style={{
                    padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600,
                    cursor:'pointer', border:'1px solid',
                    background: duration===d ? '#3b82f6' : '#f1f5f9',
                    color:      duration===d ? '#fff'    : '#64748b',
                    borderColor: duration===d ? '#3b82f6' : '#e2e8f0',
                  }}>{d} days</button>
                ))}
              </div>
              <span style={{fontSize:11,color:'#94a3b8',marginTop:6,display:'block'}}>
                {premium?.explanation || 'Select tier and duration — activate in Wallet'}
              </span>
            </>
          )}
        </div>

        {/* Verification card */}
        <div className="metric-card">
          <div className="metric-label"><BrainCircuit size={17}/> VERIFICATION</div>
          <h3>ML → Oracle → Claim Manager</h3>
          <span>Blockchain settlement ready for testnet integration.</span>
        </div>
      </div>

      <div className="split-grid">
        {/* Earnings */}
        <div className="panel">
          <div className="eyebrow">EARNINGS</div>
          <h2>Update today's work</h2>
          <p className="muted" style={{fontSize:12,marginBottom:8}}>
            Higher earnings = higher coverage premium (protects more income).
          </p>
          <form className="inline-form" onSubmit={save}>
            <input type="number" min="0" placeholder="Income ₹" required
              value={earn.income} onChange={e=>setEarn({...earn,income:e.target.value})}/>
            <input type="number" min="0" step="0.1" placeholder="Hours" required
              value={earn.hours_worked} onChange={e=>setEarn({...earn,hours_worked:e.target.value})}/>
            <button className="primary-btn" disabled={busy}>{busy?'Saving...':'Save'}</button>
          </form>
          {msg && <div className="notice">{msg}</div>}
        </div>

        {/* Claims CTA */}
        <div className="panel claim-cta">
          <div className="metric-label"><FileWarning size={17}/> CLAIMS</div>
          <h2>Something happened on the road?</h2>
          <p className="muted">Submit the event and let the ML verification layer determine the next state.</p>
          <Link className="primary-btn" to="/claims">Start a claim <ArrowUpRight size={17}/></Link>
        </div>
      </div>
    </Shell>
  );
}

// ── Evidence upload bar ───────────────────────────────────────────────────────
function EvidenceUploadBar({ onResult, onRemove }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState(null);   // object URL for images
  const [checking, setChecking] = useState(false);
  const [report, setReport]     = useState(null);   // quality report from backend
  const [checkErr, setCheckErr] = useState('');
  const inputRef = useRef(null);

  const QUALITY_COLOR = { good:'#16a34a', acceptable:'#d97706', poor:'#dc2626' };
  const QUALITY_LABEL = { good:'Good quality', acceptable:'Acceptable', poor:'Poor quality' };
  const QUALITY_BAR   = { good:100, acceptable:60, poor:25 };

  const accept = async (f) => {
    if (!f) return;
    const ok = ['image/jpeg','image/jpg','image/png','image/webp','application/pdf'];
    if (!ok.includes(f.type)) { alert('Please upload a JPG, PNG, WebP or PDF.'); return; }
    if (f.size > 10*1024*1024) { alert('File must be under 10 MB.'); return; }

    setFile(f);
    setReport(null);
    setCheckErr('');
    onRemove && onRemove();

    if (f.type !== 'application/pdf') {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }

    setChecking(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const token = localStorage.getItem('access_token');
      const res = await axios.post(
        `${API_URL}/upload/evidence`, fd,
        { headers: { 'Content-Type':'multipart/form-data', ...(token ? { Authorization:`Bearer ${token}` } : {}) } }
      );
      const r = res.data.best_image_report;
      setReport({ ...r, imagesFound: res.data.images_found, fileType: res.data.file_type });
      onResult && onResult({ file: f, report: r });
    } catch (err) {
      const msg = err.response?.data?.detail || 'Could not analyse the file.';
      setCheckErr(msg);
      onResult && onResult(null);
    } finally {
      setChecking(false);
    }
  };

  const remove = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setReport(null); setCheckErr('');
    onRemove && onRemove();
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]); };
  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  // ── empty state ───────────────────────────────────────────────────────────
  if (!file) return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
      style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:8, padding:'22px 16px', borderRadius:12,
        border: `2px dashed ${dragging ? '#3b82f6' : '#d1d5db'}`,
        background: dragging ? '#eff6ff' : '#f9fafb',
        cursor:'pointer', transition:'all .15s',
      }}
    >
      <Upload size={26} color={dragging ? '#3b82f6' : '#9ca3af'} />
      <p style={{margin:0, fontSize:13, color:'#374151', fontWeight:500}}>
        Drop your incident photo here, or <span style={{color:'#3b82f6'}}>browse</span>
      </p>
      <p style={{margin:0, fontSize:11, color:'#9ca3af'}}>JPG · PNG · WebP · PDF &nbsp;·&nbsp; Max 10 MB</p>
      <input ref={inputRef} type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
        style={{display:'none'}} onChange={e => accept(e.target.files[0])} />
    </div>
  );

  // ── file selected ─────────────────────────────────────────────────────────
  const isPdf = file.type === 'application/pdf';
  const q     = report?.quality;
  const bar   = q ? QUALITY_BAR[q] : 0;
  const col   = q ? QUALITY_COLOR[q] : '#9ca3af';

  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      {/* ── file row ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
        borderRadius:12, border:'1px solid #e5e7eb', background:'#f9fafb',
      }}>
        {/* thumbnail or pdf icon */}
        {isPdf
          ? <div style={{width:44,height:44,borderRadius:8,background:'#fee2e2',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <FileText size={22} color="#ef4444"/>
            </div>
          : preview
            ? <img src={preview} alt="preview"
                style={{width:44,height:44,objectFit:'cover',borderRadius:8,border:'1px solid #e5e7eb',flexShrink:0}}/>
            : null
        }

        {/* name + size */}
        <div style={{flex:1, minWidth:0}}>
          <p style={{margin:0, fontSize:13, fontWeight:600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {file.name}
          </p>
          <p style={{margin:0, fontSize:11, color:'#9ca3af'}}>
            {(file.size/1024/1024).toFixed(2)} MB
            {report?.fileType==='pdf' && report?.imagesFound > 0
              ? ` · ${report.imagesFound} image${report.imagesFound>1?'s':''} found in PDF` : ''}
          </p>
        </div>

        {/* spinner / badge */}
        {checking
          ? <Loader2 size={18} color="#3b82f6" style={{animation:'spin 1s linear infinite', flexShrink:0}}/>
          : q
            ? <span style={{
                fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99,
                background: q==='good'?'#dcfce7': q==='acceptable'?'#fef9c3':'#fee2e2',
                color: col, border:`1px solid ${col}30`, flexShrink:0,
              }}>
                {QUALITY_LABEL[q]}
              </span>
            : null
        }

        {/* remove */}
        <button onClick={remove} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'#9ca3af',flexShrink:0}}
          onMouseEnter={e=>e.currentTarget.style.color='#ef4444'}
          onMouseLeave={e=>e.currentTarget.style.color='#9ca3af'}>
          <X size={17}/>
        </button>
      </div>

      {/* ── quality progress bar ── */}
      {(checking || q) && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
            <span style={{fontSize:11,fontWeight:600,color:'#6b7280'}}>Image quality</span>
            {!checking && q && <span style={{fontSize:11,fontWeight:700,color:col}}>{bar}%</span>}
          </div>
          <div style={{height:7,borderRadius:99,background:'#e5e7eb',overflow:'hidden'}}>
            <div style={{
              height:'100%', borderRadius:99,
              width: checking ? '40%' : `${bar}%`,
              background: checking ? '#93c5fd' : col,
              transition:'width .5s ease, background .3s',
              animation: checking ? 'pulse 1s ease-in-out infinite' : 'none',
            }}/>
          </div>
        </div>
      )}

      {/* ── stats chips ── */}
      {report && !checkErr && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {[
            `📐 ${report.width}×${report.height}px`,
            `☀️ Brightness ${report.mean_brightness}/255`,
            `🔍 Sharpness ${report.sharpness_score}`,
          ].map((chip,i) => (
            <span key={i} style={{fontSize:11,padding:'3px 9px',borderRadius:99,background:'#f3f4f6',color:'#374151',border:'1px solid #e5e7eb'}}>
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* ── issues ── */}
      {report?.issues?.length > 0 && (
        <div style={{borderRadius:10,border:`1px solid ${col}40`,background: q==='poor'?'#fef2f2':'#fffbeb',padding:'10px 12px'}}>
          <ul style={{margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:4}}>
            {report.issues.map((issue,i) => (
              <li key={i} style={{display:'flex',gap:6,alignItems:'flex-start',fontSize:12,color:col}}>
                <AlertCircle size={12} style={{marginTop:2,flexShrink:0}}/>{issue}
              </li>
            ))}
          </ul>
          {report.suggestions?.length > 0 && (
            <ul style={{margin:'8px 0 0',padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:3}}>
              {report.suggestions.map((s,i) => (
                <li key={i} style={{fontSize:11,color:'#6b7280',display:'flex',gap:6,alignItems:'flex-start'}}>
                  <span>💡</span>{s}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── good message ── */}
      {q === 'good' && (
        <p style={{margin:0,fontSize:12,color:'#16a34a',fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
          <CheckCircle2 size={13}/> Evidence looks great — ready to submit!
        </p>
      )}

      {/* ── backend error ── */}
      {checkErr && (
        <p style={{margin:0,fontSize:12,color:'#dc2626',display:'flex',alignItems:'center',gap:5}}>
          <AlertCircle size={13}/> {checkErr}
        </p>
      )}
    </div>
  );
}

function Claims() {
  const [form, setForm] = useState({ event_type:'accident', location:'' });
  const [evidenceResult, setEvidenceResult] = useState(null); // { file, report }
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = !busy && form.location.trim() && evidenceResult && evidenceResult.report?.quality !== 'poor';

  const submit = async (e) => {
    e.preventDefault();
    if (!evidenceResult) { alert('Please upload incident evidence first.'); return; }
    if (evidenceResult.report?.quality === 'poor') { alert('Please upload a clearer photo before submitting.'); return; }

    const token = localStorage.getItem('access_token');
    if (!token) { window.location.href = '/login'; return; }

    setBusy(true); setResult(null);
    try {
      const ml = await api.post('/ml/claim-check', {
        claim_type: form.event_type==='accident'?'Accident':'Weather',
        previous_claims:0, previous_fraud_flags:0, gps_consistency:.92,
        weather_match: form.event_type==='weather'?.9:.75,
        activity_consistency:.94, timestamp_consistency:.96,
        evidence_quality: evidenceResult.report?.quality==='good' ? 0.95 : evidenceResult.report?.quality==='acceptable' ? 0.75 : 0.5,
        claim_severity:.7, coverage_amount:5000,
      });

      // Submit claim — use explicit Authorization header as safety net
      const claimRes = await axios.post(
        `${API_URL}/claims/submit`,
        {
          event_type: form.event_type,
          location: form.location,
          screenshot_url: evidenceResult.file?.name || 'frontend-demo',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const claim = claimRes.data;

      setResult({ ml: ml.data, claim });
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      setResult({ error: err.response?.data?.detail || err.message || 'Submission failed. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Claim center">
      <div className="split-grid">
        {/* LEFT */}
        <div className="panel">
          <div className="eyebrow">CLAIM INPUT</div>
          <h2>Tell us what happened</h2>
          <form className="form-stack" onSubmit={submit}>
            <label>Event type
              <select value={form.event_type} onChange={e=>setForm({...form,event_type:e.target.value})}>
                <option value="accident">Accident</option>
                <option value="weather">Weather disruption</option>
              </select>
            </label>
            <label>Location
              <input required placeholder="Mumbai, Andheri..." value={form.location}
                onChange={e=>setForm({...form,location:e.target.value})}/>
            </label>
            <label style={{display:'flex',flexDirection:'column',gap:6}}>
              <span>Incident evidence <span style={{color:'#ef4444'}}>*</span></span>
              <span style={{fontSize:11,color:'#9ca3af',fontWeight:400,marginTop:-4}}>
                Upload a photo or PDF of the incident — quality is checked automatically.
              </span>
              <EvidenceUploadBar
                onResult={setEvidenceResult}
                onRemove={() => setEvidenceResult(null)}
              />
            </label>
            <button className="primary-btn submit" disabled={!canSubmit}
              style={!canSubmit ? {opacity:.45,cursor:'not-allowed'} : {}}>
              {busy
                ? <><Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/> Verifying…</>
                : <>Submit &amp; verify <ArrowRight size={17}/></>
              }
            </button>
            {!evidenceResult && !busy && (
              <p style={{margin:0,fontSize:11,color:'#9ca3af',textAlign:'center'}}>
                Upload evidence to enable submission
              </p>
            )}
          </form>
        </div>

        {/* RIGHT */}
        <div className="panel">
          <div className="eyebrow">VERIFICATION TIMELINE</div>
          <h2>Claim state</h2>
          {!result
            ? <div className="empty-state"><Clock3/><p>Submit a claim to see ML verification and settlement state.</p></div>
            : result.error
              ? <div className="alert error">{result.error}</div>
              : <div className="timeline">
                  <div className="timeline-item">
                    <div className="timeline-dot"><BrainCircuit/></div>
                    <div><b>AI claim screening</b>
                      <span>Fraud probability: {(result.ml.fraud_probability*100).toFixed(1)}% · {result.ml.decision}</span>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-dot"><CheckCircle2/></div>
                    <div><b>Backend claim record</b>
                      <span>
                        {result.claim?.claim_id ? `Claim #${result.claim.claim_id}` : 'ML result received'}
                        {' · '}
                        <span style={{
                          fontWeight: 700,
                          color: result.claim?.verification_status === 'verified' ? '#16a34a' : '#d97706'
                        }}>
                          {result.claim?.verification_status || 'pending'}
                        </span>
                      </span>
                    </div>
                  </div>
                  {result.claim?.verification_status === 'verified' && (
                    <div className="timeline-item">
                      <div className="timeline-dot" style={{background:'#dcfce7'}}><WalletCards style={{color:'#16a34a'}}/></div>
                      <div>
                        <b>Payout issued</b>
                        <span style={{color:'#16a34a', fontWeight:600}}>
                          ₹{result.claim?.payout_amount?.toLocaleString('en-IN') || '5,000'} credited to wallet
                        </span>
                        {result.claim?.payout_tx_hash && (
                          <span style={{fontSize:10, color:'#9ca3af', display:'block', marginTop:2, wordBreak:'break-all'}}>
                            Tx: {result.claim.payout_tx_hash}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {result.ml.decision==='VALID' && result.claim?.verification_status === 'verified' && (
                    <div className="tx-box"><BadgeCheck size={16}/> Claim verified and payout processed successfully.</div>
                  )}
                </div>
          }
        </div>
      </div>
    </Shell>
  );
}

function Wallet() {
  const [balance, setBalance]             = useState(null);
  const [transactions, setTxns]           = useState([]);
  const [payoutMethod, setPayoutMethod]   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [premiumAmt, setPremiumAmt]       = useState(null);
  const [totalPremium, setTotalPremium]   = useState(null);
  const [premiumDuration, setPremiumDuration] = useState(30);
  const [premiumTier, setPremiumTier]     = useState('standard');
  const [isFirstTopup, setIsFirstTopup]   = useState(false);
  const [activePolicy, setActivePolicy]   = useState(null);  // locked policy from backend

  // Plan selector state (first top-up only)
  const [selectedTier, setSelectedTier]         = useState('standard');
  const [selectedDuration, setSelectedDuration] = useState(30);

  const PLAN_TIERS = [
    { key:'basic',    label:'Basic',    accident:'₹2,500', weather:'₹500',    desc:'Essential coverage', color:'#64748b' },
    { key:'standard', label:'Standard', accident:'₹5,000', weather:'₹1,000',  desc:'Recommended',        color:'#3b82f6' },
    { key:'plus',     label:'Plus',     accident:'₹10,000',weather:'₹2,000',  desc:'Maximum protection', color:'#8b5cf6' },
  ];

  // payout method form
  const [tab, setTab]                 = useState('upi');
  const [upi, setUpi]                 = useState('');
  const [bank, setBank]               = useState({ account:'', ifsc:'', name:'' });
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState('');

  // withdraw
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState({ text:'', ok:true });

  const load = async () => {
    setLoading(true);
    try {
      const [walletRes, premiumRes, activePolicyRes] = await Promise.allSettled([
        api.get('/wallet/balance'),
        api.get(`/premium/calculate?tier=${selectedTier}&duration_days=${selectedDuration}`),
        api.get('/premium/active-policy'),
      ]);

      if (walletRes.status === 'fulfilled') {
        setBalance(walletRes.value.data.balance);
        setTxns(walletRes.value.data.transactions);
        setPayoutMethod(walletRes.value.data.payout_method);
        setIsFirstTopup(walletRes.value.data.is_first_topup ?? false);
      }

      if (premiumRes.status === 'fulfilled') {
        const d = premiumRes.value.data;
        const daily = d.premium ?? d.recommended_premium ?? null;
        setPremiumAmt(daily ? parseFloat(daily).toFixed(2) : null);
        setTotalPremium(d.total_premium ? parseFloat(d.total_premium).toFixed(2) : null);
        setPremiumDuration(d.duration_days || selectedDuration);
        setPremiumTier(d.tier || selectedTier);
      }

      if (activePolicyRes.status === 'fulfilled') {
        const ap = activePolicyRes.value.data;
        setActivePolicy(ap.has_active_policy ? ap.policy : null);
        // Sync selectors to active policy so they show the locked values
        if (ap.has_active_policy && ap.policy) {
          setSelectedTier(ap.policy.tier);
          setSelectedDuration(ap.policy.duration_days);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedTier, selectedDuration]);

  const saveMethod = async (e) => {
    e.preventDefault(); setSaving(true); setSaveMsg('');
    try {
      const payload = tab === 'upi'
        ? { upi_id: upi }
        : { bank_account: bank.account, bank_ifsc: bank.ifsc, bank_name: bank.name };
      const r = await api.put('/wallet/payout-method', payload);
      setPayoutMethod(r.data.payout_method);
      setSaveMsg('Saved successfully!');
    } catch (e) {
      setSaveMsg(e.response?.data?.detail || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const doWithdraw = async (e) => {
    e.preventDefault();
    setWithdrawing(true); setWithdrawMsg({ text:'', ok:true });
    try {
      // Use Razorpay payout endpoint
      const r = await api.post('/razorpay/payout', {
        amount_inr: parseFloat(withdrawAmt),
        upi_id: upi || undefined,
      });
      setWithdrawMsg({ text: r.data.message, ok: true });
      setWithdrawAmt('');
      await load();
    } catch (e) {
      setWithdrawMsg({ text: e.response?.data?.detail || 'Withdrawal failed.', ok: false });
    } finally {
      setWithdrawing(false);
    }
  };

  // Razorpay checkout popup for premium payment
  const payPremium = async (amountInr, tier, durationDays) => {
    try {
      const order = await api.post('/razorpay/create-order', {
        amount_inr:    amountInr,
        description:   `ZenoGuard ${tier || 'Standard'} Plan — ${durationDays || 30} days`,
        tier:          tier || selectedTier,
        duration_days: durationDays || selectedDuration,
      });
      const { order_id, amount, currency, key_id, rider_name, rider_email } = order.data;

      const options = {
        key:         key_id,
        amount:      amount,
        currency:    currency,
        name:        'ZenoGuard',
        description: `${tier || selectedTier} plan · ${durationDays || selectedDuration} days`,
        order_id:    order_id,
        handler: async (response) => {
          try {
            const verify = await api.post('/razorpay/verify-payment', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            });
            alert(
              `✅ ${verify.data.message}\n` +
              `Payment ID: ${response.razorpay_payment_id}\n` +
              `New balance: ₹${verify.data.new_balance?.toFixed(2) ?? '—'}`
            );
            await load();   // refresh balance, transactions, active policy
          } catch (err) {
            alert('Payment verification failed. Contact support.');
          }
        },
        prefill:  { name: rider_name, email: rider_email },
        theme:    { color: '#0f172a' },
        modal:    { ondismiss: () => {} },
      };

      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = resolve; s.onerror = reject;
          document.body.appendChild(s);
        });
      }
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not initiate payment.');
    }
  };

  const fmtAmt = (n) => `${n >= 0 ? '+' : ''}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
  const txColor = (t) => t.amount >= 0 ? '#16a34a' : '#dc2626';
  const txBg    = (t) => t.amount >= 0 ? '#f0fdf4' : '#fef2f2';

  return (
    <Shell title="Payout wallet">
      <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:720 }}>

        {/* ── Balance card ── */}
        <div style={{ background:'#0f172a', borderRadius:16, padding:'28px 28px 24px', color:'#fff' }}>

          {/* Top row: balance + top-up button side by side */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
            <div>
              <p style={{ margin:0, fontSize:11, fontWeight:700, letterSpacing:2, color:'#94a3b8', textTransform:'uppercase' }}>Available balance</p>
              {loading
                ? <p style={{ margin:'12px 0 0', fontSize:36, fontWeight:800 }}>Loading…</p>
                : <p style={{ margin:'8px 0 0', fontSize:42, fontWeight:800, letterSpacing:-1 }}>
                    ₹{(balance || 0).toLocaleString('en-IN', { minimumFractionDigits:2 })}
                  </p>
              }
              <p style={{ margin:'6px 0 0', fontSize:12, color:'#64748b' }}>
                {payoutMethod ? `Linked: ${payoutMethod}` : 'No payout method linked yet'}
              </p>
            </div>

            {/* Top-up button */}
            {!isFirstTopup && (
              <button
                onClick={() => payPremium(parseFloat(totalPremium || premiumAmt || 50))}
                disabled={loading}
                style={{
                  padding:'12px 20px', borderRadius:12, border:'2px solid #3b82f6',
                  background:'#3b82f6', color:'#fff',
                  fontSize:13, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                  opacity: loading ? 0.6 : 1, minWidth:140,
                }}
              >
                <span style={{ fontSize:18 }}>➕ Top Up</span>
                {totalPremium
                  ? <span style={{ fontSize:11, opacity:0.85 }}>₹{totalPremium} · {premiumDuration} days</span>
                  : <span style={{ fontSize:11, opacity:0.7 }}>calculating…</span>
                }
              </button>
            )}
          </div>

          {premiumAmt && totalPremium && !isFirstTopup && (
            <p style={{ margin:'10px 0 0', fontSize:11, color:'#475569' }}>
              ₹{premiumAmt}/day · {premiumTier.charAt(0).toUpperCase()+premiumTier.slice(1)} plan · {premiumDuration} days
              &nbsp;· <span style={{color:'#94a3b8'}}>[Prototype Assumption]</span>
            </p>
          )}
        </div>

        {/* ── FIRST TOP-UP: Plan selector  OR  Active policy status ── */}
        {activePolicy ? (
          /* ── Active locked policy card ── */
          <div style={{ background:'#f0fdf4', borderRadius:16, border:'2px solid #bbf7d0', padding:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:18 }}>🔒</span>
              <div className="eyebrow" style={{ color:'#16a34a' }}>ACTIVE POLICY — LOCKED</div>
            </div>
            <h2 style={{ marginTop:0, marginBottom:8, color:'#15803d' }}>
              {activePolicy.tier_label} Plan · {activePolicy.duration_days} days
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
              {[
                { label:'Accident cover',  value:`₹${activePolicy.coverage?.accident?.toLocaleString('en-IN')}` },
                { label:'Weather cover',   value:`₹${activePolicy.coverage?.weather?.toLocaleString('en-IN')}` },
                { label:'Days remaining',  value: activePolicy.days_remaining != null ? `${activePolicy.days_remaining} days` : '—' },
              ].map((item, i) => (
                <div key={i} style={{ background:'#fff', borderRadius:10, padding:'10px 12px', border:'1px solid #dcfce7' }}>
                  <p style={{ margin:0, fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1 }}>{item.label}</p>
                  <p style={{ margin:'4px 0 0', fontSize:16, fontWeight:800, color:'#15803d' }}>{item.value}</p>
                </div>
              ))}
            </div>
            <p style={{ margin:0, fontSize:11, color:'#64748b' }}>
              ₹{activePolicy.premium?.toFixed(2)}/day · Active until {activePolicy.end_date ? new Date(activePolicy.end_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
              &nbsp;· <span style={{color:'#94a3b8'}}>[Prototype Assumption]</span>
            </p>
            <p style={{ margin:'6px 0 0', fontSize:11, color:'#94a3b8' }}>
              🔒 Plan is locked for the policy period. You can renew or upgrade when it expires.
            </p>
          </div>
        ) : isFirstTopup ? (
          /* ── First top-up: Plan selector ── */
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:24 }}>
            <div className="eyebrow">ACTIVATE COVERAGE</div>
            <h2 style={{ marginTop:4, marginBottom:4 }}>Choose your plan</h2>
            <p className="muted" style={{ marginBottom:16, fontSize:13 }}>
              Select a plan and duration to activate your insurance. You pay for the full period upfront.
            </p>

            {/* Tier cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
              {PLAN_TIERS.map(t => (
                <div key={t.key} onClick={() => setSelectedTier(t.key)}
                  style={{
                    padding:'14px 12px', borderRadius:12, cursor:'pointer', textAlign:'center',
                    border: `2px solid ${selectedTier===t.key ? t.color : '#e2e8f0'}`,
                    background: selectedTier===t.key ? `${t.color}10` : '#f8fafc',
                    transition:'all .15s',
                  }}
                >
                  <p style={{ margin:0, fontSize:13, fontWeight:800, color: selectedTier===t.key ? t.color : '#374151' }}>{t.label}</p>
                  <p style={{ margin:'4px 0 0', fontSize:10, color:'#64748b' }}>{t.desc}</p>
                  <p style={{ margin:'6px 0 0', fontSize:11, fontWeight:600, color:'#374151' }}>🚗 {t.accident}</p>
                  <p style={{ margin:'2px 0 0', fontSize:11, color:'#64748b' }}>🌧 {t.weather}</p>
                </div>
              ))}
            </div>

            {/* Duration buttons */}
            <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:600, color:'#64748b' }}>Coverage duration</p>
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              {[
                { days:7,  label:'7 days',  note:'Short-term' },
                { days:30, label:'30 days', note:'Recommended' },
                { days:90, label:'90 days', note:'Best value' },
              ].map(d => (
                <button key={d.days} onClick={() => setSelectedDuration(d.days)} style={{
                  flex:1, padding:'10px 8px', borderRadius:10, cursor:'pointer',
                  border: `2px solid ${selectedDuration===d.days ? '#3b82f6' : '#e2e8f0'}`,
                  background: selectedDuration===d.days ? '#eff6ff' : '#f8fafc',
                  color: selectedDuration===d.days ? '#3b82f6' : '#64748b',
                  fontWeight:700, fontSize:12,
                }}>
                  {d.label}
                  <span style={{ display:'block', fontSize:10, fontWeight:400, opacity:0.7 }}>{d.note}</span>
                </button>
              ))}
            </div>

            {/* Summary + pay button */}
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'14px 16px', borderRadius:12, background:'#f1f5f9', flexWrap:'wrap', gap:10,
            }}>
              <div>
                <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#1e293b' }}>
                  {PLAN_TIERS.find(t=>t.key===selectedTier)?.label} · {selectedDuration} days
                </p>
                <p style={{ margin:'2px 0 0', fontSize:12, color:'#64748b' }}>
                  {loading ? 'Calculating…' : `₹${premiumAmt}/day · Total ₹${totalPremium}`}
                </p>
                <p style={{ margin:'2px 0 0', fontSize:10, color:'#94a3b8' }}>[Prototype Assumption]</p>
              </div>
              <button
                onClick={() => payPremium(parseFloat(totalPremium || premiumAmt || 50), selectedTier, selectedDuration)}
                disabled={loading || !totalPremium}
                style={{
                  padding:'12px 24px', borderRadius:10, border:'none',
                  background: loading ? '#94a3b8' : '#0f172a',
                  color:'#fff', fontSize:13, fontWeight:700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Loading…' : `Pay ₹${totalPremium || '…'} & Activate`}
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

          {/* ── Payout method ── */}
          <div className="panel" style={{ gridColumn: '1 / 2' }}>
            <div className="eyebrow">PAYOUT METHOD</div>
            <h2 style={{ marginTop:4 }}>Link your account</h2>
            <p className="muted" style={{ marginBottom:12 }}>Claim payouts will be transferred here automatically.</p>

            {/* tab switcher */}
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {['upi','bank'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding:'6px 18px', borderRadius:99, border:'1px solid',
                  borderColor: tab===t ? '#0f172a' : '#e2e8f0',
                  background: tab===t ? '#0f172a' : '#fff',
                  color: tab===t ? '#fff' : '#64748b',
                  fontSize:12, fontWeight:600, cursor:'pointer',
                }}>
                  {t === 'upi' ? '📱 UPI' : '🏦 Bank'}
                </button>
              ))}
            </div>

            <form className="form-stack" onSubmit={saveMethod}>
              {tab === 'upi' ? (
                <label>UPI ID
                  <input placeholder="yourname@upi" value={upi} onChange={e=>setUpi(e.target.value)} required />
                </label>
              ) : (
                <>
                  <label>Bank name<input placeholder="SBI / HDFC / ICICI…" value={bank.name} onChange={e=>setBank({...bank,name:e.target.value})} required /></label>
                  <label>Account number<input placeholder="Account number" value={bank.account} onChange={e=>setBank({...bank,account:e.target.value})} required /></label>
                  <label>IFSC code<input placeholder="SBIN0001234" value={bank.ifsc} onChange={e=>setBank({...bank,ifsc:e.target.value})} required /></label>
                </>
              )}
              <button className="primary-btn submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save method'} <ArrowRight size={15}/>
              </button>
              {saveMsg && <p style={{ margin:0, fontSize:12, color: saveMsg.includes('success') ? '#16a34a' : '#dc2626' }}>{saveMsg}</p>}
            </form>
          </div>

          {/* ── Withdraw ── */}
          <div className="panel" style={{ gridColumn: '2 / 3' }}>
            <div className="eyebrow">WITHDRAW FUNDS</div>
            <h2 style={{ marginTop:4 }}>Transfer to {tab === 'upi' ? 'UPI' : 'bank'}</h2>
            <p className="muted" style={{ marginBottom:12 }}>Withdraw your claim balance to your linked account.</p>

            <form className="form-stack" onSubmit={doWithdraw}>
              <label>Amount (₹)
                <input type="number" min="1" step="0.01" placeholder="Enter amount"
                  value={withdrawAmt} onChange={e=>setWithdrawAmt(e.target.value)} required />
              </label>
              {payoutMethod && (
                <p style={{ margin:'-4px 0 4px', fontSize:11, color:'#64748b' }}>
                  To: <strong>{payoutMethod}</strong>
                </p>
              )}
              <button className="primary-btn submit" disabled={withdrawing || !payoutMethod || !balance}>
                {withdrawing ? 'Processing…' : 'Withdraw'} <ArrowRight size={15}/>
              </button>
              {!payoutMethod && <p style={{ margin:0, fontSize:11, color:'#f59e0b' }}>⚠ Save a payout method first</p>}
              {withdrawMsg.text && (
                <p style={{ margin:0, fontSize:12, color: withdrawMsg.ok ? '#16a34a' : '#dc2626' }}>
                  {withdrawMsg.text}
                </p>
              )}
            </form>

            <div style={{ marginTop:16, padding:'10px 12px', borderRadius:10, background:'#f8fafc', border:'1px solid #e2e8f0' }}>
              <p style={{ margin:0, fontSize:11, color:'#64748b', lineHeight:1.6 }}>
                💡 Claim payouts are credited instantly to your ZenoGuard balance.<br/>
                Transfers to UPI/bank take 1–2 business days.
              </p>
            </div>
          </div>
        </div>

        {/* ── Transaction history ── */}
        <div className="panel">
          <div className="eyebrow">TRANSACTION HISTORY</div>
          <h2 style={{ marginTop:4, marginBottom:14 }}>Recent activity</h2>

          {loading
            ? <p className="muted">Loading…</p>
            : transactions.length === 0
              ? <div className="empty-state"><WalletCards/><p>No transactions yet. Submit a claim to receive your first payout.</p></div>
              : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {transactions.map(t => (
                    <div key={t.id} style={{
                      display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                      borderRadius:10, background: txBg(t), border:`1px solid ${t.amount>=0?'#bbf7d0':'#fecaca'}`,
                    }}>
                      <div style={{ fontSize:20, width:32, textAlign:'center' }}>
                        {t.transaction_type === 'claim_payout' ? '💰' : t.transaction_type === 'withdrawal' ? '🏦' : t.transaction_type === 'premium_payment' ? '🛡️' : t.transaction_type === 'top_up' ? '💳' : '↩️'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#1e293b' }}>{t.description || t.transaction_type}</p>
                        <p style={{ margin:0, fontSize:11, color:'#94a3b8' }}>{fmtDate(t.timestamp)} · {t.reference_id}</p>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <p style={{ margin:0, fontSize:14, fontWeight:700, color: txColor(t) }}>{fmtAmt(t.amount)}</p>
                        <span style={{
                          fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:99,
                          background: t.status==='completed'?'#dcfce7': t.status==='pending'?'#fef9c3':'#fee2e2',
                          color: t.status==='completed'?'#16a34a': t.status==='pending'?'#d97706':'#dc2626',
                        }}>{t.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
          }
        </div>

      </div>
    </Shell>
  );
}

function SimplePage({title,label,children}) { return <Shell title={title}><div className="content-narrow"><div className="panel"><div className="eyebrow">{label}</div>{children}</div></div></Shell>; }

function App() { return <BrowserRouter><Routes><Route path="/" element={<Home/>}/><Route path="/login" element={<AuthPage mode="login"/>}/><Route path="/signup" element={<AuthPage mode="signup"/>}/><Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/><Route path="/claims" element={<Protected><Claims/></Protected>}/><Route path="/wallet" element={<Protected><Wallet/></Protected>}/><Route path="/kyc" element={<Protected><SimplePage title="Identity verification" label="KYC"><h2>Verify your identity</h2><p className="muted">Connect the production KYC provider here. The frontend node is ready without storing documents on-chain.</p><div className="info-row"><Shield size={20}/> Evidence remains off-chain.</div></SimplePage></Protected>}/><Route path="/company" element={<Protected><SimplePage title="Gig platform" label="WORK PROFILE"><h2>Choose your platform</h2><p className="muted">Uber · Ola · Zomato · Swiggy can feed the work profile used by the risk engine.</p><div className="platform-grid"><div className="platform-card selected"><Sparkles/><b>Gig profile ready</b><span>Connected to FastAPI</span></div></div></SimplePage></Protected>}/><Route path="/timeline" element={<Protected><SimplePage title="Claim timeline" label="SETTLEMENT"><div className="timeline"><TimelineStep icon={<CheckCircle2/>} title="Claim submitted" text="Evidence enters the backend."/><TimelineStep icon={<BrainCircuit/>} title="AI verification" text="Fraud probability and confidence are calculated."/><TimelineStep icon={<ShieldCheck/>} title="Smart contract" text="Authorized oracle records verification."/><TimelineStep icon={<WalletCards/>} title="Payout" text="InsurancePool releases testnet funds."/></div></SimplePage></Protected>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></BrowserRouter>; }
function TimelineStep({icon,title,text}) { return <div className="timeline-item"><div className="timeline-dot">{icon}</div><div><b>{title}</b><span>{text}</span></div></div>; }
export default App;
