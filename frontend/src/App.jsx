import React, { useEffect, useState } from 'react';
import logoNoBg from './assets/logo_no_bg.png';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  CloudUpload,
  FileWarning,
  IndianRupee,
  LockKeyhole,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import './App.css';
import WalletPayments from './WalletPayments';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const api = axios.create({ baseURL: API_URL, timeout: 15000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
  const loggedIn = !!localStorage.getItem('access_token');
  const navigate = useNavigate();
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

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
      <div className="hero-visual"><div className="hero-glow"/><div className="protection-card"><div className="card-icon"><ShieldCheck/></div><span>LIVE PROTECTION</span><strong>₹5,000</strong><small>Potential claim coverage</small><div className="meter"><i/></div><div className="mini-grid"><div><b>₹13.52</b><span>Indicative premium</span></div><div><b>94%</b><span>AI confidence</span></div></div></div></div>
    </section>
    <section id="how-it-works" className="section"><div className="section-title"><div className="eyebrow">HOW IT WORKS</div><h2>One protection loop, three simple steps.</h2></div><div className="feature-grid"><Feature n="01" icon={<Activity/>} title="Sync your work" text="Your earnings and work pattern become the inputs for a transparent risk profile."/><Feature n="02" icon={<BrainCircuit/>} title="AI prices risk" text="Premium and claim models turn work signals and evidence into decisions."/><Feature n="03" icon={<ShieldCheck/>} title="Settle on-chain" text="Verified claims move through the insurance contracts and payout pool."/></div></section>
    <section id="security" className="dark-section"><div><div className="eyebrow">SECURITY</div><h2>AI finds the signal. Smart contracts enforce the settlement.</h2><p>Large evidence stays off-chain. Critical policy, claim and payout state is enforced by the blockchain layer.</p></div><div className="security-stack"><span>ML</span><b>→</b><span>Oracle</span><b>→</b><span>Claim Manager</span><b>→</b><span>Worker Wallet</span></div></section>
    <section id="coverage" className="section centered"><div className="eyebrow">READY WHEN YOU ARE</div><h2>Protect the income behind your hustle.</h2><Link className="primary-btn large" to="/signup">Get started <ArrowRight size={18}/></Link></section>
    <footer className="footer"><Brand/><span>© 2026 ZenoGuard</span></footer>
  </div>;
}

function Feature({ n, icon, title, text }) { return <article className="feature-card"><div className="feature-top"><span>{n}</span><div className="feature-icon">{icon}</div></div><h3>{title}</h3><p>{text}</p></article>; }

function AuthPage({ mode }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', password:'', confirm:'' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSignup && form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const { data } = isSignup
        ? await auth.signup(form.name, form.email, form.password)
        : await auth.login(form.email, form.password);
      saveSession(data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Request failed. Check the backend and your credentials.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="auth-page"><div className="ambient ambient-a"/><div className="ambient ambient-b"/><div className="auth-card"><Brand/><div className="auth-content"><div className="eyebrow">AI-NEGOTIATED MICRO-INSURANCE</div><h1>{isSignup ? 'Build your protection profile.' : 'Welcome back.'}</h1><p className="muted">{isSignup ? 'Start with your identity and gig-work profile.' : 'Sign in to manage your protection.'}</p>{error&&<div className="alert error">{error}</div>}<form className="form-stack" onSubmit={submit}>{isSignup&&<label>Full name<input required placeholder="Your name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>}<label>Email address<input required type="email" placeholder="you@example.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Password<input required type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>{isSignup&&<label>Confirm password<input required type="password" placeholder="Repeat password" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})}/></label>}<button className="primary-btn submit" disabled={busy}>{busy?'Please wait...':isSignup?'Create account':'Log in'}<ArrowRight size={17}/></button></form><div className="auth-footer">{isSignup ? <>Already registered? <Link to="/login">Log in</Link></> : <>New to ZenoGuard? <Link to="/signup">Create an account</Link></>}</div></div></div><Link className="back-home" to="/">← Back to home</Link></div>;
}

function Shell({ title, children }) {
  const navigate = useNavigate();
  const user = userFromStorage();
  const [open, setOpen] = useState(false);
  const [policyState, setPolicyState] = useState(null);

  useEffect(() => {
    let mounted = true;
    api.get('/premium/active-policy')
      .then((res) => { if (mounted) setPolicyState(res.data); })
      .catch(() => { if (mounted) setPolicyState(null); });
    return () => { mounted = false; };
  }, []);

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const active = policyState?.policy;
  const pending = policyState?.pending_policy;
  const status = active?.active
    ? active.blockchain_status === 'CONFIRMED' ? 'Protection active' : 'Blockchain pending'
    : pending ? 'Payment pending' : 'No active protection';

  return <div className="app-shell"><aside className={`sidebar ${open?'open':''}`}><div className="side-brand"><Brand/><button className="mobile-close" onClick={()=>setOpen(false)}><X/></button></div><div className="side-user"><div className="avatar">{(user?.name||'G').slice(0,1).toUpperCase()}</div><div><b>{user?.name||'Guardian'}</b><span>Gig worker</span></div></div><nav className="side-nav"><Link to="/dashboard">Overview</Link><Link to="/claims">Claims</Link><Link to="/wallet">Wallet</Link></nav><button className="side-logout" onClick={logout}><LogOut size={17}/> Logout</button></aside><main className="app-main"><header className="mobile-top"><button className="menu-btn" onClick={()=>setOpen(true)}><Menu/></button><Brand/><span aria-hidden="true"/></header><div className="page-head"><div><div className="eyebrow">ZENOGUARD PROTECTION</div><h1>{title}</h1></div><div className="status-pill"><ShieldCheck size={16}/> {status}</div></div>{children}</main></div>;
}

