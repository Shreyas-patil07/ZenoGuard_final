import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const formatLocalDatetimeValue = (date = new Date()) => {
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// ── quality badge helpers ─────────────────────────────────────────────────────
const QUALITY_META = {
  good:       { label: 'Good quality',       color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', Icon: CheckCircle2 },
  acceptable: { label: 'Acceptable quality', color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     Icon: AlertTriangle },
  poor:       { label: 'Poor quality',       color: 'text-red-600',     bg: 'bg-red-50 border-red-200',         Icon: AlertCircle },
};

function QualityBadge({ quality }) {
  const meta = QUALITY_META[quality] ?? QUALITY_META.acceptable;
  const { Icon, label, color, bg } = meta;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${bg} ${color}`}>
      <Icon size={13} />
      {label}
    </span>
  );
}

function QualityReport({ report, imagesFound, fileType }) {
  if (!report) return null;
  const meta = QUALITY_META[report.quality] ?? QUALITY_META.acceptable;

  return (
    <div className={`mt-3 rounded-xl border p-4 text-sm ${meta.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <QualityBadge quality={report.quality} />
        {fileType === 'pdf' && (
          <span className="text-xs text-gray-500">{imagesFound} image{imagesFound !== 1 ? 's' : ''} found in PDF</span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-4 my-3 text-xs text-gray-600">
        <span>📐 {report.width} × {report.height} px</span>
        <span>☀️ Brightness {report.mean_brightness}/255</span>
        <span>🔍 Sharpness {report.sharpness_score}</span>
      </div>

      {report.issues.length > 0 && (
        <ul className="space-y-1 mb-2">
          {report.issues.map((issue, i) => (
            <li key={i} className={`flex gap-1.5 items-start ${meta.color}`}>
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {issue}
            </li>
          ))}
        </ul>
      )}

      {report.suggestions.length > 0 && (
        <ul className="space-y-1">
          {report.suggestions.map((s, i) => (
            <li key={i} className="flex gap-1.5 items-start text-gray-600">
              <span className="shrink-0">💡</span>
              {s}
            </li>
          ))}
        </ul>
      )}

      {report.quality === 'good' && (
        <p className="text-emerald-700 font-medium mt-1">Evidence looks great — ready to submit!</p>
      )}
    </div>
  );
}

// ── drop-zone ─────────────────────────────────────────────────────────────────
function DropZone({ onFile, file, previews, quality, imagesFound, fileType, onRemove, checking }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const accept = (f) => {
    if (!f) return;
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!ok.includes(f.type)) return alert('Please upload a JPG, PNG, WebP or PDF file.');
    if (f.size > 10 * 1024 * 1024) return alert('File must be under 10 MB.');
    onFile(f);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files[0]);
  }, []);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  if (file) {
    const isPdf = file.type === 'application/pdf';
    return (
      <div className="mt-1">
        {/* File pill */}
        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
          {isPdf
            ? <FileText size={32} className="text-red-500 shrink-0" />
            : previews[0] && (
              <img src={previews[0]} alt="preview" className="h-12 w-12 object-cover rounded-lg border border-gray-200 shrink-0" />
            )
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          {checking && <Loader2 size={18} className="animate-spin text-blue-500 shrink-0" />}
          {!checking && quality && <QualityBadge quality={quality} />}
          <button onClick={onRemove} className="text-gray-400 hover:text-red-500 shrink-0 ml-1">
            <X size={18} />
          </button>
        </div>

        {/* Image thumbnails for PDF */}
        {isPdf && previews.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Images extracted from PDF</p>
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt={`page ${i + 1}`} className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                    <ZoomIn size={16} className="text-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`mt-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors
        ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'}`}
    >
      <Upload size={28} className={dragging ? 'text-blue-500' : 'text-gray-400'} />
      <p className="text-sm font-medium text-gray-700">Drop your file here, or <span className="text-blue-600">browse</span></p>
      <p className="text-xs text-gray-400">JPG, PNG, WebP or PDF · Max 10 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => accept(e.target.files[0])}
      />
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
const Claims = () => {
  const { user, authReady } = useContext(AuthContext);

  const [formData, setFormData] = useState({
    event_type: 'accident',
    timestamp: formatLocalDatetimeValue(),
    location: '',
  });

  // file / quality state
  const [file, setFile] = useState(null);
  const [previews, setPreviews] = useState([]);       // data-URLs for preview
  const [checking, setChecking] = useState(false);
  const [qualityReport, setQualityReport] = useState(null);   // best image report
  const [qualityRaw, setQualityRaw] = useState(null);         // full server response
  const [checkError, setCheckError] = useState('');

  // submission state
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'info' | 'error' | 'success'
  const [verificationStatus, setVerificationStatus] = useState('');
  const [payoutTxHash, setPayoutTxHash] = useState('');

  useEffect(() => {
    if (!formData.timestamp) {
      setFormData((c) => ({ ...c, timestamp: formatLocalDatetimeValue() }));
    }
  }, [formData.timestamp]);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  // ── file selection → quality check ────────────────────────────────────────
  const handleFile = async (f) => {
    setFile(f);
    setQualityReport(null);
    setQualityRaw(null);
    setCheckError('');

    // Generate local preview(s)
    if (f.type !== 'application/pdf') {
      const url = URL.createObjectURL(f);
      setPreviews([url]);
    } else {
      setPreviews([]); // will be populated after server responds
    }

    // Call backend quality check
    setChecking(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const token = user?.access_token || localStorage.getItem('access_token');
      const res = await axios.post(`${API}/upload/evidence`, fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setQualityRaw(res.data);
      setQualityReport(res.data.best_image_report);

      // For PDF: turn base64 or re-use object URLs from extracted images
      // The backend doesn't return images, so just show a placeholder count.
      if (f.type === 'application/pdf') {
        // We can't render PDF images without extra work; just show a text note.
        setPreviews([]);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Could not analyse the file. Please try again.';
      setCheckError(detail);
    } finally {
      setChecking(false);
    }
  };

  const handleRemove = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFile(null);
    setPreviews([]);
    setQualityReport(null);
    setQualityRaw(null);
    setCheckError('');
  };

  // ── submit claim ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!authReady) {
      setMessage('Authentication is still loading. Please try again.');
      setMessageType('error');
      return;
    }

    const token = user?.access_token || localStorage.getItem('access_token') || null;
    if (!token) {
      setMessage('Please log in to submit a claim.');
      setMessageType('error');
      return;
    }

    if (!file) {
      setMessage('Please upload evidence (photo or PDF) before submitting.');
      setMessageType('error');
      return;
    }

    if (qualityReport?.quality === 'poor') {
      setMessage('Your evidence quality is poor. Please upload a clearer photo before submitting.');
      setMessageType('error');
      return;
    }

    setSubmitting(true);
    setMessage('');
    setVerificationStatus('');
    setPayoutTxHash('');

    try {
      const response = await axios.post(
        `${API}/claims/submit`,
        {
          event_type: formData.event_type,
          location: formData.location.trim(),
          screenshot_url: file ? file.name : 'placeholder.png',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setVerificationStatus(response.data.verification_status);
      setPayoutTxHash(response.data.payout_tx_hash || '');
      setMessage('Claim submitted successfully.');
      setMessageType('success');
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Unable to submit claim.');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    !checking &&
    file &&
    qualityReport &&
    qualityReport.quality !== 'poor' &&
    formData.location.trim();

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
          ZenoGuard Protection
        </div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Claim center</h1>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            <ShieldCheck size={15} />
            Protection active
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── LEFT: form ── */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Claim input</p>
            <h2 className="text-xl font-bold text-gray-800 mb-5">Tell us what happened</h2>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Event type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event type</label>
                <select
                  name="event_type"
                  value={formData.event_type}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="accident">Accident</option>
                  <option value="weather">Weather</option>
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. Mumbai, Maharashtra"
                  required
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Evidence upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0.5">
                  Incident evidence <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-400 mb-1">Upload a clear photo of the incident or a PDF containing photos.</p>

                <DropZone
                  onFile={handleFile}
                  file={file}
                  previews={previews}
                  quality={qualityReport?.quality}
                  imagesFound={qualityRaw?.images_found}
                  fileType={qualityRaw?.file_type}
                  onRemove={handleRemove}
                  checking={checking}
                />

                {/* Quality check error */}
                {checkError && (
                  <div className="mt-2 flex gap-2 items-start text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    {checkError}
                  </div>
                )}

                {/* Quality report */}
                {qualityReport && !checkError && (
                  <QualityReport
                    report={qualityReport}
                    imagesFound={qualityRaw?.images_found}
                    fileType={qualityRaw?.file_type}
                  />
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-colors
                  bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                  : 'Submit & verify →'
                }
              </button>

              {/* Inline validation hint */}
              {!file && !submitting && (
                <p className="text-center text-xs text-gray-400">Upload evidence to enable submission</p>
              )}
              {file && qualityReport?.quality === 'poor' && (
                <p className="text-center text-xs text-red-500">Fix the quality issues above before submitting</p>
              )}
            </form>

            {/* Result messages */}
            {message && (
              <div className={`mt-4 rounded-xl border p-4 text-sm flex gap-2 items-start
                ${messageType === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : messageType === 'error' ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                {messageType === 'success'
                  ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                  : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
                <span>{message}</span>
              </div>
            )}
          </div>

          {/* ── RIGHT: timeline ── */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Verification timeline</p>
            <h2 className="text-xl font-bold text-gray-800 mb-5">Claim state</h2>

            <ul className="space-y-5">
              {/* Step 1 */}
              <li className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <ShieldCheck size={15} className="text-blue-600" />
                  </div>
                  <div className="w-px flex-1 bg-gray-200 mt-1" />
                </div>
                <div className="pb-4">
                  <p className="text-sm font-semibold text-gray-800">AI claim screening</p>
                  {verificationStatus
                    ? <p className="text-xs text-gray-500 mt-0.5">Status: <span className="font-medium text-gray-700">{verificationStatus}</span></p>
                    : <p className="text-xs text-gray-400 mt-0.5">Awaiting submission…</p>
                  }
                </div>
              </li>

              {/* Step 2 */}
              <li className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0
                    ${verificationStatus ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <FileText size={15} className={verificationStatus ? 'text-blue-600' : 'text-gray-400'} />
                  </div>
                  <div className="w-px flex-1 bg-gray-200 mt-1" />
                </div>
                <div className="pb-4">
                  <p className={`text-sm font-semibold ${verificationStatus ? 'text-gray-800' : 'text-gray-400'}`}>
                    Backend claim record
                  </p>
                  {verificationStatus
                    ? <p className="text-xs text-gray-500 mt-0.5">Claim recorded · pending manual review</p>
                    : <p className="text-xs text-gray-400 mt-0.5">Not yet submitted</p>
                  }
                </div>
              </li>

              {/* Step 3 */}
              <li className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={15} className={payoutTxHash ? 'text-emerald-500' : 'text-gray-400'} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${payoutTxHash ? 'text-gray-800' : 'text-gray-400'}`}>
                    Payout issued
                  </p>
                  {payoutTxHash
                    ? <p className="text-xs text-gray-500 mt-0.5 break-all">Tx: {payoutTxHash}</p>
                    : <p className="text-xs text-gray-400 mt-0.5">Pending verification</p>
                  }
                </div>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Claims;
