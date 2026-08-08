import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const api = axios.create({ baseURL: API_URL, timeout: 15000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const Wallet = () => {
  const [wallet, setWallet] = useState(null);
  const [upi, setUpi] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/wallet/balance');
      setWallet(data);
      if (data?.payout_method?.startsWith('UPI: ')) setUpi(data.payout_method.slice(5));
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Unable to load wallet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const savePayout = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.put('/wallet/payout-method', { upi_id: upi, phone });
      setMessage(data.message || 'Payout method saved.');
      await load();
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Unable to configure payout method.');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setMessage('Enter a valid withdrawal amount.');
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.post('/wallet/withdraw', { amount: value });
      setMessage(data.message || 'Withdrawal initiated.');
      setAmount('');
      await load();
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Unable to withdraw.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md text-center">Loading wallet...</div></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-primary mb-2 text-center">Wallet</h2>
        <p className="text-gray-600 mb-6 text-center">Receive approved claim payouts and withdraw them to your UPI account.</p>

        <div className="rounded-md border p-4 mb-6 text-center">
          <p className="text-sm text-gray-500">Available Balance</p>
          <p className="text-3xl font-bold">₹{Number(wallet?.balance || 0).toFixed(2)}</p>
        </div>

        <form className="space-y-4" onSubmit={savePayout}>
          <div>
            <label className="block text-sm font-medium text-gray-700">UPI ID</label>
            <input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@upi" required className="mt-1 w-full p-2 border rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" required className="mt-1 w-full p-2 border rounded-md" />
          </div>
          <button type="submit" disabled={busy} className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{busy ? 'Saving...' : 'Save Payout Method'}</button>
        </form>

        <div className="mt-6 pt-6 border-t">
          <label className="block text-sm font-medium text-gray-700">Withdrawal Amount</label>
          <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" className="mt-1 w-full p-2 border rounded-md" />
          <button type="button" disabled={busy || !wallet?.balance || !wallet?.payout_method} onClick={withdraw} className="w-full mt-3 py-2 px-4 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50">Withdraw to UPI</button>
        </div>

        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        <Link to="/company" className="block w-full mt-4 py-2 px-4 border border-gray-300 rounded-md text-center hover:bg-gray-50 text-gray-700">Back to Profile</Link>
      </div>
    </div>
  );
};

export default Wallet;
