import React, { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, Clock3, FileCheck2, ShieldCheck, Upload, UserRound } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const api = axios.create({ baseURL: API_URL, timeout: 30000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const initialForm = { phone: '', date_of_birth: '', address: '', city: '', id_type: 'driving_license', id_number: '' };
const statusCopy = {
  unverified: ['Not verified', 'Complete your profile and submit identity documents.'],
  under_review: ['Under review', 'Your identity submission is waiting for verification.'],
  verified: ['Verified', 'Your identity has been approved. Policy purchase is enabled.'],
  rejected: ['Rejected', 'Update the requested details and submit again.'],
};

export default function Profile({ Shell }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [idFile, setIdFile] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);
  const [verification, setVerification] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/kyc/profile');
      setProfile(data);
      setForm({ phone: data.phone || '', date_of_birth: data.date_of_birth || '', address: data.address || '', city: data.city || '', id_type: data.id_type || 'driving_license', id_number: '' });
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
      setForm((current) => ({ ...current, id_number: '' }));
      setMessage('Profile details saved.');
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
      if (label === 'id') {
        setVerification(data.verification || null);
        if (!data.uploaded) {
          setError(data.message || 'Document requires review.');
          return data;
        }
        setMessage(data.message || 'Identity document passed the automated checks.');
      } else {
        setMessage('Selfie uploaded.');
      }
      await load();
      if (label === 'id' && data.uploaded) {
        setForm((current) => ({ ...current, id_number: data.verification?.fields?.dl_number || current.id_number, date_of_birth: data.verification?.fields?.dob || current.date_of_birth }));
      }
      return data;
    } catch (e) {
      setError(e.response?.data?.detail || `Unable to upload ${label}.`);
    } finally { setBusy(''); }
  };

  const submit = async () => {
    setBusy('submit'); setMessage(''); setError('');
    try {
      const { data } = await api.post('/kyc/submit');
      setProfile(data.profile);
      setMessage(data.message);
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to submit identity verification.');
    } finally { setBusy(''); }
  };

  const status = (profile?.kyc_status || 'unverified').toLowerCase();
  const [statusTitle, statusDescription] = statusCopy[status] || statusCopy.unverified;
  const locked = status === 'verified' || status === 'under_review';
  const complete = Boolean(profile?.phone && profile?.date_of_birth && profile?.address && profile?.city && profile?.id_type && profile?.id_number_masked && profile?.id_document_url && profile?.selfie_url && profile?.ai_document_status === 'verified');

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
        <h3>{profile?.id_document_url && profile?.selfie_url ? '2 / 2' : '0 / 2'}</h3>
        <span>Identity document + selfie</span>
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
          <label>Date of birth<input required type="date" disabled={locked} value={form.date_of_birth} onChange={e=>setForm({...form,date_of_birth:e.target.value})}/></label>
          <label>Address<textarea required disabled={locked} value={form.address} placeholder="House, street, area" onChange={e=>setForm({...form,address:e.target.value})}/></label>
          <label>City<input required disabled={locked} value={form.city} placeholder="Dombivli" onChange={e=>setForm({...form,city:e.target.value})}/></label>
          <label>Identity document type<select required disabled={locked} value={form.id_type} onChange={e=>setForm({...form,id_type:e.target.value})}><option value="driving_license">Driving licence</option><option value="pan">PAN card</option><option value="passport">Passport</option><option value="voter_id">Voter ID</option></select></label>
          <label>Identity document number<input required disabled={locked} value={form.id_number} placeholder="Enter document number" onChange={e=>setForm({...form,id_number:e.target.value})}/></label>
          {!locked && <button className="primary-btn submit" disabled={busy === 'save'}>{busy === 'save' ? 'Saving...' : 'Save profile'}</button>}
        </form>
      </div>

      <div className="panel">
        <div className="eyebrow">IDENTITY EVIDENCE</div>
        <h2>Upload verification documents</h2>
        <p className="muted">Driving-licence uploads are checked by the Roboflow detector and OCR on the backend. The AI check validates detected fields and format; it does not by itself prove government authenticity.</p>

        <div className="timeline">
          <div className="timeline-item"><div className="timeline-dot"><FileCheck2/></div><div><b>Identity document</b><span>{profile?.id_document_url ? `Uploaded · ${profile.id_number_masked}` : 'Required before submission.'}</span></div></div>
          <label className="secondary-btn" style={{display: locked ? 'none' : 'inline-flex', cursor: 'pointer'}}><Upload size={16}/> {busy === 'id' ? 'Verifying...' : 'Choose ID document'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={locked || busy !== ''} onChange={e=>{setIdFile(e.target.files?.[0] || null); upload(e.target.files?.[0], '/upload/kyc-document', 'id');}}/></label>
          {idFile && <div className="info-row"><CheckCircle2 size={18}/><span>{idFile.name}</span></div>}
          {verification && <div className={verification.status === 'verified' ? 'notice' : 'alert error'} style={{marginTop:'0.75rem'}}>
            <strong>{verification.status === 'verified' ? 'Document AI checks passed' : 'Document needs review'}</strong>
            <div style={{marginTop:'0.35rem'}}>Detection confidence: {Math.round((verification.detection_confidence || 0) * 100)}%</div>
            {verification.fields?.name && <div>Name: {verification.fields.name}</div>}
            {verification.fields?.dl_number && <div>DL number: {verification.fields.dl_number}</div>}
            {verification.fields?.dob && <div>DOB: {verification.fields.dob}</div>}
            {verification.notes?.length > 0 && <div>{verification.notes.join(' ')}</div>}
          </div>}

          <div className="timeline-item"><div className="timeline-dot"><UserRound/></div><div><b>Selfie</b><span>{profile?.selfie_url ? 'Uploaded' : 'Required before submission.'}</span></div></div>
          <label className="secondary-btn" style={{display: locked ? 'none' : 'inline-flex', cursor: 'pointer'}}><Upload size={16}/> {busy === 'selfie' ? 'Uploading...' : 'Choose selfie'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={locked || busy !== ''} onChange={e=>{setSelfieFile(e.target.files?.[0] || null); upload(e.target.files?.[0], '/upload/kyc-selfie', 'selfie');}}/></label>
          {selfieFile && <div className="info-row"><CheckCircle2 size={18}/><span>{selfieFile.name}</span></div>}
        </div>

        <div className="panel" style={{marginTop:'1rem'}}>
          <div className="metric-label"><Clock3 size={17}/> VERIFICATION</div>
          <p className="muted">{status === 'verified' ? 'Your identity is verified and policy purchase is enabled.' : status === 'under_review' ? 'Your submission is under review. Policy purchase remains locked.' : 'The document must first pass the automated driving-licence checks. Your final KYC status remains subject to the review workflow.'}</p>
          {status !== 'verified' && status !== 'under_review' && <button className="primary-btn submit" disabled={!complete || busy !== ''} onClick={submit}>{busy === 'submit' ? 'Submitting...' : 'Submit for verification'}</button>}
        </div>
      </div>
    </div>
  </Shell>;
}
