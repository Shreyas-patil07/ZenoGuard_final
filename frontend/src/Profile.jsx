import React, { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, Clock3, FileCheck2, ShieldCheck, Upload, UserRound } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const api = axios.create({ baseURL: API_URL, timeout: 60000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const initialForm = { phone: '', date_of_birth: '', address: '', city: '', secondary_id_type: 'aadhaar' };
const statusCopy = {
  unverified: ['Not verified', 'Upload the two required identity documents and submit them for verification.'],
  under_review: ['Under review', 'Your identity submission is waiting for final verification.'],
  verified: ['Verified', 'Your identity has been approved. Policy purchase is enabled.'],
  rejected: ['Rejected', 'Fix the requested details and submit your documents again.'],
};

export default function Profile({ Shell }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [idFile, setIdFile] = useState(null);
  const [secondaryFile, setSecondaryFile] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitResult, setSubmitResult] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get('/kyc/profile');
      setProfile(data);
      setForm({ phone: data.phone || '', date_of_birth: data.date_of_birth || '', address: data.address || '', city: data.city || '', secondary_id_type: data.secondary_id_type || 'aadhaar' });
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to load your profile.');
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy('save'); setMessage(''); setError('');
    try {
      const { data } = await api.put('/kyc/profile', form);
      setProfile(data.profile);
      setMessage(data.message);
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to save profile.');
    } finally { setBusy(''); }
  };

  const upload = async (file, endpoint, label) => {
    if (!file) return;
    setBusy(label); setMessage(''); setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post(endpoint, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessage(data.message || 'Document saved.');
      if (label === 'driving') setIdFile(file);
      if (label === 'secondary') setSecondaryFile(file);
      await load();
      return data;
    } catch (e) {
      setError(e.response?.data?.detail || `Unable to upload ${label}.`);
    } finally { setBusy(''); }
  };

  const submit = async () => {
    setBusy('submit'); setMessage(''); setError(''); setSubmitResult(null);
    try {
      const { data } = await api.post('/kyc/submit');
      setProfile(data.profile);
      setSubmitResult(data);
      setMessage(data.message);
    } catch (e) {
      const detail = e.response?.data?.detail;
      setSubmitResult(typeof detail === 'object' ? detail : null);
      setError(typeof detail === 'string' ? detail : detail?.message || 'Document verification failed.');
      await load();
    } finally { setBusy(''); }
  };

  const status = (profile?.kyc_status || 'unverified').toLowerCase();
  const [statusTitle, statusDescription] = statusCopy[status] || statusCopy.unverified;
  const locked = status === 'verified' || status === 'under_review';
  const complete = Boolean(profile?.phone && profile?.address && profile?.city && profile?.id_document_url && profile?.secondary_id_type && profile?.secondary_id_document_url);

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
        <h3>{profile?.id_document_url && profile?.secondary_id_document_url ? '2 / 2' : '0 / 2'}</h3>
        <span>Driving licence + Aadhaar/PAN</span>
      </div>
    </div>

    {(message || error) && <div className={error ? 'alert error' : 'notice'}>{error || message}</div>}

    <div className="split-grid">
      <div className="panel">
        <div className="eyebrow">PERSONAL DETAILS</div>
        <h2>Build your verified profile</h2>
        <form className="form-stack" onSubmit={save}>
          <label>Full name<input value={profile?.name || ''} disabled /></label>
          <label>Email<input value={profile?.email || ''} disabled /></label>
          <label>Phone number<input required disabled={locked} value={form.phone} placeholder="9876543210" onChange={e=>setForm({...form,phone:e.target.value})}/></label>
          <label>Date of birth<input type="date" disabled value={profile?.date_of_birth || ''} placeholder="Extracted from driving licence" /></label>
          <label>Address<textarea required disabled={locked} value={form.address} placeholder="House, street, area" onChange={e=>setForm({...form,address:e.target.value})}/></label>
          <label>City<input required disabled={locked} value={form.city} placeholder="City" onChange={e=>setForm({...form,city:e.target.value})}/></label>
          <label>Additional identity <span className="muted">(choose one)</span>
            <select required disabled={locked || Boolean(profile?.secondary_id_document_url)} value={form.secondary_id_type} onChange={e=>setForm({...form,secondary_id_type:e.target.value})}>
              <option value="aadhaar">Aadhaar Card</option>
              <option value="pan">PAN Card</option>
            </select>
          </label>
          <p className="muted">Document numbers are never entered manually. They are extracted from the uploaded documents during submission.</p>
          {!locked && <button className="primary-btn submit" disabled={busy === 'save'}>{busy === 'save' ? 'Saving...' : 'Save profile'}</button>}
        </form>
      </div>

      <div className="panel">
        <div className="eyebrow">IDENTITY EVIDENCE</div>
        <h2>Upload required documents</h2>
        <p className="muted"><strong>Upload only.</strong> Uploading saves the document to the database/storage. Roboflow + OCR + validation are triggered only after you press <strong>Submit for verification</strong>.</p>

        <div className="timeline">
          <div className="timeline-item"><div className="timeline-dot"><FileCheck2/></div><div><b>1. Driving licence · Mandatory</b><span>{profile?.id_document_url ? `Saved · ${profile.id_number_masked}` : 'Not uploaded'}</span></div></div>
          <label className="secondary-btn" style={{display: locked ? 'none' : 'inline-flex', cursor: 'pointer'}}><Upload size={16}/> {busy === 'driving' ? 'Saving...' : 'Upload driving licence'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={locked || busy !== ''} onChange={e=>upload(e.target.files?.[0], '/upload/kyc-document', 'driving')}/></label>
          {idFile && <div className="info-row"><CheckCircle2 size={18}/><span>{idFile.name}</span></div>}

          <div className="timeline-item"><div className="timeline-dot"><FileCheck2/></div><div><b>2. Additional government ID · Choose one</b><span>{profile?.secondary_id_document_url ? `${profile.secondary_id_type === 'aadhaar' ? 'Aadhaar' : 'PAN'} saved · ${profile.secondary_id_number_masked}` : `Upload ${form.secondary_id_type === 'aadhaar' ? 'Aadhaar' : 'PAN'}`}</span></div></div>
          <label className="secondary-btn" style={{display: locked ? 'none' : 'inline-flex', cursor: 'pointer'}}><Upload size={16}/> {busy === 'secondary' ? 'Saving...' : `Upload ${form.secondary_id_type === 'aadhaar' ? 'Aadhaar' : 'PAN'}`}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={locked || busy !== '' || !form.secondary_id_type} onChange={e=>upload(e.target.files?.[0], '/upload/kyc-secondary', 'secondary')}/></label>
          {secondaryFile && <div className="info-row"><CheckCircle2 size={18}/><span>{secondaryFile.name}</span></div>}
        </div>

        {submitResult?.driving_license && <div className="panel" style={{marginTop:'1rem'}}><div className="metric-label">DRIVING LICENCE AI</div><p>{submitResult.driving_license.status === 'verified' ? 'AI checks passed.' : 'AI checks failed.'}</p>{submitResult.driving_license.notes?.map((n,i)=><div key={i}>{n}</div>)}</div>}
        {(submitResult?.aadhaar || submitResult?.pan) && <div className="panel" style={{marginTop:'1rem'}}><div className="metric-label">ADDITIONAL ID AI</div><p>{(submitResult.aadhaar || submitResult.pan).status === 'verified' ? 'AI checks passed.' : 'AI checks failed.'}</p>{(submitResult.aadhaar || submitResult.pan).notes?.map((n,i)=><div key={i}>{n}</div>)}</div>}

        <div className="panel" style={{marginTop:'1rem'}}>
          <div className="metric-label"><Clock3 size={17}/> VERIFICATION</div>
          <p className="muted">{status === 'verified' ? 'Your identity is verified and policy purchase is enabled.' : status === 'under_review' ? 'Your submission is under review. Policy purchase remains locked.' : 'Both documents must be saved before AI verification can run.'}</p>
          {status !== 'verified' && status !== 'under_review' && <button className="primary-btn submit" disabled={!complete || busy !== ''} onClick={submit}>{busy === 'submit' ? 'Verifying documents...' : 'Submit for verification'}</button>}
        </div>
      </div>
    </div>
  </Shell>;
}
