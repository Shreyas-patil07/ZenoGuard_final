import React from 'react';
import { Link } from 'react-router-dom';

const ClaimTimeline = () => {
  const steps = [
    ['Claim Submitted', 'Your claim and evidence entered the backend.', 'bg-green-500'],
    ['AI Verification', 'Claim is checked before settlement.', 'bg-blue-500'],
    ['Blockchain Verification', 'Authorized verification can be recorded on-chain.', 'bg-blue-500'],
    ['Payout Issued', 'Approved funds are credited to the worker wallet.', 'bg-gray-300'],
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Claim Timeline</h1>
        <Link to="/dashboard" className="text-blue-600 hover:underline">Back to Dashboard</Link>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <ul className="space-y-6 relative border-l-2 border-blue-200 ml-4">
          {steps.map(([title, text, dot]) => (
            <li key={title} className="pl-6 relative">
              <span className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full ${dot}`}></span>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-gray-500">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ClaimTimeline;
