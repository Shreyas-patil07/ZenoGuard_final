import React, { useEffect, useMemo, useState } from 'react';
import logoNoBg from './assets/logo_no_bg.png';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileWarning,
  IndianRupee,
  LockKeyhole,
  LogOut,
  Menu,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
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

function Claims() {
  const [form,setForm]=useState({event_type:'accident',location:'',evidence_quality:'0.9'}); const [result,setResult]=useState(null); const [busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);setResult(null);try{const ml=await api.post('/ml/claim-check',{claim_type:form.event_type==='accident'?'Accident':'Weather',previous_claims:0,previous_fraud_flags:0,gps_consistency:.92,weather_match:form.event_type==='weather'?.9:.75,activity_consistency:.94,timestamp_consistency:.96,evidence_quality:Number(form.evidence_quality),claim_severity:.7,coverage_amount:5000});let claim=null;try{claim=(await api.post('/claims/submit',{event_type:form.event_type,location:form.location,screenshot_url:'frontend-demo'})).data}catch(err){claim={error:err.response?.data?.detail||'Claim record endpoint unavailable'}}setResult({ml:ml.data,claim})}catch(err){setResult({error:err.response?.data?.detail||'ML verification failed'})}finally{setBusy(false)}};
  return <Shell title="Claim center"><div className="split-grid"><div className="panel"><div className="eyebrow">CLAIM INPUT</div><h2>Tell us what happened</h2><form className="form-stack" onSubmit={submit}><label>Event type<select value={form.event_type} onChange={e=>setForm({...form,event_type:e.target.value})}><option value="accident">Accident</option><option value="weather">Weather disruption</option></select></label><label>Location<input required placeholder="Mumbai, Andheri..." value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>Evidence quality<select value={form.evidence_quality} onChange={e=>setForm({...form,evidence_quality:e.target.value})}><option value="0.95">Excellent</option><option value="0.9">Good</option><option value="0.65">Weak</option></select></label><button className="primary-btn submit" disabled={busy}>{busy?'Verifying...':'Submit & verify'} <ArrowRight size={17}/></button></form></div><div className="panel"><div className="eyebrow">VERIFICATION TIMELINE</div><h2>Claim state</h2>{!result?<div className="empty-state"><Clock3/><p>Submit a claim to see ML verification and settlement state.</p></div>:result.error?<div className="alert error">{result.error}</div>:<div className="timeline"><div className="timeline-item"><div className="timeline-dot"><BrainCircuit/></div><div><b>AI claim screening</b><span>Fraud probability: {(result.ml.fraud_probability*100).toFixed(1)}% · {result.ml.decision}</span></div></div><div className="timeline-item"><div className="timeline-dot"><CheckCircle2/></div><div><b>Backend claim record</b><span>{result.claim?.claim_id?`Claim #${result.claim.claim_id}`:'ML result received'} · {result.claim?.verification_status||'pending'}</span></div></div>{result.ml.decision==='VALID'&&<div className="tx-box"><BadgeCheck size={16}/> Claim is eligible for the blockchain verification step.</div>}</div>}</div></div></Shell>;
}

function Wallet() { const [connected,setConnected]=useState(false); return <Shell title="Payout wallet"><div className="content-narrow"><div className="panel wallet-panel"><div className="wallet-icon"><WalletCards/></div><h2>{connected?'Wallet connected':'Connect your wallet'}</h2><p className="muted">The wallet is the destination for automated testnet payouts after the claim contract approves settlement.</p>{connected?<div className="connected"><CheckCircle2/> 0xf39F...2266</div>:<button className="primary-btn submit" onClick={()=>setConnected(true)}>Connect demo wallet <ArrowRight size={17}/></button>}</div></div></Shell>; }

function SimplePage({title,label,children}) { return <Shell title={title}><div className="content-narrow"><div className="panel"><div className="eyebrow">{label}</div>{children}</div></div></Shell>; }

function App() { return <BrowserRouter><Routes><Route path="/" element={<Home/>}/><Route path="/login" element={<AuthPage mode="login"/>}/><Route path="/signup" element={<AuthPage mode="signup"/>}/><Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/><Route path="/claims" element={<Protected><Claims/></Protected>}/><Route path="/wallet" element={<Protected><Wallet/></Protected>}/><Route path="/kyc" element={<Protected><SimplePage title="Identity verification" label="KYC"><h2>Verify your identity</h2><p className="muted">Connect the production KYC provider here. The frontend node is ready without storing documents on-chain.</p><div className="info-row"><Shield size={20}/> Evidence remains off-chain.</div></SimplePage></Protected>}/><Route path="/company" element={<Protected><SimplePage title="Gig platform" label="WORK PROFILE"><h2>Choose your platform</h2><p className="muted">Uber · Ola · Zomato · Swiggy can feed the work profile used by the risk engine.</p><div className="platform-grid"><div className="platform-card selected"><Sparkles/><b>Gig profile ready</b><span>Connected to FastAPI</span></div></div></SimplePage></Protected>}/><Route path="/timeline" element={<Protected><SimplePage title="Claim timeline" label="SETTLEMENT"><div className="timeline"><TimelineStep icon={<CheckCircle2/>} title="Claim submitted" text="Evidence enters the backend."/><TimelineStep icon={<BrainCircuit/>} title="AI verification" text="Fraud probability and confidence are calculated."/><TimelineStep icon={<ShieldCheck/>} title="Smart contract" text="Authorized oracle records verification."/><TimelineStep icon={<WalletCards/>} title="Payout" text="InsurancePool releases testnet funds."/></div></SimplePage></Protected>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></BrowserRouter>; }
function TimelineStep({icon,title,text}) { return <div className="timeline-item"><div className="timeline-dot">{icon}</div><div><b>{title}</b><span>{text}</span></div></div>; }
export default App;
