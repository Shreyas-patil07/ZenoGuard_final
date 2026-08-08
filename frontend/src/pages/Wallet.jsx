import React from 'react';
import { Link } from 'react-router-dom';

const Wallet = () => {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-bold text-primary mb-6">Connect Wallet</h2>
        <p className="text-gray-600 mb-6">Connect your web3 wallet to receive fast automated claim payouts.</p>
        <button className="w-full py-2 px-4 bg-orange-500 text-white rounded-md hover:bg-orange-600 mb-4">Connect Metamask</button>
        <Link to="/company" className="block w-full py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700">Skip for now</Link>
      </div>
    </div>
  );
};

export default Wallet;