function Dashboard() {
  const user = userFromStorage();
  const [policyState, setPolicyState] = useState(null);
  const [premium, setPremium] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [earn, setEarn] = useState({ income:'', hours_worked:'' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setMsg('');
    try {
      const [policyRes, premiumRes] = await Promise.all([
        api.get('/premium/active-policy'),
        api.get('/premium/calculate'),
      ]);
      setPolicyState(policyRes.data);
      setPremium(premiumRes.data);
    } catch (e) {
      setMsg(e.response?.data?.detail || 'Unable to load protection status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await api.post('/earnings/upload', { income:+earn.income, hours_worked:+earn.hours_worked });
      setMsg('Earnings saved.');
      setEarn({ income:'', hours_worked:'' });
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || 'Could not save earnings.');
    } finally {
      setBusy(false);
    }
  };

  const active = policyState?.policy;
  const pending = policyState?.pending_policy;
  const blockchainConfirmed = active?.blockchain_status === 'CONFIRMED';

  return <Shell title={`Welcome back, ${user?.name||'Guardian'}`}>
    <div className="dashboard-grid">
      <div className="metric-card featured">
        <div className="metric-label"><ShieldCheck size={17}/> {active ? 'ACTIVE PROTECTION' : pending ? 'PAYMENT PENDING' : 'PROTECTION STATUS'}</div>
        {loading ? <><strong>Loading...</strong><span>Checking your current policy</span></> : active ? <><strong>{active.tier_label}</strong><span>{active.days_remaining ?? 0} days remaining · ₹{Number(active.total_premium || 0).toFixed(2)} paid</span></> : pending ? <><strong>{pending.tier_label}</strong><span>Complete premium payment to activate coverage</span></> : <><strong>No active policy</strong><span>Choose a protection plan from Wallet</span></>}
        <div className="metric-bottom"><span>{active ? `Risk score ${active.risk_score}` : `Indicative risk ${premium?.risk_score ?? '—'}`}</span><button onClick={load} aria-label="Refresh protection status"><RefreshCw size={15}/></button></div>
      </div>
      <div className="metric-card">
        <div className="metric-label"><IndianRupee size={17}/> {active ? 'COVERAGE' : 'INDICATIVE PREMIUM'}</div>
        {active ? <><h3>₹{Number(active.coverage?.accident || 0).toLocaleString('en-IN')}</h3><span>Accident coverage · Breakdown ₹{Number(active.coverage?.breakdown || 0).toLocaleString('en-IN')} · Weather ₹{Number(active.coverage?.weather || 0).toLocaleString('en-IN')}</span></> : <><h3>₹{Number(premium?.premium ?? premium?.recommended_premium ?? 0).toFixed(2)}/day</h3><span>{premium?.explanation || 'Calculated from your current work-risk profile.'}</span></>}
      </div>
      <div className="metric-card">
        <div className="metric-label"><BrainCircuit size={17}/> BLOCKCHAIN</div>
        {active ? <><h3>{blockchainConfirmed ? 'CONFIRMED' : active.blockchain_status || 'PENDING'}</h3><span>{active.blockchain_policy_id ? `On-chain policy #${active.blockchain_policy_id}` : 'Policy synchronization pending'}</span></> : <><h3>Ready</h3><span>Policy activation is recorded on-chain after successful payment verification.</span></>}
      </div>
    </div>

    <div className="split-grid">
      <div className="panel"><div className="eyebrow">EARNINGS</div><h2>Update today's work</h2><form className="inline-form" onSubmit={save}><input type="number" min="0" placeholder="Income ₹" required value={earn.income} onChange={e=>setEarn({...earn,income:e.target.value})}/><input type="number" min="0" step="0.1" placeholder="Hours" required value={earn.hours_worked} onChange={e=>setEarn({...earn,hours_worked:e.target.value})}/><button className="primary-btn" disabled={busy}>{busy?'Saving...':'Save'}</button></form>{msg&&<div className="notice">{msg}</div>}</div>
      <div className="panel claim-cta"><div className="metric-label"><FileWarning size={17}/> CLAIMS</div><h2>Something happened on the road?</h2><p className="muted">Submit the event and let the ML verification layer determine the next state.</p><Link className="primary-btn" to="/claims">Start a claim <ArrowUpRight size={17}/></Link></div>
    </div>
  </Shell>;
}

function Claims() {
  const [form,setForm]=useState({event_type:'accident',location:''});
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);
  const [evidenceFile,setEvidenceFile]=useState(null);
  const [evidence,setEvidence]=useState(null);

  const chooseFile=(e)=>{
    const file=e.target.files?.[0]||null;
    setEvidenceFile(file);
    setEvidence(null);
    setResult(null);
  };

  const submit=async e=>{
    e.preventDefault();
    if(!evidenceFile){setResult({error:'Please upload photo evidence before submitting the claim.'});return;}
    setBusy(true);setResult(null);setEvidence(null);
    try{
      const body=new FormData();
      body.append('file',evidenceFile);
      const upload=(await api.post('/upload/evidence',body,{headers:{'Content-Type':'multipart/form-data'}})).data;
      setEvidence(upload);

      const evidenceQuality=upload.quality==='good'?0.95:0.65;
      const ml=(await api.post('/ml/claim-check',{
        claim_type:form.event_type==='accident'?'Accident':form.event_type==='breakdown'?'Breakdown':'Weather',
        previous_claims:0,
        previous_fraud_flags:0,
        gps_consistency:.92,
        weather_match:form.event_type==='weather'?.9:.75,
        activity_consistency:.94,
        timestamp_consistency:.96,
        evidence_quality:evidenceQuality,
        claim_severity:.7,
        coverage_amount:5000
      })).data;

      let claim=null;
      try{
        claim=(await api.post('/claims/submit',{
          event_type:form.event_type,
          location:form.location.trim(),
          screenshot_url:upload.cloudinary_url
        })).data;
      }catch(err){
        claim={error:err.response?.data?.detail||'Claim record endpoint unavailable'};
      }
      setResult({ml,claim});
    }catch(err){
      setResult({error:err.response?.data?.detail||'Evidence upload or ML verification failed.'});
    }finally{setBusy(false);}
  };

  return <Shell title="Claim center">
    <div className="split-grid">
      <div className="panel">
        <div className="eyebrow">CLAIM INPUT</div>
        <h2>Tell us what happened</h2>
        <p className="muted">Upload clear evidence. ZenoGuard stores the image off-chain and uses it as claim evidence.</p>
        <form className="form-stack" onSubmit={submit}>
          <label>Event type
            <select value={form.event_type} onChange={e=>setForm({...form,event_type:e.target.value})}>
              <option value="accident">Accident</option>
              <option value="breakdown">Vehicle breakdown</option>
              <option value="weather">Weather disruption</option>
            </select>
          </label>
          <label>Location
            <input required placeholder="Mumbai, Andheri..." value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
          </label>
          <label>Photo evidence
            <input required type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile}/>
          </label>
          {evidenceFile&&<div className="info-row"><CloudUpload size={18}/><span>{evidenceFile.name} · {(evidenceFile.size/1024/1024).toFixed(2)} MB</span></div>}
          {evidence&&<div className="info-row"><CheckCircle2 size={18}/><span>Uploaded to Cloudinary · {evidence.quality === 'good' ? 'Quality good' : 'Needs review'}</span></div>}
          <button className="primary-btn submit" disabled={busy}>{busy?'Uploading & verifying...':'Submit & verify'} <ArrowRight size={17}/></button>
        </form>
        {result?.error&&<div className="alert error">{result.error}</div>}
      </div>

      <div className="panel">
        <div className="eyebrow">VERIFICATION TIMELINE</div>
        <h2>Claim state</h2>
        {!result?<div className="empty-state"><Clock3/><p>Submit a claim to see evidence quality, ML verification and settlement state.</p></div>:result.error?null:<div className="timeline">
          {evidence&&<div className="timeline-item"><div className="timeline-dot"><CloudUpload/></div><div><b>Evidence stored</b><span>Cloudinary upload completed · {evidence.width}×{evidence.height}px · {evidence.quality}</span></div></div>}
          <div className="timeline-item"><div className="timeline-dot"><BrainCircuit/></div><div><b>AI claim screening</b><span>Fraud probability: {((result.ml?.fraud_probability||0)*100).toFixed(1)}% · {result.ml?.decision||'—'}</span></div></div>
          <div className="timeline-item"><div className="timeline-dot"><CheckCircle2/></div><div><b>Backend claim record</b><span>{result.claim?.claim_id?`Claim #${result.claim.claim_id}`:'Claim record pending'} · {result.claim?.verification_status||'pending'}</span></div></div>
          {result.ml?.decision==='VALID'&&<div className="tx-box"><BadgeCheck size={16}/> Claim is eligible for the blockchain verification step.</div>}
          {evidence?.cloudinary_url&&<a className="secondary-btn" href={evidence.cloudinary_url} target="_blank" rel="noreferrer">View uploaded evidence <ArrowUpRight size={16}/></a>}
        </div>}
      </div>
    </div>
  </Shell>;
}

function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/login" element={<AuthPage mode="login"/>}/>
    <Route path="/signup" element={<AuthPage mode="signup"/>}/>
    <Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/>
    <Route path="/claims" element={<Protected><Claims/></Protected>}/>
    <Route path="/wallet" element={<Protected><WalletPayments Shell={Shell}/></Protected>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></BrowserRouter>;
}

export default App;