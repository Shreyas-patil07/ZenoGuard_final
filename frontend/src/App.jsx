import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import KYC from './pages/KYC';
import Wallet from './pages/Wallet';
import Company from './pages/Company';
import Dashboard from './pages/Dashboard';
import Claims from './pages/Claims';
import ClaimTimeline from './pages/ClaimTimeline';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/kyc" element={<KYC />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/company" element={<Company />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/claims" element={<Claims />} />
            <Route path="/timeline" element={<ClaimTimeline />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
