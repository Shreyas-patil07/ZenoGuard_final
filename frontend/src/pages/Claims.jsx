import React, { useContext, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const api = axios.create({ baseURL: API_URL, timeout: 20000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const Claims = () => {
  const { user, authReady } = useContext(AuthContext);
  const [formData, setFormData] = useState({ event_type: 'accident', timestamp: '', location: '' });
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setResult(null);
    if (!authReady) return setMessage('Authentication is still loading. Please try again.');
    const token = user?.access_token || localStorage.getItem('access_token');
    if (!token) return setMessage('Please log in to submit a claim.');
    if (!evidenceFile) return setMessage('Please upload photo evidence.');

    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('file', evidenceFile);
      const upload = await api.post('/upload/evidence', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      const claim = await api.post('/claims/submit', {
        event_type: formData.event_type,
        location: formData.location.trim(),
        screenshot_url: upload.data.cloudinary_url,
      });
      setResult({ ...claim.data, evidence: upload.data });
      setMessage('Claim submitted successfully.');
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Unable to submit claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Submit a Claim</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div><label className="block text-sm font-medium text-gray-700">Event Type</label><select name="event_type" value={formData.event_type} onChange={(e) => setFormData({ ...formData, event_type: e.target.value })} className="mt-1 w-full p-2 border rounded-md"><option value="accident">Accident</option><option value="breakdown">Vehicle Breakdown</option><option value="weather">Weather</option></select></div>
          <div><label className="block text-sm font-medium text-gray-700">Timestamp</label><input type="datetime-local" name="timestamp" value={formData.timestamp} onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })} className="mt-1 w-full p-2 border rounded-md" required /></div>
          <div><label className="block text-sm font-medium text-gray-700">Location</label><input type="text" name="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="mt-1 w-full p-2 border rounded-md" placeholder="Enter location" required /></div>
          <div><label className="block text-sm font-medium text-gray-700">Photo Evidence</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} className="mt-1 w-full p-2 border rounded-md" required /></div>
          <button type="submit" disabled={submitting} className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit Claim'}</button>
        </form>
        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        {result && <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"><p><strong>Claim ID:</strong> {result.claim_id || 'Created'}</p><p><strong>Verification status:</strong> {result.verification_status || 'Pending'}</p>{result.payout_tx_hash && <p className="mt-2 break-all"><strong>Payout tx hash:</strong> {result.payout_tx_hash}</p>}<p><strong>Evidence quality:</strong> {result.evidence?.quality || 'Uploaded'}</p></div>}
        <div className="mt-6"><Link to="/dashboard" className="text-blue-600 hover:underline">Back to Dashboard</Link></div>
      </div>
    </div>
  );
};

export default Claims;
