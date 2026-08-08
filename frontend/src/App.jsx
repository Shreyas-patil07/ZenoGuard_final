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

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
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
  const user = userFromStorage(); const [premium,setPremium]=useState(null); const [msg,setMsg]=useState(''); const [earn,setEarn]=useState({income:'',hours_worked:''}); const [busy,setBusy]=useState(false);
  const load=async()=>{try{const r=await api.get('/premium/calculate');setPremium(r.data)}catch(e){setMsg(e.response?.data?.detail||'Premium endpoint unavailable; use the ML endpoint directly for testing.')}};
  useEffect(()=>{load()},[]);
  const save=async e=>{e.preventDefault();setBusy(true);setMsg('');try{await api.post('/earnings/upload',{income:+earn.income,hours_worked:+earn.hours_worked});setMsg('Earnings saved.');setEarn({income:'',hours_worked:''});await load()}catch(e){setMsg(e.response?.data?.detail||'Could not save earnings.')}finally{setBusy(false)}};
  return <Shell title={`Welcome back, ${user?.name||'Guardian'}.`}><div className="dashboard-grid"><div className="metric-card featured"><div className="metric-label"><ShieldCheck size={17}/> ACTIVE PROTECTION</div><strong>₹{Number(premium?.premium??premium?.recommended_premium??0).toFixed(2)}</strong><span>/ day indicative premium</span><div className="metric-bottom"><span>Risk score {premium?.risk_score??'—'}</span><button onClick={load}><RefreshCw size={15}/></button></div></div><div className="metric-card"><div className="metric-label"><IndianRupee size={17}/> RISK EXPLANATION</div><h3>{premium?.explanation||'Your premium is driven by your current work-risk profile.'}</h3><span>Backend risk engine + ML premium model</span></div><div className="metric-card"><div className="metric-label"><BrainCircuit size={17}/> VERIFICATION</div><h3>ML → Oracle → Claim Manager</h3><span>Blockchain settlement is ready for local/testnet integration.</span></div></div><div className="split-grid"><div className="panel"><div className="eyebrow">EARNINGS</div><h2>Update today's work</h2><form className="inline-form" onSubmit={save}><input type="number" min="0" placeholder="Income ₹" required value={earn.income} onChange={e=>setEarn({...earn,income:e.target.value})}/><input type="number" min="0" step="0.1" placeholder="Hours" required value={earn.hours_worked} onChange={e=>setEarn({...earn,hours_worked:e.target.value})}/><button className="primary-btn" disabled={busy}>{busy?'Saving...':'Save'}</button></form>{msg&&<div className="notice">{msg}</div>}</div><div className="panel claim-cta"><div className="metric-label"><FileWarning size={17}/> CLAIMS</div><h2>Something happened on the road?</h2><p className="muted">Submit the event and let the ML verification layer determine the next state.</p><Link className="primary-btn" to="/claims">Start a claim <ArrowUpRight size={17}/></Link></div></div></Shell>;
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

function Wallet() { const [connected,setConnected]=useState(false); return <Shell title="Payout wallet"><div className="content-narrow"><div className="panel wallet-panel"><div className="wallet-icon"><WalletCards/></div><h2>{connected?'Wallet connected':'Connect your wallet'}</h2><p className="muted">The wallet is the destination for automated testnet payouts after the claim contract approves settlement.</p>{connected?<div className="connected"><CheckCircle2/> 0xf39F...2266</div>:<button className="primary-btn submit" onClick={()=>setConnected(true)}>Connect demo wallet <ArrowRight size={17}/></button>}</div></div></Shell>; }

function SimplePage({title,label,children}) { return <Shell title={title}><div className="content-narrow"><div className="panel"><div className="eyebrow">{label}</div>{children}</div></div></Shell>; }

function App() { return <BrowserRouter><Routes><Route path="/" element={<Home/>}/><Route path="/login" element={<AuthPage mode="login"/>}/><Route path="/signup" element={<AuthPage mode="signup"/>}/><Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/><Route path="/claims" element={<Protected><Claims/></Protected>}/><Route path="/wallet" element={<Protected><Wallet/></Protected>}/><Route path="/kyc" element={<Protected><SimplePage title="Identity verification" label="KYC"><h2>Verify your identity</h2><p className="muted">Connect the production KYC provider here. The frontend node is ready without storing documents on-chain.</p><div className="info-row"><Shield size={20}/> Evidence remains off-chain.</div></SimplePage></Protected>}/><Route path="/company" element={<Protected><SimplePage title="Gig platform" label="WORK PROFILE"><h2>Choose your platform</h2><p className="muted">Uber · Ola · Zomato · Swiggy can feed the work profile used by the risk engine.</p><div className="platform-grid"><div className="platform-card selected"><Sparkles/><b>Gig profile ready</b><span>Connected to FastAPI</span></div></div></SimplePage></Protected>}/><Route path="/timeline" element={<Protected><SimplePage title="Claim timeline" label="SETTLEMENT"><div className="timeline"><TimelineStep icon={<CheckCircle2/>} title="Claim submitted" text="Evidence enters the backend."/><TimelineStep icon={<BrainCircuit/>} title="AI verification" text="Fraud probability and confidence are calculated."/><TimelineStep icon={<ShieldCheck/>} title="Smart contract" text="Authorized oracle records verification."/><TimelineStep icon={<WalletCards/>} title="Payout" text="InsurancePool releases testnet funds."/></div></SimplePage></Protected>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></BrowserRouter>; }
function TimelineStep({icon,title,text}) { return <div className="timeline-item"><div className="timeline-dot">{icon}</div><div><b>{title}</b><span>{text}</span></div></div>; }
export default App;
