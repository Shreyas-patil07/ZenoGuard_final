import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Dashboard = () => {
  const { user, authReady } = useContext(AuthContext);
  const [premiumInfo, setPremiumInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [earningsForm, setEarningsForm] = useState({ income: '', hours_worked: '' });
  const [submittingEarnings, setSubmittingEarnings] = useState(false);
  const [earningsMessage, setEarningsMessage] = useState('');

  const token = user?.access_token || localStorage.getItem('access_token') || null;

  const fetchPremium = async () => {
    if (!token) {
      setPremiumInfo({ error: 'Please log in to view premium data.' });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const resp = await axios.get('http://localhost:8000/premium/calculate', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setPremiumInfo(resp.data);
    } catch (err) {
      setPremiumInfo({ error: 'Unable to fetch premium' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady) {
      return;
    }

    fetchPremium();
  }, [authReady, token]);

  const handleEarningsSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setEarningsMessage('Please log in first.');
      return;
    }

    setSubmittingEarnings(true);
    setEarningsMessage('');

    try {
      await axios.post(
        'http://localhost:8000/earnings/upload',
        {
          income: Number(earningsForm.income),
          hours_worked: Number(earningsForm.hours_worked),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setEarningsForm({ income: '', hours_worked: '' });
      setEarningsMessage('Earnings saved. Updating premium...');
      await fetchPremium();
      setEarningsMessage('Earnings saved. Premium updated.');
    } catch (err) {
      setEarningsMessage(err.response?.data?.detail || 'Unable to save earnings');
    } finally {
      setSubmittingEarnings(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-2">Active Policy</h2>
          {loading ? (
            <p className="text-gray-600">Loading premium...</p>
          ) : premiumInfo && typeof premiumInfo.premium === 'number' ? (
            <>
              <p className="text-gray-600">Premium: ₹{premiumInfo.premium.toFixed(2)}/day</p>
              <p className="text-sm text-gray-500 mt-2">Risk score: {premiumInfo.risk_score}</p>
            </>
          ) : (
            <p className="text-gray-600">Premium: --</p>
          )}
          <p className="text-sm text-green-600 mt-2">Status: Active</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-2">Risk Explanation</h2>
          {loading ? (
            <p className="text-gray-600">Loading explanation...</p>
          ) : premiumInfo && premiumInfo.explanation ? (
            <p className="text-sm text-gray-500 mt-2">{premiumInfo.explanation}</p>
          ) : (
            <p className="text-sm text-gray-500 mt-2">No explanation available.</p>
          )}
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center">
          <h2 className="text-xl font-semibold mb-2">Add Today's Earnings</h2>
          <form onSubmit={handleEarningsSubmit} className="space-y-3">
            <input
              type="number"
              min="0"
              step="0.01"
              value={earningsForm.income}
              onChange={(e) => setEarningsForm({ ...earningsForm, income: e.target.value })}
              placeholder="Income"
              className="w-full p-2 border rounded-md"
              required
            />
            <input
              type="number"
              min="0"
              step="0.1"
              value={earningsForm.hours_worked}
              onChange={(e) => setEarningsForm({ ...earningsForm, hours_worked: e.target.value })}
              placeholder="Hours worked"
              className="w-full p-2 border rounded-md"
              required
            />
            <button
              type="submit"
              disabled={submittingEarnings}
              className="w-full py-2 text-center bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submittingEarnings ? 'Saving...' : 'Save Earnings'}
            </button>
          </form>
          {earningsMessage && <p className="text-sm text-gray-600 mt-2">{earningsMessage}</p>}
          <Link to="/claims" className="block w-full py-2 mt-4 text-center bg-red-500 text-white rounded-md hover:bg-red-600">Submit a Claim</Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
