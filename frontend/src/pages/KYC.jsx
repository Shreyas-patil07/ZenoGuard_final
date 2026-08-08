import React from 'react';
import { Link } from 'react-router-dom';

const KYC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-primary mb-6">KYC Upload</h2>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Upload ID Document</label>
            <input type="file" className="mt-1 w-full p-2 border rounded-md" />
          </div>
          <Link to="/wallet" className="block w-full text-center py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700">Submit and Continue</Link>
        </form>
      </div>
    </div>
  );
};

export default KYC;
