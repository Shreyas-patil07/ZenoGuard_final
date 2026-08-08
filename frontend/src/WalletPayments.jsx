import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, IndianRupee, Loader2, WalletCards, ShieldCheck, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const api = axios.create({ baseURL: API_URL, timeout: 20000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout.'));
    document.body.appendChild(script);
  });
}

function errorText(error, fallback) {
  return error?.response?.data?.detail || error?.message || fallback;
}

export default function WalletPayments({ Shell }) {
  const [tiers, setTiers] = useState(null);
  const [selectedTier, setSelectedTier] = useState('standard');
  const [duration, setDuration] = useState(30);
  const [quote, setQuote] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [upi, setUpi] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [tierRes, policyRes, walletRes] = await Promise.all([
        api.get('/premium/tiers'),
        api.get('/premium/active-policy'),
        api.get('/wallet/balance'),
      ]);
      setTiers(tierRes.data);
      setPolicy(policyRes.data);
      setWallet(walletRes.data);
      const method = walletRes.data?.payout_method || '';
      if (method.startsWith('UPI: ')) setUpi(method.slice(5));
    } catch (e) {
      setError(errorText(e, 'Unable to load protection and wallet data.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!tiers) return;
    const run = async () => {
      try {
        const res = await api.get('/premium/calculate', { params: { tier: selectedTier, duration_days: duration } });
        setQuote(res.data);
      } catch (e) {
        setError(errorText(e, 'Unable to calculate the premium.'));
      }
    };
    run();
  }, [tiers, selectedTier, duration]);

  const tierEntries = useMemo(() => Object.entries(tiers?.tiers || {}), [tiers]);

  const activateAndPay = async () => {
    setBusy('premium');
    setMessage('');
    setError('');
    try {
      const activated = await api.post('/premium/activate', { tier: selectedTier, duration_days: Number(duration) });
      const policyId = activated.data?.policy?.policy_id;
      if (!policyId) throw new Error('Backend did not return a policy ID.');

      const orderRes = await api.post('/payments/premium/order', { policy_id: policyId });
      const order = orderRes.data;
      await loadRazorpay();
      if (!order.razorpay_key_id) throw new Error('Razorpay key is not configured on the backend.');

      await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: order.razorpay_key_id,
          amount: order.amount_paise,
          currency: order.currency || 'INR',
          name: 'ZenoGuard',
          description: `${selectedTier.toUpperCase()} protection · ${duration} days`,
          order_id: order.order_id,
          prefill: {
            name: JSON.parse(localStorage.getItem('user') || '{}')?.name || '',
            email: JSON.parse(localStorage.getItem('user') || '{}')?.email || '',
          },
          theme: { color: '#111827' },
          handler: async (response) => {
            try {
              await api.post('/payments/premium/verify', {
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
              setMessage('Payment verified. Your protection policy is now active.');
              await load();
              resolve();
            } catch (e) {
              reject(new Error(errorText(e, 'Payment was received but verification failed.')));
            }
          },
          modal: { ondismiss: () => reject(new Error('Payment window closed before completion.')) },
        });
        checkout.on('payment.failed', (response) => reject(new Error(response?.error?.description || 'Razorpay payment failed.')));
        checkout.open();
      });
    } catch (e) {
      setError(errorText(e, 'Unable to start premium payment.'));
    } finally {
      setBusy('');
    }
  };

  const savePayoutMethod = async (e) => {
    e.preventDefault();
    setBusy('payout');
    setMessage('');
    setError('');
    try {
      const res = await api.put('/wallet/payout-method', { upi_id: upi, phone });
      setMessage(res.data?.razorpay_ready ? 'UPI payout method is configured and Razorpay-ready.' : 'Payout method saved.');
      await load();
    } catch (e) {
      setError(errorText(e, 'Unable to configure the payout method.'));
    } finally {
      setBusy('');
    }
  };

  const withdraw = async () => {
    const raw = window.prompt(`Available balance: ₹${Number(wallet?.balance || 0).toFixed(2)}\nEnter withdrawal amount:`);
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter a valid withdrawal amount.');
    setBusy('withdraw');
    setMessage('');
    setError('');
    try {
      const res = await api.post('/wallet/withdraw', { amount });
      setMessage(res.data?.message || 'Withdrawal initiated.');
      await load();
    } catch (e) {
      setError(errorText(e, 'Unable to initiate withdrawal.'));
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return <Shell title="Protection & payments"><div className="content-narrow"><div className="panel"><Loader2 className="spin"/> Loading protection and wallet...</div></div></Shell>;
  }

  const active = policy?.policy;
  const pending = policy?.pending_policy;

  return <Shell title="Protection & payments">
    <div className="dashboard-grid">
      <div className="metric-card featured">
        <div className="metric-label"><ShieldCheck size={17}/> POLICY STATUS</div>
        <strong>{active ? 'ACTIVE' : pending ? 'PAYMENT PENDING' : 'NOT ACTIVE'}</strong>
        <span>{active ? `${active.tier_label} · ${active.days_remaining ?? 0} days remaining` : 'Premium payment activates coverage.'}</span>
        <div className="metric-bottom"><span>{active ? `Coverage up to ₹${Number(active.coverage?.accident || 0).toLocaleString('en-IN')}` : 'Choose a plan below'}</span><button onClick={load}><RefreshCw size={15}/></button></div>
      </div>
      <div className="metric-card">
        <div className="metric-label"><IndianRupee size={17}/> WALLET BALANCE</div>
        <h3>₹{Number(wallet?.balance || 0).toFixed(2)}</h3>
        <span>{wallet?.payout_method || 'No payout method configured'}</span>
      </div>
      <div className="metric-card">
        <div className="metric-label"><WalletCards size={17}/> SETTLEMENT</div>
        <h3>{wallet?.payout_method ? 'UPI payout ready' : 'Configure UPI'}</h3>
        <span>Claim payouts can be routed through the Razorpay payout account.</span>
      </div>
    </div>

    {(message || error) && <div className={error ? 'alert error' : 'notice'}>{error || message}</div>}

    {!active && <div className="split-grid">
      <div className="panel">
        <div className="eyebrow">PREMIUM</div>
        <h2>Choose your protection</h2>
        <div className="platform-grid">
          {tierEntries.map(([key, item]) => <button key={key} type="button" className={`platform-card ${selectedTier === key ? 'selected' : ''}`} onClick={() => setSelectedTier(key)}>
            <ShieldCheck/>
            <b>{item.label}</b>
            <span>Accident ₹{Number(item.accident).toLocaleString('en-IN')} · Weather ₹{Number(item.weather).toLocaleString('en-IN')}</span>
            <small>Base ₹{Number(item.base_premium).toFixed(2)}/day</small>
          </button>)}
        </div>
        <label>Duration<select value={duration} onChange={e => setDuration(Number(e.target.value))}>{(tiers?.durations || [7,30,90]).map(d => <option key={d} value={d}>{d} days</option>)}</select></label>
        {quote && <div className="info-row"><IndianRupee size={20}/><div><b>₹{Number(quote.total_premium).toFixed(2)} total</b><span>₹{Number(quote.premium).toFixed(2)} per day · Risk {quote.risk_score}</span></div></div>}
        <button className="primary-btn submit" disabled={busy === 'premium'} onClick={activateAndPay}>{busy === 'premium' ? 'Opening Razorpay...' : 'Pay premium with Razorpay'} <ArrowRight size={17}/></button>
        <small className="muted">UPI, cards and other methods shown by Razorpay Checkout. Test-mode keys are required for testing.</small>
      </div>

      <div className="panel">
        <div className="eyebrow">PAYMENT FLOW</div>
        <h2>How activation works</h2>
        <div className="timeline">
          <div className="timeline-item"><div className="timeline-dot"><ShieldCheck/></div><div><b>1. Create policy</b><span>Premium and coverage are calculated by the backend risk engine.</span></div></div>
          <div className="timeline-item"><div className="timeline-dot"><IndianRupee/></div><div><b>2. Razorpay Checkout</b><span>Payment is created server-side; the browser never signs the order.</span></div></div>
          <div className="timeline-item"><div className="timeline-dot"><CheckCircle2/></div><div><b>3. Verify payment</b><span>Backend validates the Razorpay signature, amount and order.</span></div></div>
          <div className="timeline-item"><div className="timeline-dot"><ShieldCheck/></div><div><b>4. Policy becomes active</b><span>Only after successful verification does coverage become active.</span></div></div>
        </div>
      </div>
    </div>}

    {active && <div className="panel">
      <div className="eyebrow">ACTIVE POLICY</div>
      <h2>{active.tier_label} protection</h2>
      <div className="info-row"><ShieldCheck size={20}/><div><b>Active until {new Date(active.end_date).toLocaleDateString('en-IN')}</b><span>₹{Number(active.total_premium).toFixed(2)} paid · {active.duration_days} days</span></div></div>
      <div className="platform-grid">
        <div className="platform-card selected"><b>Accident</b><span>₹{Number(active.coverage?.accident || 0).toLocaleString('en-IN')}</span></div>
        <div className="platform-card selected"><b>Breakdown</b><span>₹{Number(active.coverage?.breakdown || 0).toLocaleString('en-IN')}</span></div>
        <div className="platform-card selected"><b>Weather</b><span>₹{Number(active.coverage?.weather || 0).toLocaleString('en-IN')}</span></div>
      </div>
    </div>}

    <div className="split-grid">
      <div className="panel">
        <div className="eyebrow">PAYOUT METHOD</div>
        <h2>Where should claim payouts go?</h2>
        <form className="form-stack" onSubmit={savePayoutMethod}>
          <label>UPI ID<input required placeholder="name@upi" value={upi} onChange={e => setUpi(e.target.value)}/></label>
          <label>Phone number<input required placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value)}/></label>
          <button className="primary-btn submit" disabled={busy === 'payout'}>{busy === 'payout' ? 'Saving...' : 'Save UPI payout method'} <ArrowRight size={17}/></button>
        </form>
      </div>
      <div className="panel">
        <div className="eyebrow">WALLET</div>
        <h2>Claim payout balance</h2>
        <p className="muted">Approved claim payouts are credited here. You can withdraw to the configured UPI account.</p>
        <button className="primary-btn submit" disabled={!wallet?.balance || !wallet?.payout_method || busy === 'withdraw'} onClick={withdraw}>{busy === 'withdraw' ? 'Processing...' : 'Withdraw to UPI'} <ArrowRight size={17}/></button>
      </div>
    </div>

    <div className="panel">
      <div className="eyebrow">RECENT TRANSACTIONS</div>
      {wallet?.transactions?.length ? wallet.transactions.map(tx => <div className="info-row" key={tx.id}><IndianRupee size={18}/><div><b>{tx.description}</b><span>{tx.status} · {tx.timestamp ? new Date(tx.timestamp).toLocaleString('en-IN') : ''}</span></div><strong>{tx.amount >= 0 ? '+' : ''}₹{Number(tx.amount).toFixed(2)}</strong></div>) : <p className="muted">No wallet transactions yet.</p>}
    </div>
  </Shell>;
}
