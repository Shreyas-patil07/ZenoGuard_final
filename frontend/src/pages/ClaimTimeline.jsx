import React from 'react';
import { Link } from 'react-router-dom';

const ClaimTimeline = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Claim Timeline</h1>
        <Link to="/dashboard" className="text-blue-600 hover:underline">Back to Dashboard</Link>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <ul className="space-y-6 relative border-l-2 border-blue-200 ml-4">
          <li className="pl-6 relative"><span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-green-500"></span><p className="font-semibold">Claim Submitted</p><p className="text-sm text-gray-500">Oct 24, 10:30 AM</p></li>
          <li className="pl-6 relative"><span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-blue-500"></span><p className="font-semibold">Under AI Verification</p><p className="text-sm text-gray-500">Pending smart contract execution...</p></li>
          <li className="pl-6 relative"><span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-gray-300"></span><p className="font-semibold text-gray-500">Payout Issued to Wallet</p></li>
        </ul>
      </div>
    </div>
  );
};

export default ClaimTimeline;
