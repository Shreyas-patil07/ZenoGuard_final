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
  unverified: ['Not verified', 'Upload your driving licence and submit it for automated DL verification.'],
  under_review: ['Under review', 'Your driving licence passed automated checks and is awaiting final review.'],
  verified: ['Verified', 'Your driving licence has been approved. Policy purchase is enabled.'],
  rejected: ['Rejected', 'Correct the requested details and submit your driving licence again.'],
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
      setForm({
        phone: data.phone || '',
        driving_license_number: '',
        date_of_birth: data.date_of_birth || '',
        address: data.address || '',
        city: data.city || '',
      });
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
      setMessage(`${data.message} The DL detector will run only after you press Submit for verification.`);
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
  const dlAIStatus = profile?.documents?.driving_license?.ai_status || profile?.ai_document_status || 'pending';
  const dlConfidence = profile?.documents?.driving_license?.ai_confidence ?? profile?.ai_document_confidence;

  return <Shell title="Driving Licence Verification">
    <div className="dashboard-grid">
      <div className="metric-card featured">
        <div className="metric-label"><ShieldCheck size={17}/> DL VERIFICATION STATUS</div>
        <strong>{statusTitle}</strong>
        <span>{statusDescription}</span>
        <div className="metric-bottom"><span>{profile?.email || '—'}</span><BadgeCheck size={16}/></div>
      </div>
      <div className="metric-card">
        <div className="metric-label"><FileCheck2 size={17}/> REQUIRED DOCUMENT</div>
        <h3>{hasDL ? '1 / 1' : '0 / 1'}</h3>
        <span>Driving licence only · Mandatory</span>
      </div>
      <div className="metric-card">
        <div className="metric-label"><ShieldCheck size={17}/> DL DETECTOR</div>
        <h3>{dlAIStatus.toUpperCase()}</h3>
        <span>{dlConfidence != null ? `Detection confidence ${(Number(dlConfidence) * 100).toFixed(1)}%` : 'Runs during verification'}</span>
      </div>
    </div>

    {(message || error) && <div className={error ? 'alert error' : 'notice'}>{error || message}</div>}

    <div className="split-grid">
      <div className="panel">
        <div className="eyebrow">PROFILE CREDENTIALS</div>
        <h2>Details cross-checked against your DL</h2>
        <form className="form-stack" onSubmit={save}>
          <label>Full name<input value={profile?.name || ''} disabled /></label>
          <label>Email<input value={profile?.email || ''} disabled /></label>
          <label>Driving licence number <span className="muted">(mandatory)</span>
            <input required disabled={locked} value={form.driving_license_number} placeholder={profile?.driving_license_number_masked || 'Enter DL number'} onChange={e=>setForm({...form,driving_license_number:e.target.value.toUpperCase()})}/>
          </label>
          <label>Date of birth <span className="muted">(cross-checked from DL)</span><input type="date" disabled value={profile?.date_of_birth || ''} /></label>
          <label>Phone number<input required disabled={locked} value={form.phone} placeholder="9876543210" onChange={e=>setForm({...form,phone:e.target.value})}/></label>
          <label>Address<textarea required disabled={locked} value={form.address} placeholder="House, street, area" onChange={e=>setForm({...form,address:e.target.value})}/></label>
          <label>City<input required disabled={locked} value={form.city} placeholder="City" onChange={e=>setForm({...form,city:e.target.value})}/></label>
          <p className="muted">ZenoGuard verifies one identity document: your Driving Licence. The account name, entered DL number and DOB are cross-checked against the uploaded DL.</p>
          {!locked && <button className="primary-btn submit" disabled={busy === 'save'}>{busy === 'save' ? 'Saving...' : 'Save profile credentials'}</button>}
        </form>
      </div>

      <div className="panel">
        <div className="eyebrow">IDENTITY EVIDENCE · DL ONLY</div>
        <h2>Driving Licence</h2>
        <p className="muted"><strong>Mandatory and only required document.</strong> Upload your driving licence. Saving the file only stores it; the <strong>dl_detector</strong> model and OCR run only after you press <strong>Submit for verification</strong>.</p>

        <div className="panel" style={{marginTop:'1rem'}}>
          <div className="timeline-item"><div className="timeline-dot"><FileCheck2/></div><div style={{flex:1}}><b>Driving Licence · Mandatory</b><span>{hasDL ? `Saved · ${profile?.documents?.driving_license?.number_masked || profile?.driving_license_number_masked || 'number pending verification'}` : 'Not uploaded'}</span></div></div>
          {!locked && <label className="secondary-btn" style={{display:'inline-flex', cursor:'pointer'}}><Upload size={16}/>{busy === 'driving_license' ? 'Saving...' : hasDL ? 'Replace Driving Licence' : 'Upload Driving Licence'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy !== ''} onChange={e=>uploadDrivingLicence(e.target.files?.[0])}/></label>}
        </div>

        {submitResult && <div className="panel" style={{marginTop:'1rem'}}>
          <div className="metric-label">DL AI VERIFICATION</div>
          {submitResult.driving_license && <>
            <div className="info-row"><CheckCircle2 size={18}/><span>Status: {submitResult.driving_license.status}</span></div>
            <div className="info-row"><CheckCircle2 size={18}/><span>DL number match: {String(submitResult.driving_license.dl_number_match)}</span></div>
            <div className="info-row"><CheckCircle2 size={18}/><span>Name match: {String(submitResult.driving_license.name_match)}</span></div>
            <div className="info-row"><CheckCircle2 size={18}/><span>DOB match: {String(submitResult.driving_license.dob_match)}</span></div>
          </>}
          {submitResult.message && <p className="muted" style={{marginTop:'0.5rem'}}>{submitResult.message}</p>}
        </div>}

        <div className="panel" style={{marginTop:'1rem'}}>
          <div className="metric-label"><Clock3 size={17}/> VERIFICATION PIPELINE</div>
          <p className="muted">Upload → save → <strong>dl_detector</strong> detection → OCR → DL number/name/DOB cross-check → verification review.</p>
          {status !== 'verified' && status !== 'under_review' && <button className="primary-btn submit" disabled={!complete || busy !== ''} onClick={submit}>{busy === 'submit' ? 'Verifying Driving Licence...' : 'Submit for verification'}</button>}
          {!complete && status !== 'verified' && status !== 'under_review' && <p className="muted" style={{marginTop:'0.5rem'}}>Required: saved Driving Licence + DL number + phone + address + city.</p>}
        </div>
      </div>
    </div>
  </Shell>;
}
