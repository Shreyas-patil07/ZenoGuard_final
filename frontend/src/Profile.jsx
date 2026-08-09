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
  unverified: ['Not verified', 'Upload your mandatory driving licence and submit it for verification.'],
  under_review: ['Under review', 'Your driving licence passed automated checks and is awaiting final review.'],
  verified: ['Verified', 'Your identity has been approved. Policy purchase is enabled.'],
  rejected: ['Rejected', 'Fix the requested details and submit your driving licence again.'],
};

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

  const uploadDrivingLicence = async (file) => {
    if (!file) return;
    setBusy('driving_license'); setMessage(''); setError(''); setSubmitResult(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('document_type', 'driving_license');
      const { data } = await api.post('/upload/kyc-document', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessage(`${data.message} AI verification will run only after Submit for verification.`);
      await load(false);
    } catch (e) {
      setError(apiError(e, 'Unable to save driving licence.'));
    } finally { setBusy(''); }
  };

  const submit = async () => {
    setBusy('submit'); setMessage(''); setError(''); setSubmitResult(null);
    try {
      const { data } = await api.post('/kyc/submit');
      setProfile(data.profile);
      setSubmitResult(data);
      setMessage(data.message || 'Driving licence verification completed.');
    } catch (e) {
      const detail = e.response?.data?.detail;
      setSubmitResult(typeof detail === 'object' ? detail : null);
      setError(apiError(e, 'Driving licence verification failed.'));
    } finally { setBusy(''); }
  };

  const status = (profile?.kyc_status || 'unverified').toLowerCase();
  const [statusTitle, statusDescription] = statusCopy[status] || statusCopy.unverified;
  const locked = status === 'verified' || status === 'under_review';
  const hasDL = Boolean(profile?.id_document_url || profile?.documents?.driving_license?.uploaded);
  const complete = Boolean(profile?.phone && profile?.address && profile?.city && hasDL && profile?.driving_license_number_masked);

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
        <div className="metric-label"><FileCheck2 size={17}/> DOCUMENT</div>
        <h3>{hasDL ? '1 / 1' : '0 / 1'}</h3>
        <span>Driving licence · Mandatory</span>
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
          <label>Date of birth <span className="muted">(cross-checked from licence)</span><input type="date" disabled value={profile?.date_of_birth || ''} /></label>
          <label>Phone number<input required disabled={locked} value={form.phone} placeholder="9876543210" onChange={e=>setForm({...form,phone:e.target.value})}/></label>
          <label>Address<textarea required disabled={locked} value={form.address} placeholder="House, street, area" onChange={e=>setForm({...form,address:e.target.value})}/></label>
          <label>City<input required disabled={locked} value={form.city} placeholder="City" onChange={e=>setForm({...form,city:e.target.value})}/></label>
          <p className="muted">Your account name, entered driving licence number and date of birth are cross-checked against the uploaded driving licence. Document numbers are masked after verification.</p>
          {!locked && <button className="primary-btn submit" disabled={busy === 'save'}>{busy === 'save' ? 'Saving...' : 'Save profile credentials'}</button>}
        </form>
      </div>

      <div className="panel">
        <div className="eyebrow">IDENTITY EVIDENCE</div>
        <h2>Driving Licence</h2>
        <p className="muted"><strong>Mandatory.</strong> Upload your driving licence. Saving the file only stores the document; AI verification runs only after you press <strong>Submit for verification</strong>.</p>

        <div className="panel" style={{marginTop:'1rem'}}>
          <div className="timeline-item"><div className="timeline-dot"><FileCheck2/></div><div style={{flex:1}}><b>Driving Licence · Mandatory</b><span>{hasDL ? `Saved · ${profile?.documents?.driving_license?.number_masked || profile?.driving_license_number_masked || 'number pending verification'}` : 'Not uploaded'}</span></div></div>
          {!locked && <label className="secondary-btn" style={{display:'inline-flex', cursor:'pointer'}}><Upload size={16}/>{busy === 'driving_license' ? 'Saving...' : hasDL ? 'Replace Driving Licence' : 'Upload Driving Licence'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy !== ''} onChange={e=>uploadDrivingLicence(e.target.files?.[0])}/></label>}
        </div>

        {submitResult && <div className="panel" style={{marginTop:'1rem'}}>
          <div className="metric-label">DRIVING LICENCE VERIFICATION</div>
          {submitResult.driving_license && <>
            <div className="info-row"><CheckCircle2 size={18}/><span>Status: {submitResult.driving_license.status}</span></div>
            <div className="info-row"><CheckCircle2 size={18}/><span>DL number match: {String(submitResult.driving_license.dl_number_match)}</span></div>
            <div className="info-row"><CheckCircle2 size={18}/><span>Name match: {String(submitResult.driving_license.name_match)}</span></div>
          </>}
          {submitResult.message && <p className="muted" style={{marginTop:'0.5rem'}}>{submitResult.message}</p>}
        </div>}

        <div className="panel" style={{marginTop:'1rem'}}>
          <div className="metric-label"><Clock3 size={17}/> VERIFICATION</div>
          <p className="muted">{status === 'verified' ? 'Your driving licence is verified and policy purchase is enabled.' : status === 'under_review' ? 'Your driving licence is under review. Policy purchase remains locked.' : 'On Submit, the driving licence detector and OCR run, then the extracted credentials are cross-checked with your profile.'}</p>
          {status !== 'verified' && status !== 'under_review' && <button className="primary-btn submit" disabled={!complete || busy !== ''} onClick={submit}>{busy === 'submit' ? 'Verifying Driving Licence...' : 'Submit for verification'}</button>}
          {!complete && status !== 'verified' && status !== 'under_review' && <p className="muted" style={{marginTop:'0.5rem'}}>Required: saved Driving Licence + DL number + phone + address + city.</p>}
        </div>
      </div>
    </div>
  </Shell>;
}
