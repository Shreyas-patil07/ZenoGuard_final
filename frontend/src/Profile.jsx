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

const initialForm = {
  phone: '', date_of_birth: '', address: '', city: '', id_type: 'driving_license', id_number: '',
  secondary_id_type: 'aadhaar', secondary_id_number: '',
};
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
  const [secondaryFile, setSecondaryFile] = useState(null);
  const [verification, setVerification] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/kyc/profile');
      setProfile(data);
      setForm({
        phone: data.phone || '', date_of_birth: data.date_of_birth || '', address: data.address || '', city: data.city || '',
        id_type: 'driving_license', id_number: '', secondary_id_type: data.secondary_id_type || 'aadhaar', secondary_id_number: '',
      });
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
      setForm((current) => ({ ...current, id_number: '', secondary_id_number: '' }));
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
      if (label === 'driving') {
        setVerification(data.verification || null);
        if (!data.uploaded) {
          setError(data.message || 'Driving licence requires review.');
          return data;
        }
        setMessage(data.message || 'Driving licence passed the automated checks.');
        await load();
        setForm((current) => ({ ...current, id_number: data.verification?.fields?.dl_number || current.id_number, date_of_birth: data.verification?.fields?.dob || current.date_of_birth }));
      } else {
        setMessage(`${label === 'aadhaar' ? 'Aadhaar' : 'PAN'} document uploaded.`);
        await load();
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
  const complete = Boolean(
    profile?.phone && profile?.date_of_birth && profile?.address && profile?.city &&
    profile?.id_number_masked && profile?.id_document_url && profile?.ai_document_status === 'verified' &&
    profile?.secondary_id_type && profile?.secondary_id_number_masked && profile?.secondary_id_document_url
  );

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
          <label>Date of birth<input required type="date" disabled={locked} value={form.date_of_birth} onChange={e=>setForm({...form,date_of_birth:e.target.value})}/></label>
          <label>Address<textarea required disabled={locked} value={form.address} placeholder="House, street, area" onChange={e=>setForm({...form,address:e.target.value})}/></label>
          <label>City<input required disabled={locked} value={form.city} placeholder="Dombivli" onChange={e=>setForm({...form,city:e.target.value})}/></label>
          <label>Driving licence number <span className="muted">(mandatory)</span><input required disabled={locked} value={form.id_number} placeholder="DL number" onChange={e=>setForm({...form,id_number:e.target.value})}/></label>
          <label>Additional identity <span className="muted">(choose one)</span>
            <select required disabled={locked} value={form.secondary_id_type} onChange={e=>setForm({...form,secondary_id_type:e.target.value,secondary_id_number:''})}>
              <option value="aadhaar">Aadhaar Card</option>
              <option value="pan">PAN Card</option>
            </select>
          </label>
          <label>{form.secondary_id_type === 'aadhaar' ? 'Aadhaar number' : 'PAN number'}<input required disabled={locked} value={form.secondary_id_number} placeholder={form.secondary_id_type === 'aadhaar' ? '12-digit Aadhaar number' : 'PAN number'} onChange={e=>setForm({...form,secondary_id_number:e.target.value})}/></label>
          {!locked && <button className="primary-btn submit" disabled={busy === 'save'}>{busy === 'save' ? 'Saving...' : 'Save profile'}</button>}
        </form>
      </div>

      <div className="panel">
        <div className="eyebrow">IDENTITY EVIDENCE</div>
        <h2>Required documents</h2>
        <p className="muted">Three verification requirements: <strong>Driving licence is mandatory</strong>, plus <strong>one</strong> additional government ID — Aadhaar or PAN. No selfie is required.</p>

        <div className="timeline">
          <div className="timeline-item"><div className="timeline-dot"><FileCheck2/></div><div><b>1. Driving licence · Mandatory</b><span>{profile?.id_document_url ? `Uploaded · ${profile.id_number_masked}` : 'Required before submission.'}</span></div></div>
          <label className="secondary-btn" style={{display: locked ? 'none' : 'inline-flex', cursor: 'pointer'}}><Upload size={16}/> {busy === 'driving' ? 'Verifying...' : 'Upload driving licence'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={locked || busy !== ''} onChange={e=>{setIdFile(e.target.files?.[0] || null); upload(e.target.files?.[0], '/upload/kyc-document', 'driving');}}/></label>
          {idFile && <div className="info-row"><CheckCircle2 size={18}/><span>{idFile.name}</span></div>}
          {verification && <div className={verification.status === 'verified' ? 'notice' : 'alert error'} style={{marginTop:'0.75rem'}}>
            <strong>{verification.status === 'verified' ? 'Driving licence AI checks passed' : 'Driving licence needs review'}</strong>
            <div style={{marginTop:'0.35rem'}}>Detection confidence: {Math.round((verification.detection_confidence || 0) * 100)}%</div>
            {verification.fields?.name && <div>Name: {verification.fields.name}</div>}
            {verification.fields?.dl_number && <div>DL number: {verification.fields.dl_number}</div>}
            {verification.fields?.dob && <div>DOB: {verification.fields.dob}</div>}
            {verification.notes?.length > 0 && <div>{verification.notes.join(' ')}</div>}
          </div>}

          <div className="timeline-item"><div className="timeline-dot"><FileCheck2/></div><div><b>2. Additional government ID · Choose one</b><span>{profile?.secondary_id_document_url ? `${profile.secondary_id_type === 'aadhaar' ? 'Aadhaar' : 'PAN'} uploaded · ${profile.secondary_id_number_masked}` : 'Choose Aadhaar or PAN.'}</span></div></div>
          <label className="secondary-btn" style={{display: locked ? 'none' : 'inline-flex', cursor: 'pointer'}}><Upload size={16}/> {busy === 'secondary' ? 'Uploading...' : `Upload ${form.secondary_id_type === 'aadhaar' ? 'Aadhaar' : 'PAN'}`}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={locked || busy !== ''} onChange={e=>{setSecondaryFile(e.target.files?.[0] || null); upload(e.target.files?.[0], '/upload/kyc-secondary', 'secondary');}}/></label>
          {secondaryFile && <div className="info-row"><CheckCircle2 size={18}/><span>{secondaryFile.name}</span></div>}
        </div>

        <div className="panel" style={{marginTop:'1rem'}}>
          <div className="metric-label"><Clock3 size={17}/> VERIFICATION</div>
          <p className="muted">{status === 'verified' ? 'Your identity is verified and policy purchase is enabled.' : status === 'under_review' ? 'Your submission is under review. Policy purchase remains locked.' : 'Upload the mandatory driving licence and either Aadhaar or PAN, then submit for review.'}</p>
          {status !== 'verified' && status !== 'under_review' && <button className="primary-btn submit" disabled={!complete || busy !== ''} onClick={submit}>{busy === 'submit' ? 'Submitting...' : 'Submit for verification'}</button>}
        </div>
      </div>
    </div>
  </Shell>;
}
