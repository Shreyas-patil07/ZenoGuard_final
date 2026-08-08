import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const KYC = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setMessage('Please select an ID document.');
    setSubmitting(true);
    setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      const token = localStorage.getItem('access_token');
      const response = await axios.post(`${API_URL}/kyc/upload`, body, {
        headers: { Authorization: token ? `Bearer ${token}` : undefined, 'Content-Type': 'multipart/form-data' },
      });
      setMessage(response.data?.message || 'KYC document submitted.');
    } catch (err) {
      setMessage(err.response?.data?.detail || 'KYC upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-primary mb-6">KYC Upload</h2>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Upload ID Document</label>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 w-full p-2 border rounded-md" required />
          </div>
          <button type="submit" disabled={submitting} className="w-full text-center py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit and Continue'}
          </button>
        </form>
        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        <Link to="/wallet" className="block mt-4 text-center text-blue-600 hover:underline">Continue to Wallet</Link>
      </div>
    </div>
  );
};

export default KYC;
