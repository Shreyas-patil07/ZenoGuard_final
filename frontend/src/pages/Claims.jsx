import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const formatLocalDatetimeValue = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const Claims = () => {
  const { user, authReady } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    event_type: 'accident',
    timestamp: formatLocalDatetimeValue(),
    location: '',
    screenshot_url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [payoutTxHash, setPayoutTxHash] = useState('');

  useEffect(() => {
    if (!formData.timestamp) {
      setFormData((current) => ({ ...current, timestamp: formatLocalDatetimeValue() }));
    }
  }, [formData.timestamp]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!authReady) {
      setMessage('Authentication is still loading. Please try again in a moment.');
      return;
    }

    const token = user?.access_token || localStorage.getItem('access_token') || null;

    if (!token) {
      setMessage('Please log in to submit a claim.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    setVerificationStatus('');
    setPayoutTxHash('');

    try {
      const response = await axios.post(
        'http://localhost:8000/claims/submit',
        {
          event_type: formData.event_type,
          location: formData.location.trim(),
          screenshot_url: formData.screenshot_url.trim() || 'placeholder.png',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setVerificationStatus(response.data.verification_status);
      setPayoutTxHash(response.data.payout_tx_hash || '');
      setMessage('Claim submitted successfully.');
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Unable to submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Submit a Claim</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Event Type</label>
            <select name="event_type" value={formData.event_type} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
              <option value="accident">Accident</option>
              <option value="weather">Weather</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Timestamp</label>
            <input type="datetime-local" name="timestamp" value={formData.timestamp} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <input type="text" name="location" value={formData.location} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Enter location" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Screenshot / Evidence URL</label>
            <input type="text" name="screenshot_url" value={formData.screenshot_url} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Optional evidence URL" />
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Claim'}
          </button>
        </form>
        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        {verificationStatus && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <p><strong>Verification status:</strong> {verificationStatus}</p>
            {payoutTxHash && <p className="mt-2 break-all"><strong>Payout tx hash:</strong> {payoutTxHash}</p>}
          </div>
        )}
        <div className="mt-6">
          <Link to="/dashboard" className="text-blue-600 hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
};

export default Claims;
