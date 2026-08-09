import React, { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, Clock3, FileCheck2, ShieldCheck, Upload, UserRound } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const api = axios.create({ baseURL: API_URL, timeout: 300000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const initialForm = { phone: '', driving_license_number: '', date_of_birth: '', address: '', city: '' };
const statusCopy = {
  unverified: ['Not verified', 'Upload your mandatory driving licence and at least one additional government ID.'],
  under_review: ['Under review', 'Your submitted credentials passed automated checks and are awaiting final review.'],
  verified: ['Verified', 'Your identity has been approved. Policy purchase is enabled.'],
  rejected: ['Rejected', 'Fix the requested details and submit your documents again.'],
};

const DOCS = [
  { type: 'driving_license', label: 'Driving Licence', mandatory: true },
  { type: 'aadhaar', label: 'Aadhaar Card', mandatory: false },
  { type: 'pan', label: 'PAN Card', mandatory: false },
];

function apiError(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail?.message) return detail.message;
  if (error?.code === 'ECONNABORTED') return 'Document verification is taking longer than expected. Check the verification status before submitting again.';
  if (!error?.response) return 'The verification server could not be reached. Please try again.';
  return fallback;
}

export default function Profile({ Shell }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitResult, setSubmitResult] = useState(null);

  const load = async (showError = true) => {
    try {
      const { data } = await api.get('/kyc/profile');
      setProfile(data);
      setForm({ phone: data.phone || '', driving_license_number: '', date_of_birth: data.date_of_birth || '', address: data.address || '', city: data.city || '' });
      return data;
    } catch (e) {
      if (showError) setError(apiError(e, 'Unable to load your profile.'));
      throw e;
    }
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy('save'); setMessage(''); setError('');
    try {
      const { data } = await api.put('/kyc/profile', form);
      setProfile(data.profile);
      setMessage(data.message);
      setForm((prev) => ({ ...prev, driving_license_number: '' }));
    } catch (e) {
      setError(apiError(e, 'Unable to save profile.'));
    } finally { setBusy(''); }
  };

  const uploadDocument = async (file, documentType) => {
    if (!file) return;
    setBusy(documentType); setMessage(''); setError(''); setSubmitResult(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('document_type', documentType);
      const { data } = await api.post('/upload/kyc-document', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessage(`${data.message} AI verification will run only after Submit for verification.`);
      await load(false);
    } catch (e) {
      setError(apiError(e, `Unable to save ${documentType.replace('_', ' ')}.`));
    } finally { setBusy(''); }
  };

  const submit = async () => {
    setBusy('submit'); setMessage(''); setError(''); setSubmitResult(null);
    try {
      const { data } = await api.post('/kyc/submit');
      setProfile(data.profile);
      setSubmitResult(data);
      setMessage(data.message || 'KYC verification completed.');
      // Do not immediately call /kyc/profile again. The submit response is authoritative,
      // and an extra request can hide a successful verification behind a transient load error.
    } catch (e) {
      const detail = e.response?.data?.detail;
      setSubmitResult(typeof detail === 'object' ? detail : null);
      setError(apiError(e, 'Cross-verification failed.'));
      // Do NOT call load() here. A failed/slow submit must not overwrite the real
      // verification error with "Unable to load your profile".
    } finally { setBusy(''); }
  };

  const status = (profile?.kyc_status || 'unverified').toLowerCase();
  const [statusTitle, statusDescription] = statusCopy[status] || statusCopy.unverified;
  const locked = status === 'verified' || status === 'under_review';
  const docs = profile?.documents || {};
  const hasDL = Boolean(docs.driving_license?.uploaded || profile?.id_document_url);
  const hasAadhaar = Boolean(docs.aadhaar?.uploaded);
  const hasPan = Boolean(docs.pan?.uploaded);
  const hasAdditional = hasAadhaar || hasPan;
  const complete = Boolean(profile?.phone && profile?.address && profile?.city && hasDL && hasAdditional && profile?.driving_license_number_masked);

  return <Shell title="Profile & identity">
    <div className="dashboard-grid">
      <div className="metric-card featured">
        <div className="metric-label"><ShieldCheck size={17}/> IDENTITY STATUS</div>
        <strong>{statusTitle}</strong>
        <span>{statusDescription}</span>
        <div className="metric-bottom"><span>{profile?.email || '—'}</span><BadgeCheck size={16}/></div>
      </div>
      <div className="metric-card">
        <div className="metric-label"><UserRound size={17}/> PROFILE</div>
        <h3>{profile?.name || '—'}</h3>
        <span>{profile?.city || 'City not added'} · {profile?.phone || 'Phone not added'}</span>
      </div>
      <div className="metric-card">
        <div className="metric-label"><FileCheck2 size={17}/> DOCUMENTS</div>
        <h3>{Number(hasDL) + Number(hasAadhaar) + Number(hasPan)} / 3</h3>
        <span>DL mandatory · Aadhaar/PAN optional</span>
      </div>
    </div>

    {(message || error) && <div className={error ? 'alert error' : 'notice'}>{error || message}</div>}

    <div className="split-grid">
      <div className="panel">
        <div className="eyebrow">PERSONAL DETAILS</div>
        <h2>Credentials used for cross-verification</h2>
        <form className="form-stack" onSubmit={save}>
          <label>Full name<input value={profile?.name || ''} disabled /></label>
          <label>Email<input value={profile?.email || ''} disabled /></label>
          <label>Driving licence number <span className="muted">(mandatory)</span>
            <input required disabled={locked} value={form.driving_license_number} placeholder={profile?.driving_license_number_masked || 'Enter DL number'} onChange={e=>setForm({...form,driving_license_number:e.target.value.toUpperCase()})}/>
          </label>
          <label>Date of birth <span className="muted">(cross-checked from documents)</span><input type="date" disabled value={profile?.date_of_birth || ''} /></label>
          <label>Phone number<input required disabled={locked} value={form.phone} placeholder="9876543210" onChange={e=>setForm({...form,phone:e.target.value})}/></label>
          <label>Address<textarea required disabled={locked} value={form.address} placeholder="House, street, area" onChange={e=>setForm({...form,address:e.target.value})}/></label>
          <label>City<input required disabled={locked} value={form.city} placeholder="City" onChange={e=>setForm({...form,city:e.target.value})}/></label>
          <p className="muted">The account name is matched against every uploaded identity document. The entered driving licence number is compared with the number extracted from the licence. Document numbers are masked after verification.</p>
          {!locked && <button className="primary-btn submit" disabled={busy === 'save'}>{busy === 'save' ? 'Saving...' : 'Save profile credentials'}</button>}
        </form>
      </div>

      <div className="panel">
        <div className="eyebrow">IDENTITY EVIDENCE</div>
        <h2>Choose documents to upload</h2>
        <p className="muted"><strong>Upload only.</strong> Choose any document independently. Driving licence is mandatory; Aadhaar and PAN are optional, so the user can upload one or both. Saving a document does not trigger AI.</p>

        <div className="timeline">
          {DOCS.map((doc) => {
            const uploaded = doc.type === 'driving_license' ? hasDL : doc.type === 'aadhaar' ? hasAadhaar : hasPan;
            const stored = docs[doc.type];
            return <div key={doc.type} className="panel" style={{marginBottom:'0.75rem'}}>
              <div className="timeline-item"><div className="timeline-dot"><FileCheck2/></div><div style={{flex:1}}><b>{doc.label} {doc.mandatory ? '· Mandatory' : '· Optional'}</b><span>{uploaded ? `Saved · ${stored?.number_masked || (doc.type === 'driving_license' ? profile?.driving_license_number_masked : 'number pending verification')}` : 'Not uploaded'}</span></div></div>
              {!locked && <label className="secondary-btn" style={{display:'inline-flex', cursor:'pointer'}}><Upload size={16}/>{busy === doc.type ? 'Saving...' : uploaded ? `Replace ${doc.label}` : `Upload ${doc.label}`}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy !== ''} onChange={e=>uploadDocument(e.target.files?.[0], doc.type)}/></label>}
            </div>;
          })}
        </div>

        {submitResult && <div className="panel" style={{marginTop:'1rem'}}>
          <div className="metric-label">CROSS-VERIFICATION RESULT</div>
          {submitResult.driving_license && <div className="info-row"><CheckCircle2 size={18}/><span>Driving licence: {submitResult.driving_license.status} · number match: {String(submitResult.driving_license.dl_number_match)}</span></div>}
          {(submitResult.documents || []).map((doc, i) => <div className="info-row" key={i}><CheckCircle2 size={18}/><span>{doc.document_type}: {doc.status} · name match: {String(doc.name_match)}</span></div>)}
          {submitResult.message && <p className="muted" style={{marginTop:'0.5rem'}}>{submitResult.message}</p>}
        </div>}

        <div className="panel" style={{marginTop:'1rem'}}>
          <div className="metric-label"><Clock3 size={17}/> VERIFICATION</div>
          <p className="muted">{status === 'verified' ? 'Your identity is verified and policy purchase is enabled.' : status === 'under_review' ? 'Your submission is under review. Policy purchase remains locked.' : 'On Submit, every uploaded document is run through its detector and OCR, then credentials are cross-checked before KYC can proceed.'}</p>
          {status !== 'verified' && status !== 'under_review' && <button className="primary-btn submit" disabled={!complete || busy !== ''} onClick={submit}>{busy === 'submit' ? 'Cross-verifying documents...' : 'Submit for verification'}</button>}
          {!complete && status !== 'verified' && status !== 'under_review' && <p className="muted" style={{marginTop:'0.5rem'}}>Required: saved DL + DL number + at least one of Aadhaar/PAN.</p>}
        </div>
      </div>
    </div>
  </Shell>;
}
